// Every workflow file gets a parsed test. The directory listing is the source of truth, so a new
// file fails until it has a dedicated test and the shared rules pass.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkoutProblems,
  expressionProblems,
  pinCommentProblems,
  pinProblems,
  topPermissionsProblems,
} from "./workflow-rules.js";
import { parseWorkflow, type Workflow } from "./workflow-yaml.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const WORKFLOW_DIR = join(ROOT, ".github", "workflows");
const TEST_DIR = join(ROOT, "packages", "nepdate", "test");
const EXPRESSION = "${{";

// One map, so an unmapped workflow fails with its file name.
export const DEDICATED_TESTS: Readonly<Record<string, string>> = {
  "ci.yml": "ci-workflow.test.ts",
  "mutation.yml": "mutation-workflow.test.ts",
  "release.yml": "release-workflow.test.ts",
  "shared-sync.yml": "shared-sync-workflow.test.ts",
};

// No job needs persisted credentials. Every checkout only reads the repository.
const CHECKOUT_ALLOWLIST: readonly string[] = [];

// Every value reaches a run through env. Keep exact expressions here if one ever needs an exception.
const RUN_EXPRESSION_ALLOWLIST: readonly string[] = [];

function expression(text: string): string {
  return `${EXPRESSION} ${text} }}`;
}

export function workflowFiles(): string[] {
  return readdirSync(WORKFLOW_DIR)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort();
}

export function coverageProblems(
  files: readonly string[],
  tests: Readonly<Record<string, string>>,
  hasTest: (name: string) => boolean,
): string[] {
  const found: string[] = [];
  for (const file of files) {
    const testFile = tests[file];
    if (testFile === undefined) {
      found.push(`${file} has no dedicated test file`);
      continue;
    }
    if (!hasTest(testFile)) found.push(`${file} points to a missing test file ${testFile}`);
  }
  for (const [file, testFile] of Object.entries(tests)) {
    if (!files.includes(file)) found.push(`${file} test map entry is stale`);
    if (!hasTest(testFile)) found.push(`${file} test file ${testFile} is missing`);
  }
  return found;
}

export function sharedWorkflowProblems(
  workflow: Workflow,
  text: string,
  checkoutAllowlist: readonly string[] = CHECKOUT_ALLOWLIST,
  expressionAllowlist: readonly string[] = RUN_EXPRESSION_ALLOWLIST,
): string[] {
  return [
    ...topPermissionsProblems(workflow),
    ...pinProblems(workflow),
    ...pinCommentProblems(workflow, text),
    ...checkoutProblems(workflow, checkoutAllowlist),
    ...expressionProblems(workflow, expressionAllowlist),
  ];
}

function testExists(name: string): boolean {
  return existsSync(join(TEST_DIR, name));
}

function replaceFirst(text: string, from: string, to: string): string {
  const at = text.indexOf(from);
  expect(at, `expected ${from}`).toBeGreaterThanOrEqual(0);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

const FILES = workflowFiles();
const CI_TEXT = readFileSync(join(WORKFLOW_DIR, "ci.yml"), "utf8");
const CI_PARSED = parseWorkflow(CI_TEXT);

describe("workflow coverage", () => {
  it("discovers every workflow file", () => {
    expect(FILES.length).toBeGreaterThan(0);
    expect(FILES).toContain("ci.yml");
    expect(FILES).toContain("mutation.yml");
    expect(FILES).toContain("release.yml");
    expect(FILES).toContain("shared-sync.yml");
  });

  it("maps every workflow file to a dedicated test", () => {
    expect(coverageProblems(FILES, DEDICATED_TESTS, testExists)).toEqual([]);
  });

  for (const file of FILES) {
    const text = readFileSync(join(WORKFLOW_DIR, file), "utf8");
    const workflow = parseWorkflow(text);
    it(`${file} satisfies the shared rules`, () => {
      expect(sharedWorkflowProblems(workflow, text)).toEqual([]);
    });
  }

  it("reports a workflow file with no dedicated test", () => {
    const found = coverageProblems([...FILES, "new.yml"], DEDICATED_TESTS, testExists);
    expect(found).toContain("new.yml has no dedicated test file");
  });

  it("reports an unpinned action", () => {
    const edited = replaceFirst(
      CI_TEXT,
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "actions/checkout@v7",
    );
    expect(edited).not.toEqual(CI_TEXT);
    expect(pinProblems(parseWorkflow(edited))).toContain(
      "action actions/checkout@v7 is not pinned by a 40-character SHA",
    );
  });

  it("reports a checkout without persist-credentials: false", () => {
    const edited = replaceFirst(
      CI_TEXT,
      "        with:\n          persist-credentials: false\n",
      "",
    );
    expect(edited).not.toEqual(CI_TEXT);
    expect(checkoutProblems(parseWorkflow(edited))).toContain(
      "checkout in job ci must set persist-credentials: false",
    );
  });

  it("reports an expression inside a run", () => {
    const edited = replaceFirst(
      CI_TEXT,
      "      - run: npm run ci\n",
      `      - run: echo "${expression("github.event.pull_request.title")}"\n`,
    );
    expect(edited).not.toEqual(CI_TEXT);
    const expected = `ci step "(unnamed)" puts an ${EXPRESSION} expression inside run; pass it through env`;
    expect(expressionProblems(parseWorkflow(edited), RUN_EXPRESSION_ALLOWLIST)).toContain(expected);
  });

  it("reports a stale run expression allow-list entry", () => {
    expect(expressionProblems(CI_PARSED, [expression("matrix.os")])).toContain(
      `expression allow-list entry "${expression("matrix.os")}" is stale`,
    );
  });

  it("reports a stale checkout allow-list entry", () => {
    expect(checkoutProblems(CI_PARSED, ["ci"])).toContain(
      'checkout allow-list entry "ci" is stale',
    );
  });
});
