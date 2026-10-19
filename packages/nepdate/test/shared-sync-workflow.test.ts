// The shared-sync workflow is a single pinned reusable-workflow call. It runs weekly, writes the
// shared copy and opens one pull request (ADR-0001 §7).

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pinCommentProblems, pinProblems } from "./workflow-rules.js";
import {
  isMapping,
  job,
  jobPermissions,
  jobsOf,
  parseWorkflow,
  trigger,
  triggers,
  workflowPermissions,
} from "./workflow-yaml.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const WORKFLOW = join(ROOT, ".github", "workflows", "shared-sync.yml");
const TEXT = readFileSync(WORKFLOW, "utf8");
const PARSED = parseWorkflow(TEXT);
const EXPRESSION = "${{";

function expression(text: string): string {
  return `${EXPRESSION} ${text} }}`;
}

describe("shared-sync workflow", () => {
  it("runs weekly and by manual dispatch", () => {
    expect([...triggers(PARSED)].sort()).toEqual(["schedule", "workflow_dispatch"]);
    expect(trigger(PARSED, "schedule")).toEqual([{ cron: "15 3 * * 2" }]);
  });

  it("grants only contents: read at the workflow level", () => {
    expect(workflowPermissions(PARSED)).toEqual({ contents: "read" });
  });

  it("has one sync job that writes the shared copy and opens a pull request", () => {
    expect(Object.keys(jobsOf(PARSED))).toEqual(["sync"]);
    expect(jobPermissions(PARSED, "sync")).toEqual({
      contents: "write",
      "pull-requests": "write",
    });
    const sync = job(PARSED, "sync");
    expect(sync?.steps).toBeUndefined();
    expect(sync?.environment).toBeUndefined();
  });

  it("pins the reusable workflow with a version comment", () => {
    expect(pinProblems(PARSED)).toEqual([]);
    expect(pinCommentProblems(PARSED, TEXT)).toEqual([]);
  });

  it("regenerates the tables with the expected secret", () => {
    const sync = job(PARSED, "sync");
    const withMap = isMapping(sync?.with) ? sync.with : undefined;
    expect(withMap?.regenerate).toBe("npm ci && npm run codegen");
    const secrets = isMapping(sync?.secrets) ? sync.secrets : undefined;
    expect(secrets?.SYNC_APP_PRIVATE_KEY).toBe(expression("secrets.SYNC_APP_PRIVATE_KEY"));
  });
});
