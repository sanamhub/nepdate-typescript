// The CI workflow keeps its triggers, permissions, job set, matrix, Node floor and timeouts.
// The checks read the parsed YAML, so a comment or a moved step cannot satisfy a rule by accident.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import {
  isMapping,
  job,
  jobsOf,
  parseWorkflow,
  type Step,
  stringValues,
  textValue,
  trigger,
  triggers,
  type Workflow,
  withValue,
  workflowPermissions,
} from "./workflow-yaml.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const WORKFLOW = join(ROOT, ".github", "workflows", "ci.yml");
const PARSED = parseWorkflow(readFileSync(WORKFLOW, "utf8"));

const EXPECTED_JOBS = ["browser", "ci", "oldest-node", "runtimes", "temporal", "time-zones"];
const EXPECTED_OS = ["ubuntu-latest", "windows-latest", "macos-latest"];
const EXPECTED_ZONES = ["America/Los_Angeles", "Asia/Kathmandu", "Pacific/Kiritimati"];
const ADR_0009_OPTIONS = "--experimental-strip-types --disable-warning=ExperimentalWarning";

interface Manifest {
  engines?: {
    node?: string;
  };
}

function versionParts(range: string): readonly [number, number, number] {
  const match = /^>=(\d+)\.(\d+)(?:\.(\d+))?$/.exec(range.trim());
  if (match === null) throw new Error(`unsupported engines.node range: ${range}`);
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)] as const;
}

function lowerVersion(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): readonly [number, number, number] {
  if (left[0] !== right[0]) return left[0] < right[0] ? left : right;
  if (left[1] !== right[1]) return left[1] < right[1] ? left : right;
  if (left[2] !== right[2]) return left[2] < right[2] ? left : right;
  return left;
}

function packageFloor(path: string): readonly [number, number, number] {
  const manifest = JSON.parse(readFileSync(join(ROOT, path), "utf8")) as Manifest;
  const range = manifest.engines?.node;
  if (range === undefined) throw new Error(`${path} has no engines.node`);
  return versionParts(range);
}

const ENGINE_FLOOR = lowerVersion(
  packageFloor("packages/nepdate/package.json"),
  packageFloor("packages/nepdate-patro/package.json"),
);

function versionText(version: readonly [number, number, number]): string {
  return `${version[0]}.${version[1]}.${version[2]}`;
}

function stepUsing(workflow: Workflow, jobName: string, prefix: string): Step | undefined {
  const steps = job(workflow, jobName)?.steps;
  if (!Array.isArray(steps)) return undefined;
  return steps
    .filter(isMapping)
    .find((value) => typeof value.uses === "string" && value.uses.startsWith(prefix));
}

function runIndex(workflow: Workflow, jobName: string, exact: string): number {
  const steps = job(workflow, jobName)?.steps;
  if (!Array.isArray(steps)) return -1;
  return steps.findIndex(
    (value) => isMapping(value) && typeof value.run === "string" && value.run.trim() === exact,
  );
}

function matrix(workflow: Workflow, jobName: string): Record<string, unknown> | undefined {
  const strategy = job(workflow, jobName)?.strategy;
  if (!isMapping(strategy)) return undefined;
  return isMapping(strategy.matrix) ? strategy.matrix : undefined;
}

function jobHasWrite(jobValue: Record<string, unknown>): boolean {
  const permissions = jobValue.permissions;
  if (typeof permissions === "string") return permissions.includes("write");
  if (!isMapping(permissions)) return false;
  return Object.values(permissions).some((value) => value === "write" || value === "write-all");
}

function triggerProblems(workflow: Workflow): string[] {
  const found: string[] = [];
  const names = [...triggers(workflow)].sort();
  if (!isDeepStrictEqual(names, ["pull_request", "push"])) {
    found.push("ci triggers must be exactly push and pull_request");
  }
  if (!isDeepStrictEqual(trigger(workflow, "push"), { branches: ["main"] })) {
    found.push("push trigger must be exactly the main branch");
  }
  if (trigger(workflow, "pull_request") !== null) {
    found.push("pull_request trigger must have no filters");
  }
  if (trigger(workflow, "pull_request_target") !== undefined) {
    found.push("ci workflow must not use pull_request_target");
  }
  if (trigger(workflow, "workflow_run") !== undefined) {
    found.push("ci workflow must not use workflow_run");
  }
  return found;
}

function permissionProblems(workflow: Workflow): string[] {
  const found: string[] = [];
  if (!isDeepStrictEqual(workflowPermissions(workflow), { contents: "read" })) {
    found.push("ci workflow permissions must be exactly contents: read");
  }
  for (const [name, value] of Object.entries(jobsOf(workflow))) {
    if (!isMapping(value)) continue;
    if (jobHasWrite(value)) found.push(`job ${name} must not have write permissions`);
    const permissions = value.permissions;
    if (isMapping(permissions) && "id-token" in permissions) {
      found.push(`job ${name} must not request id-token`);
    }
    if (value.environment !== undefined) {
      found.push(`job ${name} must not use an environment`);
    }
  }
  return found;
}

// Catches `secrets.X`, `secrets['X']` and a job-level `secrets:` block such as `secrets: inherit`.
function secretProblems(workflow: Workflow): string[] {
  const inValues = stringValues(workflow).some((text) => /\bsecrets\b/.test(text));
  const inKeys = Object.values(jobsOf(workflow)).some(
    (value) => isMapping(value) && value.secrets !== undefined,
  );
  return inValues || inKeys ? ["ci workflow must not read a secret"] : [];
}

function jobProblems(workflow: Workflow): string[] {
  const found: string[] = [];
  const names = Object.keys(jobsOf(workflow)).sort();
  if (!isDeepStrictEqual(names, EXPECTED_JOBS)) {
    found.push(`ci job set must be exactly ${EXPECTED_JOBS.join(", ")}`);
  }
  return found;
}

function ciProblems(workflow: Workflow): string[] {
  const found: string[] = [];
  const ci = job(workflow, "ci");
  if (ci === undefined) return [...found, "ci workflow must have a ci job"];
  const ciMatrix = matrix(workflow, "ci");
  if (!isDeepStrictEqual(ciMatrix?.os, EXPECTED_OS)) {
    found.push(`ci matrix os must be exactly ${EXPECTED_OS.join(", ")}`);
  }
  const strategy = ci.strategy;
  if (!isMapping(strategy) || strategy["fail-fast"] !== false) {
    found.push("ci strategy must set fail-fast: false");
  }
  const ciSteps = ci.steps;
  if (!Array.isArray(ciSteps) || ciSteps.length === 0) {
    found.push("ci job must have steps");
  } else {
    const last = ciSteps.at(-1);
    if (!isMapping(last) || typeof last.run !== "string" || last.run.trim() !== "npm run ci") {
      found.push("last ci step must run npm run ci");
    }
  }
  return found;
}

function oldestNodeProblems(workflow: Workflow): string[] {
  const found: string[] = [];
  const value = job(workflow, "oldest-node");
  if (value === undefined) return ["ci workflow must have an oldest-node job"];
  const setup = stepUsing(workflow, "oldest-node", "actions/setup-node@");
  const expected = versionText(ENGINE_FLOOR);
  if (setup === undefined || withValue(setup, "node-version") !== expected) {
    found.push(`oldest-node setup-node must use ${expected}`);
  }
  const env = value.env;
  const nodeOptions = isMapping(env) ? textValue(env.NODE_OPTIONS) : undefined;
  if (nodeOptions !== ADR_0009_OPTIONS) {
    found.push("oldest-node must set NODE_OPTIONS to the ADR-0009 flags");
  }
  const build = runIndex(workflow, "oldest-node", "npm run build");
  const test = runIndex(workflow, "oldest-node", "npm test");
  const smoke = runIndex(workflow, "oldest-node", "node scripts/packed-smoke.ts");
  if (build < 0 || test < 0 || smoke < 0 || !(build < test && test < smoke)) {
    found.push("oldest-node must build, test and run the packed smoke in that order");
  }
  return found;
}

function temporalProblems(workflow: Workflow): string[] {
  const setup = stepUsing(workflow, "temporal", "actions/setup-node@");
  if (setup === undefined || withValue(setup, "node-version") !== "26") {
    return ["temporal setup-node must use Node 26"];
  }
  return [];
}

function timeZoneProblems(workflow: Workflow): string[] {
  const zones = matrix(workflow, "time-zones")?.tz;
  return isDeepStrictEqual(zones, EXPECTED_ZONES)
    ? []
    : [`time-zones matrix must be exactly ${EXPECTED_ZONES.join(", ")}`];
}

function timeoutProblems(workflow: Workflow): string[] {
  const found: string[] = [];
  for (const [name, value] of Object.entries(jobsOf(workflow))) {
    if (!isMapping(value)) continue;
    const timeout = value["timeout-minutes"];
    const hasSteps = Array.isArray(value.steps) && value.steps.length > 0;
    if (timeout === undefined) {
      // GitHub does not allow timeout-minutes on a job that calls a reusable workflow; the called
      // workflow owns its timeout. Any other job must set one.
      if (hasSteps || typeof value.uses !== "string") {
        found.push(`job ${name} must set a positive timeout-minutes`);
      }
      continue;
    }
    if (typeof timeout !== "number" || timeout <= 0) {
      found.push(`job ${name} must set a positive timeout-minutes`);
    }
  }
  return found;
}

export function ciWorkflowProblems(workflow: Workflow): string[] {
  return [
    ...triggerProblems(workflow),
    ...permissionProblems(workflow),
    ...secretProblems(workflow),
    ...jobProblems(workflow),
    ...ciProblems(workflow),
    ...oldestNodeProblems(workflow),
    ...temporalProblems(workflow),
    ...timeZoneProblems(workflow),
    ...timeoutProblems(workflow),
  ];
}

describe("CI workflow", () => {
  it("satisfies every rule", () => {
    expect(ciWorkflowProblems(PARSED)).toEqual([]);
  });

  it("reports pull_request_target", () => {
    const text = readFileSync(WORKFLOW, "utf8");
    const edited = text.replace("  pull_request:\n", "  pull_request:\n  pull_request_target:\n");
    expect(edited).not.toEqual(text);
    expect(ciWorkflowProblems(parseWorkflow(edited))).toContain(
      "ci triggers must be exactly push and pull_request",
    );
  });

  it("reports a pull_request filter", () => {
    const text = readFileSync(WORKFLOW, "utf8");
    const edited = text.replace("  pull_request:\n", "  pull_request:\n    branches: [main]\n");
    expect(edited).not.toEqual(text);
    expect(ciWorkflowProblems(parseWorkflow(edited))).toContain(
      "pull_request trigger must have no filters",
    );
  });

  it("reports a job-level secret", () => {
    const text = readFileSync(WORKFLOW, "utf8");
    const edited = text.replace(
      "  ci:\n    strategy:",
      "  ci:\n    secrets: inherit\n    strategy:",
    );
    expect(edited).not.toEqual(text);
    expect(ciWorkflowProblems(parseWorkflow(edited))).toContain(
      "ci workflow must not read a secret",
    );
  });

  it("reports an extra job", () => {
    const text = readFileSync(WORKFLOW, "utf8");
    const edited = text.replace(
      "  ci:\n    strategy:",
      "  shared-check:\n    runs-on: ubuntu-latest\n    timeout-minutes: 5\n\n  ci:\n    strategy:",
    );
    expect(edited).not.toEqual(text);
    expect(ciWorkflowProblems(parseWorkflow(edited))).toContain(
      `ci job set must be exactly ${EXPECTED_JOBS.join(", ")}`,
    );
  });

  it("reports a job with neither steps nor a timeout", () => {
    const text = readFileSync(WORKFLOW, "utf8");
    const edited = text.replace(
      "      - run: npm run test:browser -w nepdate-datepicker\n",
      "      - run: npm run test:browser -w nepdate-datepicker\n\n  idle:\n    runs-on: ubuntu-latest\n",
    );
    expect(edited).not.toEqual(text);
    expect(ciWorkflowProblems(parseWorkflow(edited))).toContain(
      "job idle must set a positive timeout-minutes",
    );
  });

  it("reports a write permission on a job", () => {
    const text = readFileSync(WORKFLOW, "utf8");
    const edited = text.replace(
      "  ci:\n    strategy:",
      "  ci:\n    permissions:\n      contents: write\n    strategy:",
    );
    expect(edited).not.toEqual(text);
    expect(ciWorkflowProblems(parseWorkflow(edited))).toContain(
      "job ci must not have write permissions",
    );
  });

  it("reports a setup-node version below the engine floor", () => {
    const text = readFileSync(WORKFLOW, "utf8");
    const edited = text.replace(
      "      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0\n        with:\n          node-version: 22.12.0",
      "      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0\n        with:\n          node-version: 22.11",
    );
    expect(edited).not.toEqual(text);
    expect(ciWorkflowProblems(parseWorkflow(edited))).toContain(
      `oldest-node setup-node must use ${versionText(ENGINE_FLOOR)}`,
    );
  });
});
