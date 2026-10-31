// The shared-sync workflow keeps its weekly schedule, the hub reusable workflow it calls by a full
// commit, the caller permissions that lets the reusable workflow open a pull request, and the
// port's regenerate command. The checks run on the parsed YAML tree, so a comment or a moved value
// cannot satisfy a rule by accident.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import {
  expressionProblems,
  pinCommentProblems,
  pinProblems,
  remoteReusableProblems,
  topPermissionsProblems,
} from "./workflow-rules.js";
import {
  isMapping,
  job,
  jobPermissions,
  jobsOf,
  parseWorkflow,
  textValue,
  trigger,
  triggers,
  type Workflow,
  workflowPermissions,
} from "./workflow-yaml.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FILE = "shared-sync.yml";
const TEXT = readFileSync(join(ROOT, ".github", "workflows", FILE), "utf8");
const PARSED = parseWorkflow(TEXT);

const HUB =
  "sanamhub/nepdate/.github/workflows/shared-sync.yml@f94d67c0c85de7909cf54d7e4e96f226ca750129";
const CRON = "45 3 * * 2";
const REGENERATE = "npm ci && npm run codegen";
// biome-ignore lint/suspicious/noTemplateCurlyInString: the test compares the literal expression
const SECRET = "${{ secrets.SYNC_APP_PRIVATE_KEY }}";
const CALLER_PERMISSIONS = {
  actions: "write",
  contents: "write",
  "pull-requests": "write",
};

function scheduleCron(workflow: Workflow): string | undefined {
  const schedule = trigger(workflow, "schedule");
  if (!Array.isArray(schedule) || schedule.length !== 1 || !isMapping(schedule[0]))
    return undefined;
  return textValue(schedule[0].cron);
}

function sharedSyncProblems(workflow: Workflow): string[] {
  const found: string[] = [];
  if (!isDeepStrictEqual(triggers(workflow).sort(), ["schedule", "workflow_dispatch"])) {
    found.push("shared-sync triggers must be exactly schedule and workflow_dispatch");
  }
  if (scheduleCron(workflow) !== CRON) {
    found.push(`shared-sync schedule must be the single cron ${CRON}`);
  }
  if (!isDeepStrictEqual(workflowPermissions(workflow), { contents: "read" })) {
    found.push("shared-sync workflow permissions must be exactly contents: read");
  }
  const names = Object.keys(jobsOf(workflow)).sort();
  if (!isDeepStrictEqual(names, ["sync"])) {
    found.push("shared-sync job set must be exactly sync");
  }
  const sync = job(workflow, "sync");
  if (sync === undefined) {
    found.push("shared-sync must have a sync job");
    return found;
  }
  if (textValue(sync.uses) !== HUB) {
    found.push(`sync must call the hub reusable workflow ${HUB}`);
  }
  if (!isDeepStrictEqual(jobPermissions(workflow, "sync"), CALLER_PERMISSIONS)) {
    found.push("sync must grant contents, pull-requests and actions write");
  }
  const withMap = isMapping(sync.with) ? sync.with : undefined;
  if (textValue(withMap?.regenerate) !== REGENERATE) {
    found.push(`sync regenerate must be exactly ${REGENERATE}`);
  }
  const secrets = isMapping(sync.secrets) ? sync.secrets : undefined;
  if (textValue(secrets?.SYNC_APP_PRIVATE_KEY) !== SECRET) {
    found.push("sync must pass SYNC_APP_PRIVATE_KEY from the repository secret");
  }
  return found;
}

function sharedRuleProblems(workflow: Workflow, text: string): string[] {
  return [
    ...topPermissionsProblems(workflow),
    ...pinProblems(workflow),
    ...pinCommentProblems(workflow, text),
    ...remoteReusableProblems(workflow),
    ...expressionProblems(workflow),
  ];
}

describe("shared-sync workflow", () => {
  it("satisfies every rule", () => {
    expect(sharedSyncProblems(PARSED)).toEqual([]);
    expect(sharedRuleProblems(PARSED, TEXT)).toEqual([]);
  });

  it("reports a different schedule", () => {
    const edited = TEXT.replace(`cron: "${CRON}"`, 'cron: "45 3 * * 3"');
    expect(edited).not.toEqual(TEXT);
    expect(sharedSyncProblems(parseWorkflow(edited))).toContain(
      `shared-sync schedule must be the single cron ${CRON}`,
    );
  });

  it("reports a floating hub ref", () => {
    const edited = TEXT.replace(HUB, "sanamhub/nepdate/.github/workflows/shared-sync.yml@main");
    expect(edited).not.toEqual(TEXT);
    expect(remoteReusableProblems(parseWorkflow(edited))).toContain(
      "job sync calls sanamhub/nepdate/.github/workflows/shared-sync.yml@main, which is not a hub reusable workflow pinned by a 40-character SHA (ADR-0017)",
    );
  });

  it("reports missing caller permissions", () => {
    const edited = TEXT.replace(
      "    permissions:\n      contents: write\n      pull-requests: write\n      actions: write\n",
      "",
    );
    expect(edited).not.toEqual(TEXT);
    expect(sharedSyncProblems(parseWorkflow(edited))).toContain(
      "sync must grant contents, pull-requests and actions write",
    );
  });
});
