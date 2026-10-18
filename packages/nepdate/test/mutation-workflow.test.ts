// ADR-0007: mutation testing is a weekly and release check, never a pull-request check.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const WORKFLOW = readFileSync(join(ROOT, ".github", "workflows", "mutation.yml"), "utf8");

describe("weekly mutation workflow", () => {
  it("runs on a schedule and manual dispatch, never on a pull request", () => {
    expect(WORKFLOW).toContain("schedule:");
    expect(WORKFLOW).toContain("cron:");
    expect(WORKFLOW).toContain("workflow_dispatch:");
    expect(WORKFLOW).not.toContain("pull_request");
  });

  it("runs the mutation suite and the floor check", () => {
    expect(WORKFLOW).toContain("npm run mutation:force");
    expect(WORKFLOW).toContain("npm run mutation:check");
  });

  it("pins every action by SHA and reads no secret", () => {
    for (const match of WORKFLOW.matchAll(/uses:\s*(\S+)/g)) {
      expect(match[1]).toMatch(/@[0-9a-f]{40}$/);
    }
    expect(WORKFLOW).not.toContain("secrets.");
  });
});
