// ADR-0007: mutation testing is a weekly and release check, never a pull-request check. The checks
// read the parsed YAML, so a comment or a moved step cannot satisfy a rule by accident.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  actionUses,
  job,
  jobPermissions,
  parseWorkflow,
  runScripts,
  step,
  stepIndex,
  stepRun,
  stringValues,
  trigger,
  triggers,
  workflowPermissions,
} from "./workflow-yaml.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const WORKFLOW = join(ROOT, ".github", "workflows", "mutation.yml");
const PARSED = parseWorkflow(readFileSync(WORKFLOW, "utf8"));
const EXPRESSION = "${{";
const PIN = /^[^@\s]+@[0-9a-f]{40}$/;

function runHas(name: string, ...needles: string[]): boolean {
  const value = step(PARSED, "mutation", name);
  if (value === undefined) return false;
  const run = stepRun(value);
  return needles.every((needle) => run.includes(needle));
}

function order(first: string, second: string): boolean {
  const firstAt = stepIndex(PARSED, "mutation", first);
  const secondAt = stepIndex(PARSED, "mutation", second);
  return firstAt >= 0 && secondAt >= 0 && firstAt < secondAt;
}

describe("weekly mutation workflow", () => {
  it("runs on a schedule and manual dispatch, never on a pull request", () => {
    expect([...triggers(PARSED)].sort()).toEqual(["schedule", "workflow_dispatch"]);
    const schedule = trigger(PARSED, "schedule");
    expect(Array.isArray(schedule)).toBe(true);
    expect(schedule).toEqual([{ cron: "0 3 * * 1" }]);
    expect(trigger(PARSED, "pull_request")).toBeUndefined();
  });

  it("grants only contents: read and uses no environment", () => {
    expect(workflowPermissions(PARSED)).toEqual({ contents: "read" });
    expect(jobPermissions(PARSED, "mutation")).toBeUndefined();
    expect(job(PARSED, "mutation")?.environment).toBeUndefined();
  });

  it("runs the mutation suite and the floor check in order", () => {
    expect(runHas("Run mutation testing", "npm run mutation:force")).toBe(true);
    expect(runHas("Check the floor and the equivalent list", "npm run mutation:check")).toBe(true);
    expect(order("Install", "Run mutation testing")).toBe(true);
    expect(order("Run mutation testing", "Check the floor and the equivalent list")).toBe(true);
    expect(order("Check the floor and the equivalent list", "Upload the reports")).toBe(true);
  });

  it("pins every action by SHA and reads no secret", () => {
    for (const action of actionUses(PARSED)) {
      expect(action).toMatch(PIN);
    }
    const values = stringValues(PARSED);
    expect(values.some((text) => text.includes("secrets."))).toBe(false);
    const upload = step(PARSED, "mutation", "Upload the reports");
    expect(upload).toBeDefined();
    expect(upload?.if).toBe("always()");
    expect(upload?.uses).toMatch(PIN);
  });

  it("keeps expressions out of every run script", () => {
    for (const script of runScripts(PARSED)) {
      expect(script.text.includes(EXPRESSION), `${script.job} ${script.step}`).toBe(false);
    }
  });
});
