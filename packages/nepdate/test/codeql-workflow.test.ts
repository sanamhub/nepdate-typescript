// codeql.yml scans the workflows and the TypeScript source. Neither needs a build, so the job must
// stay in build mode none and must never get write access beyond code scanning results.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import {
  isMapping,
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
const TEXT = readFileSync(join(ROOT, ".github", "workflows", "codeql.yml"), "utf8");
const SHIPPED = parseWorkflow(TEXT);

export function problems(workflow: Workflow): string[] {
  const found: string[] = [];
  const names = [...triggers(workflow)].sort();
  if (!isDeepStrictEqual(names, ["pull_request", "push", "schedule"])) {
    found.push("codeql must run on push, pull_request and schedule");
  }
  if (!isDeepStrictEqual(workflowPermissions(workflow), { contents: "read" })) {
    found.push("default permissions must be exactly contents: read");
  }
  const analyze = job(workflow, "analyze");
  if (analyze === undefined) return [...found, "codeql must have an analyze job"];
  if (
    !isDeepStrictEqual(jobPermissions(workflow, "analyze"), {
      contents: "read",
      "security-events": "write",
    })
  ) {
    found.push("analyze permissions must be contents read and security-events write");
  }
  const strategy = isMapping(analyze.strategy) ? analyze.strategy : undefined;
  const matrix = isMapping(strategy?.matrix) ? strategy.matrix : undefined;
  if (!isDeepStrictEqual(matrix?.language, ["actions", "javascript-typescript"])) {
    found.push("codeql must scan actions and javascript-typescript");
  }
  const init = stepsOf(workflow, "analyze").find(
    (value) =>
      typeof value.uses === "string" && value.uses.startsWith("github/codeql-action/init@"),
  );
  if (init === undefined || stepWith(init)?.["build-mode"] !== "none") {
    found.push("codeql init must use build mode none");
  }
  return found;
}

describe("codeql.yml", () => {
  it("satisfies every rule", () => {
    expect(problems(SHIPPED)).toEqual([]);
  });

  it("reports a language dropped from the matrix", () => {
    const edited = TEXT.replace("[actions, javascript-typescript]", "[actions]");
    expect(edited).not.toEqual(TEXT);
    expect(problems(parseWorkflow(edited))).toContain(
      "codeql must scan actions and javascript-typescript",
    );
  });

  it("reports a write permission beyond code scanning", () => {
    const edited = TEXT.replace(
      "      contents: read\n      security-events: write\n",
      "      contents: write\n      security-events: write\n",
    );
    expect(edited).not.toEqual(TEXT);
    expect(problems(parseWorkflow(edited))).toContain(
      "analyze permissions must be contents read and security-events write",
    );
  });
});
