// The workflow tests read GitHub Actions YAML as a parsed tree, not as text, so a comment, an
// indentation change or a step moved to another job cannot satisfy a rule by accident.

import { parse } from "yaml";

export type Mapping = Record<string, unknown>;
export type Workflow = Mapping;
export type Job = Mapping;
export type Step = Mapping;

export interface RunScript {
  job: string;
  step: string;
  text: string;
}

export function isMapping(value: unknown): value is Mapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseWorkflow(text: string): Workflow {
  const value: unknown = parse(text);
  if (!isMapping(value)) throw new Error("workflow must parse to a mapping");
  return value;
}

export function jobsOf(workflow: Workflow): Mapping {
  const value = workflow.jobs;
  return isMapping(value) ? value : {};
}

export function job(workflow: Workflow, name: string): Job | undefined {
  const value = jobsOf(workflow)[name];
  return isMapping(value) ? value : undefined;
}

export function stepsOf(workflow: Workflow, jobName: string): Step[] {
  const value = job(workflow, jobName)?.steps;
  if (!Array.isArray(value)) return [];
  return value.filter(isMapping);
}

export function step(workflow: Workflow, jobName: string, stepName: string): Step | undefined {
  return stepsOf(workflow, jobName).find((candidate) => candidate.name === stepName);
}

export function stepIndex(workflow: Workflow, jobName: string, stepName: string): number {
  return stepsOf(workflow, jobName).findIndex((candidate) => candidate.name === stepName);
}

export function stepRun(stepValue: Step): string {
  return typeof stepValue.run === "string" ? stepValue.run : "";
}

export function jobRun(workflow: Workflow, jobName: string): string {
  return stepsOf(workflow, jobName)
    .map((stepValue) => stepRun(stepValue))
    .join("\n");
}

export function stepEnv(stepValue: Step): Mapping | undefined {
  return isMapping(stepValue.env) ? stepValue.env : undefined;
}

export function stepWith(stepValue: Step): Mapping | undefined {
  return isMapping(stepValue.with) ? stepValue.with : undefined;
}

export function textValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export function envValue(stepValue: Step, key: string): string | undefined {
  return textValue(stepEnv(stepValue)?.[key]);
}

export function withValue(stepValue: Step, key: string): string | undefined {
  return textValue(stepWith(stepValue)?.[key]);
}

export function needsOf(workflow: Workflow, jobName: string): string[] {
  const value = job(workflow, jobName)?.needs;
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function permissionMap(value: unknown): Record<string, string> | undefined {
  if (!isMapping(value)) return undefined;
  const result: Record<string, string> = {};
  for (const [key, child] of Object.entries(value)) {
    if (typeof child !== "string") return undefined;
    result[key] = child;
  }
  return result;
}

export function workflowPermissions(workflow: Workflow): Record<string, string> | undefined {
  return permissionMap(workflow.permissions);
}

export function jobPermissions(
  workflow: Workflow,
  jobName: string,
): Record<string, string> | undefined {
  return permissionMap(job(workflow, jobName)?.permissions);
}

export function triggers(workflow: Workflow): string[] {
  const value = workflow.on;
  if (isMapping(value)) return Object.keys(value);
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

export function trigger(workflow: Workflow, name: string): unknown {
  const value = workflow.on;
  return isMapping(value) ? value[name] : undefined;
}

export function actionUses(value: unknown): string[] {
  const found: string[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isMapping(node)) return;
    for (const [key, child] of Object.entries(node)) {
      if (key === "uses" && typeof child === "string") found.push(child);
      else visit(child);
    }
  };
  visit(value);
  return found;
}

export function stringValues(value: unknown): string[] {
  const found: string[] = [];
  const visit = (node: unknown): void => {
    if (typeof node === "string") {
      found.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isMapping(node)) return;
    for (const child of Object.values(node)) visit(child);
  };
  visit(value);
  return found;
}

export function runScripts(workflow: Workflow): RunScript[] {
  const found: RunScript[] = [];
  for (const [jobName, jobValue] of Object.entries(jobsOf(workflow))) {
    if (!isMapping(jobValue) || !Array.isArray(jobValue.steps)) continue;
    for (const stepValue of jobValue.steps) {
      if (!isMapping(stepValue) || typeof stepValue.run !== "string") continue;
      const name = typeof stepValue.name === "string" ? stepValue.name : "(unnamed)";
      found.push({ job: jobName, step: name, text: stepValue.run });
    }
  }
  return found;
}
