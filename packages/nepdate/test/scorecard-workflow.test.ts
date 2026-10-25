// scorecard.yml runs OpenSSF Scorecard and publishes the result. Scorecard only publishes from a
// workflow whose job holds no write permission other than security-events and id-token.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import {
  job,
  jobPermissions,
  parseWorkflow,
  stepsOf,
  stepWith,
  triggers,
  type Workflow,
  workflowPermissions,
} from "./workflow-yaml.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const TEXT = readFileSync(join(ROOT, ".github", "workflows", "scorecard.yml"), "utf8");
const SHIPPED = parseWorkflow(TEXT);

export function problems(workflow: Workflow): string[] {
  const found: string[] = [];
  const names = [...triggers(workflow)].sort();
  if (!isDeepStrictEqual(names, ["branch_protection_rule", "push", "schedule"])) {
    found.push("scorecard must run on push, schedule and branch_protection_rule");
  }
  if (!isDeepStrictEqual(workflowPermissions(workflow), { contents: "read" })) {
    found.push("default permissions must be exactly contents: read");
  }
  if (job(workflow, "analysis") === undefined) {
    return [...found, "scorecard must have an analysis job"];
  }
  if (
    !isDeepStrictEqual(jobPermissions(workflow, "analysis"), {
      contents: "read",
      "security-events": "write",
      "id-token": "write",
    })
  ) {
    found.push("analysis permissions must be contents read, security-events and id-token write");
  }
  const scorecard = stepsOf(workflow, "analysis").find(
    (value) => typeof value.uses === "string" && value.uses.startsWith("ossf/scorecard-action@"),
  );
  if (scorecard === undefined || stepWith(scorecard)?.publish_results !== true) {
    found.push("scorecard must publish its results");
  }
  return found;
}

describe("scorecard.yml", () => {
  it("satisfies every rule", () => {
    expect(problems(SHIPPED)).toEqual([]);
  });

  it("reports results that are not published", () => {
    const edited = TEXT.replace("publish_results: true", "publish_results: false");
    expect(edited).not.toEqual(TEXT);
    expect(problems(parseWorkflow(edited))).toContain("scorecard must publish its results");
  });

  it("reports an extra write permission", () => {
    const edited = TEXT.replace(
      "      contents: read\n      security-events",
      "      contents: write\n      security-events",
    );
    expect(edited).not.toEqual(TEXT);
    expect(problems(parseWorkflow(edited))).toContain(
      "analysis permissions must be contents read, security-events and id-token write",
    );
  });
});
