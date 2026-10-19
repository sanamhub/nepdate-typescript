// Shared workflow rules. The pin and expression checks used to live in the release and mutation
// tests; they live here once so a new workflow gets the same rules.

import {
  actionUses,
  isMapping,
  jobsOf,
  runScripts,
  type Workflow,
  workflowPermissions,
} from "./workflow-yaml.js";

const PIN = /^[^@\s]+@[0-9a-f]{40}$/;
const EXPRESSION = "${{";
const RUN_EXPRESSION = /\$\{\{[\s\S]*?\}\}/g;

interface UseLine {
  action: string;
  comment: string | undefined;
}

// A live `uses` line carries the pin and its version comment. A commented-out line does not match.
function useLines(text: string): UseLine[] {
  const found: UseLine[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:-\s*)?uses:\s*(\S+)(?:\s+#\s*(.*))?\s*$/.exec(line);
    if (match === null) continue;
    found.push({ action: match[1] as string, comment: match[2] });
  }
  return found;
}

export function pinProblems(workflow: Workflow): string[] {
  const found: string[] = [];
  for (const action of actionUses(workflow)) {
    if (action.startsWith("./")) continue;
    if (!PIN.test(action)) {
      found.push(`action ${action} is not pinned by a 40-character SHA`);
    }
  }
  return found;
}

export function pinCommentProblems(workflow: Workflow, text: string): string[] {
  const found: string[] = [];
  const lines = useLines(text);
  for (const action of actionUses(workflow)) {
    if (action.startsWith("./")) continue;
    const matches = lines.filter((line) => line.action === action);
    if (matches.length === 0 || matches.some((line) => (line.comment ?? "").trim() === "")) {
      found.push(`action ${action} has no version comment`);
    }
  }
  return found;
}

export function expressionProblems(workflow: Workflow, allowed: readonly string[] = []): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const script of runScripts(workflow)) {
    const expressions = script.text.match(RUN_EXPRESSION) ?? [];
    for (const expression of expressions) {
      if (allowed.includes(expression)) seen.add(expression);
    }
    if (expressions.some((expression) => !allowed.includes(expression))) {
      found.push(
        `${script.job} step "${script.step}" puts an ${EXPRESSION} expression inside run; pass it through env`,
      );
    }
  }
  for (const entry of allowed) {
    if (!seen.has(entry)) found.push(`expression allow-list entry "${entry}" is stale`);
  }
  return found;
}

export function checkoutProblems(
  workflow: Workflow,
  allowedJobs: readonly string[] = [],
): string[] {
  const found: string[] = [];
  const used = new Set<string>();
  for (const [jobName, jobValue] of Object.entries(jobsOf(workflow))) {
    if (!isMapping(jobValue) || !Array.isArray(jobValue.steps)) continue;
    for (const stepValue of jobValue.steps) {
      if (
        !isMapping(stepValue) ||
        typeof stepValue.uses !== "string" ||
        !stepValue.uses.startsWith("actions/checkout@")
      ) {
        continue;
      }
      const withMap = isMapping(stepValue.with) ? stepValue.with : undefined;
      if (withMap?.["persist-credentials"] === false) continue;
      if (allowedJobs.includes(jobName)) {
        used.add(jobName);
        continue;
      }
      found.push(`checkout in job ${jobName} must set persist-credentials: false`);
    }
  }
  for (const entry of allowedJobs) {
    if (!used.has(entry)) found.push(`checkout allow-list entry "${entry}" is stale`);
  }
  return found;
}

export function topPermissionsProblems(workflow: Workflow): string[] {
  return workflowPermissions(workflow) === undefined
    ? ["workflow must set top-level permissions"]
    : [];
}
