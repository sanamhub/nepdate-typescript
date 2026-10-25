// Tests for runnable TSDoc examples (ADR-0010). The failing cases are a new export without an
// example, an example with a wrong `// =>` value, and an example with no result comment.

import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  ALLOW_LIST,
  checkExamples,
  collectExamples,
  compileExample,
  coverageErrors,
  runExamples,
} from "./examples.ts";

const ROOT = resolve(import.meta.dirname, "..");

function fixture(typeScript: string): {
  entry: string;
  cleanup: () => void;
} {
  const base = join(ROOT, ".readme-check");
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, "fixture-"));
  const entry = join(dir, "index.d.ts");
  writeFileSync(entry, `${typeScript}\n`);
  return { entry, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function declarations(typeScript: string) {
  const file = fixture(typeScript);
  try {
    return collectExamples([{ name: "nepdate-core", entry: file.entry }], ROOT);
  } finally {
    file.cleanup();
  }
}

test("a new export without an example fails", () => {
  const result = coverageErrors(declarations("export declare function newThing(): string;"), []);
  assert.equal(result.length, 1);
  assert.match(result[0] as string, /nepdate-core:newThing has no @example/);
});

test("an example with no result comment does not count", () => {
  const result = coverageErrors(
    declarations(
      [
        "/**",
        " * @example",
        " * monthName(2);",
        " */",
        "export declare function monthName(month: number): string;",
      ].join("\n"),
    ),
    [],
  );
  assert.equal(result.length, 1);
  assert.match(result[0] as string, /monthName has an @example with no \/\/ => result/);
});

test("an example with a wrong result fails", () => {
  const value = declarations(
    [
      "/**",
      " * @example",
      ' * monthName(2); // => "Wrong"',
      " */",
      "export declare function monthName(month: number): string;",
    ].join("\n"),
  );
  const result = runExamples(value, ROOT);
  assert.equal(result.examples, 1);
  assert.equal(result.assertions, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0] as string, /nepdate-core:monthName example 1/);
  assert.match(result.errors[0] as string, /Wrong/);
});

test("a correct example passes", () => {
  const value = declarations(
    [
      "/**",
      " * @example",
      ' * monthName(2); // => "Jestha"',
      " */",
      "export declare function monthName(month: number): string;",
    ].join("\n"),
  );
  const result = runExamples(value, ROOT);
  assert.deepEqual(result.errors, []);
  assert.equal(result.assertions, 1);
});

test("compileExample rejects a statement before a result comment", () => {
  assert.throws(
    () => compileExample("fixture", "const value = 1; // => 1"),
    /must follow a single expression/,
  );
});

test("the allow-list has only today, with a reason", () => {
  assert.equal(ALLOW_LIST.length, 1);
  assert.equal(ALLOW_LIST[0]?.label, "nepdate-core:NepaliDate.today");
  assert.ok((ALLOW_LIST[0]?.reason.length ?? 0) > 20);
});

test("checkExamples reports a missing example before running anything", () => {
  const file = fixture("export declare function newThing(): string;");
  try {
    const result = checkExamples([{ name: "nepdate-core", entry: file.entry }], ROOT);
    assert.equal(result.examples, 0);
    assert.match(result.errors[0] as string, /has no @example/);
  } finally {
    file.cleanup();
  }
});

test("an allow-list entry whose examples all have results is stale", () => {
  const result = coverageErrors(
    declarations(
      [
        "/**",
        " * @example",
        ' * monthName(2); // => "Jestha"',
        " */",
        "export declare function monthName(month: number): string;",
      ].join("\n"),
    ),
    [{ label: "nepdate-core:monthName" }],
  );
  assert.equal(result.length, 1);
  assert.match(result[0] as string, /allow-list entry nepdate-core:monthName is stale/);
});
