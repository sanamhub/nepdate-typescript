// verify-published.yml checks a version that is already on npm, the way a user installs it, and
// runs the same check weekly with every package manager and daily as metadata only. The rules run
// on the parsed tree, so a commented-out step cannot satisfy them.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import {
  envValue,
  isMapping,
  job,
  jobPermissions,
  jobRun,
  jobsOf,
  type Mapping,
  needsOf,
  parseWorkflow,
  step,
  stepRun,
  stepsOf,
  stringValues,
  trigger,
  triggers,
  type Workflow,
  withValue,
  workflowPermissions,
} from "./workflow-yaml.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const TEXT = readFileSync(join(ROOT, ".github", "workflows", "verify-published.yml"), "utf8");
const SHIPPED = parseWorkflow(TEXT);
const VERSION = "${{ needs.resolve.outputs.version }}";
const INPUT_VERSION = "${{ inputs.version }}";
const WEEKLY = "31 6 * * 1";
const DAILY = "27 3 * * *";
const MANAGERS = ["npm", "pnpm", "yarn-node-modules", "yarn-pnp", "bun"];
const CHECK_JOBS = ["verify", "weekly", "metadata"];

function versionInput(workflow: Workflow, name: string): boolean {
  const value = trigger(workflow, name);
  const inputs = isMapping(value) ? value.inputs : undefined;
  const version = isMapping(inputs) ? inputs.version : undefined;
  return (
    isMapping(version) &&
    version.required === false &&
    version.default === "latest" &&
    version.type === "string"
  );
}

function matrixOf(workflow: Workflow, name: string): Mapping | undefined {
  const strategy = job(workflow, name)?.strategy;
  const matrix = isMapping(strategy) ? strategy.matrix : undefined;
  return isMapping(matrix) ? matrix : undefined;
}

function has(workflow: Workflow, name: string, stepName: string, ...needles: string[]): boolean {
  const value = step(workflow, name, stepName);
  return value !== undefined && needles.every((needle) => stepRun(value).includes(needle));
}

function uploadOf(workflow: Workflow, name: string): Mapping | undefined {
  return stepsOf(workflow, name).find(
    (value) => typeof value.uses === "string" && value.uses.startsWith("actions/upload-artifact@"),
  );
}

export function problems(workflow: Workflow): string[] {
  const found: string[] = [];
  const names = [...triggers(workflow)].sort();
  if (!isDeepStrictEqual(names, ["schedule", "workflow_call", "workflow_dispatch"])) {
    found.push("verify-published must be workflow_call, workflow_dispatch and schedule only");
  }
  for (const name of ["workflow_call", "workflow_dispatch"]) {
    if (!versionInput(workflow, name)) {
      found.push(`${name} must take an optional string version that defaults to latest`);
    }
  }
  const schedule = trigger(workflow, "schedule");
  const crons = Array.isArray(schedule)
    ? schedule
        .map((entry) => (isMapping(entry) ? entry.cron : undefined))
        .filter((cron): cron is string => typeof cron === "string")
        .sort()
    : [];
  if (!isDeepStrictEqual(crons, [DAILY, WEEKLY])) {
    found.push(`schedule must run ${WEEKLY} and ${DAILY} only`);
  }
  if (!isDeepStrictEqual(workflowPermissions(workflow), { contents: "read" })) {
    found.push("default permissions must be exactly contents: read");
  }
  if (stringValues(workflow).some((text) => text.includes("secrets."))) {
    found.push("verify-published must not read a secret");
  }
  for (const name of Object.keys(jobsOf(workflow))) {
    if (job(workflow, name)?.["timeout-minutes"] === undefined) {
      found.push(`job ${name} must set timeout-minutes`);
    }
  }
  for (const name of ["resolve", ...CHECK_JOBS, "report"]) {
    if (job(workflow, name) === undefined) {
      return [...found, `verify-published must have a ${name} job`];
    }
  }

  const resolveJob = job(workflow, "resolve") as Mapping;
  if (resolveJob["runs-on"] !== "ubuntu-24.04") found.push("resolve must run on ubuntu-24.04");
  if (resolveJob["timeout-minutes"] !== 10) found.push("resolve must time out after 10 minutes");
  const outputs = isMapping(resolveJob.outputs) ? resolveJob.outputs : undefined;
  if (outputs?.version !== "${{ steps.resolve.outputs.version }}") {
    found.push("resolve must publish the version output");
  }
  if (!has(workflow, "resolve", "Resolve", "--resolve", "GITHUB_OUTPUT", "Resolved version:")) {
    found.push("resolve must resolve the version in one place and write the summary");
  }
  const resolveStep = step(workflow, "resolve", "Resolve");
  if (resolveStep === undefined || envValue(resolveStep, "INPUT_VERSION") !== INPUT_VERSION) {
    found.push("resolve must read the input version through env");
  }

  const verifyJob = job(workflow, "verify") as Mapping;
  if (verifyJob.if !== "github.event_name != 'schedule'") {
    found.push("verify must skip scheduled runs");
  }
  if (!isDeepStrictEqual(needsOf(workflow, "verify"), ["resolve"])) {
    found.push("verify must need resolve");
  }
  if (typeof verifyJob.name !== "string" || !verifyJob.name.includes(VERSION)) {
    found.push("verify must name the resolved version");
  }
  if (verifyJob["timeout-minutes"] !== 30) found.push("verify must time out after 30 minutes");
  const verifyMatrix = matrixOf(workflow, "verify");
  const oses = Array.isArray(verifyMatrix?.os) ? [...verifyMatrix.os].sort() : [];
  if (!isDeepStrictEqual(oses, ["macos-latest", "ubuntu-latest", "windows-latest"])) {
    found.push("verify must run on ubuntu, macos and windows");
  }
  if (!isDeepStrictEqual(verifyMatrix?.node, [22, 24])) {
    found.push("verify must run on Node 22 and 24");
  }
  if (
    !has(
      workflow,
      "verify",
      "Install and check the published packages",
      "node scripts/verify-published.mjs",
      '"$VERSION"',
      "--manager npm",
      "set -o pipefail",
      "tee verify.log",
    )
  ) {
    found.push("verify must install and check the three packages with npm through the script");
  }
  const verifyStep = step(workflow, "verify", "Install and check the published packages");
  if (verifyStep === undefined || envValue(verifyStep, "VERSION") !== VERSION) {
    found.push("verify must read the version through env");
  }

  const weeklyJob = job(workflow, "weekly") as Mapping;
  if (weeklyJob.if !== `github.event_name == 'schedule' && github.event.schedule == '${WEEKLY}'`) {
    found.push("weekly must run only on the weekly schedule");
  }
  if (weeklyJob["runs-on"] !== "ubuntu-24.04") found.push("weekly must run on ubuntu-24.04");
  const weeklyTimeout = weeklyJob["timeout-minutes"];
  if (typeof weeklyTimeout !== "number" || weeklyTimeout < 30) {
    found.push("weekly must allow at least 30 minutes");
  }
  if (typeof weeklyJob.name !== "string" || !weeklyJob.name.includes(VERSION)) {
    found.push("weekly must name the resolved version");
  }
  const weeklyMatrix = matrixOf(workflow, "weekly");
  const managers = Array.isArray(weeklyMatrix?.manager) ? [...weeklyMatrix.manager] : [];
  if (!isDeepStrictEqual([...managers].sort(), [...MANAGERS].sort())) {
    found.push("weekly must run npm, pnpm, both yarn linkers and bun once each");
  }
  if (
    !has(
      workflow,
      "weekly",
      "Install and check the published packages",
      '"$VERSION"',
      '--manager "$MANAGER"',
      "tee verify.log",
    )
  ) {
    found.push("weekly must install and check through the script with the matrix manager");
  }
  const weeklyStep = step(workflow, "weekly", "Install and check the published packages");
  if (weeklyStep === undefined || envValue(weeklyStep, "MANAGER") !== "${{ matrix.manager }}") {
    found.push("weekly must read the manager through env");
  }
  const bun = step(workflow, "weekly", "Set up bun");
  if (
    bun === undefined ||
    typeof bun.uses !== "string" ||
    !bun.uses.startsWith("oven-sh/setup-bun@")
  ) {
    found.push("weekly must install bun with oven-sh/setup-bun");
  }
  if (bun?.if !== "matrix.manager == 'bun'") {
    found.push("weekly must set up bun only for the bun entry");
  }

  const metadataJob = job(workflow, "metadata") as Mapping;
  if (metadataJob.if !== `github.event_name == 'schedule' && github.event.schedule == '${DAILY}'`) {
    found.push("metadata must run only on the daily schedule");
  }
  if (metadataJob["timeout-minutes"] !== 10) found.push("metadata must time out after 10 minutes");
  if (typeof metadataJob.name !== "string" || !metadataJob.name.includes(VERSION)) {
    found.push("metadata must name the resolved version");
  }
  if (
    !has(
      workflow,
      "metadata",
      "Check the registry listing",
      '"$VERSION"',
      "--metadata",
      "tee metadata.log",
    )
  ) {
    found.push("metadata must check the registry listing through the script");
  }
  const metadataStep = step(workflow, "metadata", "Check the registry listing");
  if (metadataStep === undefined || envValue(metadataStep, "VERSION") !== VERSION) {
    found.push("metadata must read the version through env");
  }

  for (const name of CHECK_JOBS) {
    const summary = step(workflow, name, "Step summary");
    if (summary === undefined || summary.if !== "always()") {
      found.push(`${name} must write a step summary every time`);
    } else if (envValue(summary, "OUTCOME") !== "${{ steps.check.outcome }}") {
      found.push(`${name} must report the check outcome through env`);
    }
    const keep = step(workflow, name, "Keep the failing output");
    if (keep === undefined || keep.if !== "failure()") {
      found.push(`${name} must keep the failing output`);
    }
    const upload = uploadOf(workflow, name);
    if (upload === undefined) {
      found.push(`${name} must upload its failure output`);
      continue;
    }
    if (upload.if !== "failure()") found.push(`${name} must upload only on failure`);
    if (withValue(upload, "if-no-files-found") !== "ignore") {
      found.push(`${name} must ignore a missing failure file`);
    }
    if (withValue(upload, "retention-days") !== "7") {
      found.push(`${name} must keep the failure artifact for 7 days`);
    }
    const artifact = withValue(upload, "name") ?? "";
    if (!artifact.startsWith("failure-")) {
      found.push(`${name} must name its failure artifact failure-*`);
    } else if (name === "verify" && !artifact.includes("matrix.node")) {
      found.push("verify must name its failure artifact after the OS and the Node version");
    } else if (name === "weekly" && !artifact.includes("matrix.manager")) {
      found.push("weekly must name its failure artifact after the manager");
    }
  }

  const reportJob = job(workflow, "report") as Mapping;
  if (reportJob.if !== "failure() && github.event_name == 'schedule'") {
    found.push("report must run only when a scheduled check fails");
  }
  if (
    !isDeepStrictEqual(needsOf(workflow, "report").sort(), [
      "metadata",
      "resolve",
      "verify",
      "weekly",
    ])
  ) {
    found.push("report must wait for all four check jobs");
  }
  if (
    !isDeepStrictEqual(jobPermissions(workflow, "report"), { contents: "read", issues: "write" })
  ) {
    found.push(
      "report is the only job allowed to write, and it needs contents: read and issues: write",
    );
  }
  for (const name of ["resolve", ...CHECK_JOBS]) {
    if (jobPermissions(workflow, name)?.issues !== undefined) {
      found.push(`only report may write issues; ${name} must not`);
    }
  }
  if (
    !has(
      workflow,
      "report",
      "Open or update the issue",
      "bash scripts/published-issue.sh nepdate-core",
      "${VERSION:-latest}",
      "failures",
    )
  ) {
    found.push("report must run the issue script with the package and the failures directory");
  }
  const reportStep = step(workflow, "report", "Open or update the issue");
  if (reportStep === undefined || envValue(reportStep, "GH_TOKEN") !== "${{ github.token }}") {
    found.push("report must pass github.token as GH_TOKEN");
  }
  if (jobRun(workflow, "report").includes("verify-published.mjs")) {
    found.push("report must not install anything");
  }

  return found;
}

describe("verify-published.yml", () => {
  it("satisfies every rule", () => {
    expect(problems(SHIPPED)).toEqual([]);
  });

  it("reports a required version input", () => {
    expect(problems(edit("required: false", "required: true"))).toContain(
      "workflow_call must take an optional string version that defaults to latest",
    );
  });

  it("reports a missing daily cron", () => {
    expect(problems(edit('    - cron: "27 3 * * *"\n', ""))).toContain(
      `schedule must run ${WEEKLY} and ${DAILY} only`,
    );
  });

  it("reports a single-version verify matrix", () => {
    expect(problems(edit("node: [22, 24]", "node: [24]"))).toContain(
      "verify must run on Node 22 and 24",
    );
  });

  it("reports a verify job that skips the script", () => {
    expect(problems(edit(" --manager npm", ""))).toContain(
      "verify must install and check the three packages with npm through the script",
    );
  });

  it("reports a weekly matrix without a manager", () => {
    expect(
      problems(edit("[npm, pnpm, yarn-node-modules, yarn-pnp, bun]", "[npm, pnpm, bun]")),
    ).toContain("weekly must run npm, pnpm, both yarn linkers and bun once each");
  });

  it("reports the missing issue permission", () => {
    expect(problems(edit("      issues: write\n", ""))).toContain(
      "report is the only job allowed to write, and it needs contents: read and issues: write",
    );
  });

  it("reports a report job that passes no token", () => {
    expect(problems(edit("          GH_TOKEN: ${{ github.token }}\n", ""))).toContain(
      "report must pass github.token as GH_TOKEN",
    );
  });

  it("reports a nightly artifact name shared by every manager", () => {
    expect(
      problems(edit("name: failure-weekly-${{ matrix.manager }}", "name: failure-weekly")),
    ).toContain("weekly must name its failure artifact after the manager");
  });

  it("reports bun set up for every manager", () => {
    expect(problems(edit("        if: matrix.manager == 'bun'\n", ""))).toContain(
      "weekly must set up bun only for the bun entry",
    );
  });
});

// Edits the shipped text, so a rule has to fail on a real workflow and not on a fixture.
function edit(from: string, to: string): Workflow {
  const at = TEXT.indexOf(from);
  expect(at, `expected ${from}`).toBeGreaterThanOrEqual(0);
  return parseWorkflow(TEXT.slice(0, at) + to + TEXT.slice(at + from.length));
}
