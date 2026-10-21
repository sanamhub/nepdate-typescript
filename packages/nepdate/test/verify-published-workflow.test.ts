// verify-published.yml checks a version that is already on npm, the way a user installs it. The
// rules run on the parsed tree, so a commented-out step cannot satisfy them.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import {
  envValue,
  isMapping,
  job,
  jobRun,
  parseWorkflow,
  step,
  stepIndex,
  stepRun,
  stringValues,
  trigger,
  triggers,
  type Workflow,
  workflowPermissions,
} from "./workflow-yaml.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const TEXT = readFileSync(join(ROOT, ".github", "workflows", "verify-published.yml"), "utf8");
const SHIPPED = parseWorkflow(TEXT);
const VERSION = "${{ inputs.version }}";

const INSTALL = "Install the published packages with retries";
const VERSIONS = "Check the installed versions";
const SIGNATURES = "Check the registry signatures";
const QUICK_START = "Run the README quick start and one info() call";

function versionInput(workflow: Workflow, name: string): boolean {
  const value = trigger(workflow, name);
  const inputs = isMapping(value) ? value.inputs : undefined;
  const version = isMapping(inputs) ? inputs.version : undefined;
  return isMapping(version) && version.required === true && version.type === "string";
}

function has(workflow: Workflow, name: string, ...needles: string[]): boolean {
  const value = step(workflow, "verify", name);
  return value !== undefined && needles.every((needle) => stepRun(value).includes(needle));
}

export function problems(workflow: Workflow): string[] {
  const found: string[] = [];
  const names = [...triggers(workflow)].sort();
  if (!isDeepStrictEqual(names, ["workflow_call", "workflow_dispatch"])) {
    found.push("verify-published must be exactly workflow_call and workflow_dispatch");
  }
  for (const name of ["workflow_call", "workflow_dispatch"]) {
    if (!versionInput(workflow, name)) found.push(`${name} must take a required string version`);
  }
  if (!isDeepStrictEqual(workflowPermissions(workflow), { contents: "read" })) {
    found.push("default permissions must be exactly contents: read");
  }
  const verify = job(workflow, "verify");
  if (verify === undefined) return [...found, "verify-published must have a verify job"];
  if (stringValues(workflow).some((text) => text.includes("secrets."))) {
    found.push("verify-published must not read a secret");
  }
  if (
    jobRun(workflow, "verify").includes("actions/checkout") ||
    TEXT.includes("actions/checkout@")
  ) {
    found.push("verify-published must not check out the repository");
  }
  const strategy = isMapping(verify.strategy) ? verify.strategy : undefined;
  const matrix = isMapping(strategy?.matrix) ? strategy.matrix : undefined;
  const os = Array.isArray(matrix?.os) ? [...matrix.os].sort() : [];
  if (!isDeepStrictEqual(os, ["macos-latest", "ubuntu-latest", "windows-latest"])) {
    found.push("verify must run on ubuntu, macos and windows");
  }
  if (!isDeepStrictEqual(matrix?.node, [22, 24])) found.push("verify must run on Node 22 and 24");

  if (!has(workflow, "Check the version", "grep -Eq")) {
    found.push("verify must check the version before using it");
  }
  if (!has(workflow, INSTALL, '"nepdate@$VERSION"', '"nepdate-patro@$VERSION"', "--save-exact")) {
    found.push("verify must install both exact versions");
  }
  if (!has(workflow, INSTALL, "SECONDS + 900", "sleep")) {
    found.push("verify must retry the install for up to 15 minutes");
  }
  if (!has(workflow, VERSIONS, "nepdate nepdate-patro", '!= "$VERSION"')) {
    found.push("verify must compare both installed versions with the input");
  }
  if (!has(workflow, SIGNATURES, "npm audit signatures")) {
    found.push("verify must check the registry signatures");
  }
  if (
    !has(workflow, QUICK_START, "NepaliDate.of(2081, 2, 15)", "toGregorian", ".long(", "info(date)")
  ) {
    found.push("verify must run the README quick start and info()");
  }
  for (const name of ["Check the version", INSTALL, VERSIONS]) {
    const value = step(workflow, "verify", name);
    if (value === undefined || envValue(value, "VERSION") !== VERSION) {
      found.push(`${name} must read the version through env`);
    }
  }
  const order = [INSTALL, VERSIONS, SIGNATURES, QUICK_START].map((name) =>
    stepIndex(workflow, "verify", name),
  );
  if (order.some((at, index) => at < 0 || (index > 0 && at < (order[index - 1] as number)))) {
    found.push("verify must install, compare versions, check signatures, then run the quick start");
  }
  return found;
}

describe("verify-published.yml", () => {
  it("satisfies every rule", () => {
    expect(problems(SHIPPED)).toEqual([]);
  });

  it("reports a missing signature check", () => {
    const edited = TEXT.replace("          npm audit signatures\n", "          true\n");
    expect(edited).not.toEqual(TEXT);
    expect(problems(parseWorkflow(edited))).toContain("verify must check the registry signatures");
  });

  it("reports a range install instead of the exact version", () => {
    const edited = TEXT.replace('"nepdate-patro@$VERSION"', "nepdate-patro");
    expect(edited).not.toEqual(TEXT);
    expect(problems(parseWorkflow(edited))).toContain("verify must install both exact versions");
  });

  it("reports a single-platform matrix", () => {
    const edited = TEXT.replace(
      "os: [ubuntu-latest, macos-latest, windows-latest]",
      "os: [ubuntu-latest]",
    );
    expect(edited).not.toEqual(TEXT);
    expect(problems(parseWorkflow(edited))).toContain(
      "verify must run on ubuntu, macos and windows",
    );
  });

  it("reports a secret", () => {
    const edited = TEXT.replace(
      "          VERSION: ${{ inputs.version }}\n        run: |\n          set -euo pipefail\n          mkdir",
      "          VERSION: ${{ inputs.version }}\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\n        run: |\n          set -euo pipefail\n          mkdir",
    );
    expect(edited).not.toEqual(TEXT);
    expect(problems(parseWorkflow(edited))).toContain("verify-published must not read a secret");
  });

  it("reports a dispatch without a version input", () => {
    const workflow = structuredClone(SHIPPED);
    const dispatch = trigger(workflow, "workflow_dispatch");
    if (isMapping(dispatch)) delete dispatch.inputs;
    expect(problems(workflow)).toContain("workflow_dispatch must take a required string version");
  });
});
