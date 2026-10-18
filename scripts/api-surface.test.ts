// Tests for the public API surface check (T9-02). The negative controls are the five changes that
// must fail: a rename, a signature change, an undocumented addition, a documented addition with a
// stale snapshot, and a name that appears only in prose.

import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  documentedErrors,
  readDocumentedSurface,
  readLiveSurface,
  readSnapshot,
  type Surface,
  snapshotText,
  staleSnapshotErrors,
} from "./api-surface.ts";

const BASE = [
  "export declare function alpha(value: string): number;",
  "export declare class Thing {",
  "  readonly name: string;",
  "  static make(value: number): Thing;",
  "}",
].join("\n");

function liveSurface(typeScript: string): Surface {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "api-surface-"));
  try {
    writeFileSync(join(dir, "index.d.ts"), `${typeScript}\n`);
    return readLiveSurface([{ name: "nepdate", entry: "index.d.ts" }], dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function apiDocs(typeScript: string): string {
  return ["# API", "", "```ts", '// "nepdate"', typeScript, "```", ""].join("\n");
}

function errors(live: Surface, snapshot: Surface, documented: Surface): string[] {
  return [...staleSnapshotErrors(live, snapshot), ...documentedErrors(live, documented)];
}

const baseLive = liveSurface(BASE);
const baseDocs = readDocumentedSurface(apiDocs(BASE));

test("a matching live surface, snapshot and API.md pass", () => {
  assert.deepEqual(errors(baseLive, baseLive, baseDocs), []);
});

test("a renamed export fails against the stale snapshot", () => {
  const renamed = liveSurface(BASE.replace("alpha", "renamed"));
  const result = staleSnapshotErrors(renamed, baseLive);
  assert.equal(result.length, 1);
  assert.match(result[0] as string, /missing export function renamed/);
  assert.match(result[0] as string, /stale export function alpha/);
  assert.match(result[0] as string, /--write/);
});

test("a changed signature fails against the stale snapshot", () => {
  const changed = liveSurface(
    BASE.replace("alpha(value: string): number", "alpha(value: number): number"),
  );
  const result = staleSnapshotErrors(changed, baseLive);
  assert.equal(result.length, 1);
  assert.match(result[0] as string, /alpha\(value: number\): number/);
  assert.match(result[0] as string, /--write/);
});

test("an undocumented addition fails the API.md check", () => {
  const withBeta = `${BASE}\nexport declare function beta(): string;`;
  const live = liveSurface(withBeta);
  const result = documentedErrors(live, baseDocs);
  assert.equal(result.length, 1);
  assert.match(result[0] as string, /no declaration for nepdate: export function beta\(\): string/);
});

test("a documented addition still fails until the snapshot is written", () => {
  const withBeta = `${BASE}\nexport declare function beta(): string;`;
  const live = liveSurface(withBeta);
  const documented = readDocumentedSurface(apiDocs(withBeta));
  const result = staleSnapshotErrors(live, baseLive);
  assert.equal(result.length, 1);
  assert.match(result[0] as string, /missing export function beta/);
  assert.match(result[0] as string, /--write/);
  assert.deepEqual(documentedErrors(live, documented), []);
});

test("a name only in prose does not document the export", () => {
  const withBeta = `${BASE}\nexport declare function beta(): string;`;
  const live = liveSurface(withBeta);
  const prose = readDocumentedSurface(`${apiDocs(BASE)}\n\`beta\` is exported.\n`);
  const result = documentedErrors(live, prose);
  assert.equal(result.length, 1);
  assert.match(result[0] as string, /no declaration for nepdate: export function beta/);
});

test("snapshotText is sorted, deduplicated and round-trips", () => {
  const surface = {
    fixture: [
      "export function z(): void",
      "export function a(): void",
      "export function a(): void",
    ],
  };
  const text = snapshotText(surface);
  assert.match(text, /"export function a\(\): void",\n\s+"export function z\(\): void"/);
  assert.deepEqual(readSnapshot(text), {
    fixture: ["export function a(): void", "export function z(): void"],
  });
});

const CLASS_BASE = [
  "export declare class NepaliDate {",
  "  readonly year: number;",
  "  get weekday(): number;",
  "  addDays(n: number): NepaliDate;",
  "  static of(year: number, month: number, day: number): NepaliDate;",
  "}",
].join("\n");
const classLive = liveSurface(CLASS_BASE);

test("a changed method signature on a class fails against the stale snapshot", () => {
  const changed = liveSurface(
    CLASS_BASE.replace("addDays(n: number): NepaliDate", "addDays(n: bigint): NepaliDate"),
  );
  const result = staleSnapshotErrors(changed, classLive);
  assert.equal(result.length, 1);
  assert.match(result[0] as string, /missing NepaliDate addDays\(n: bigint\): NepaliDate/);
  assert.match(result[0] as string, /stale NepaliDate addDays\(n: number\): NepaliDate/);
});

test("a removed getter fails against the stale snapshot", () => {
  const removed = liveSurface(CLASS_BASE.replace("  get weekday(): number;\n", ""));
  const result = staleSnapshotErrors(removed, classLive);
  assert.equal(result.length, 1);
  assert.match(result[0] as string, /stale NepaliDate get weekday\(\): number/);
});

test("a static factory that changes its return type fails", () => {
  const changed = liveSurface(
    CLASS_BASE.replace(
      "static of(year: number, month: number, day: number): NepaliDate",
      "static of(year: number, month: number, day: number): NepaliDate | null",
    ),
  );
  assert.equal(staleSnapshotErrors(changed, classLive).length, 1);
});

test("every overload of a function is its own entry", () => {
  const live = liveSurface(
    [
      "export declare function pick(value: string): string;",
      "export declare function pick(value: number): number;",
    ].join("\n"),
  );
  assert.deepEqual(live.nepdate, [
    "export function pick(value: number): number",
    "export function pick(value: string): string",
  ]);
});

test("an exported const is part of the surface", () => {
  const live = liveSurface("export declare const LIMIT: number;");
  assert.deepEqual(live.nepdate, ["export const LIMIT: number"]);
});

test("an export kind the reader does not know fails loudly instead of vanishing", () => {
  assert.throws(
    () => liveSurface("export declare enum Mode { A, B }"),
    /unsupported EnumDeclaration/,
  );
});

test("a TSDoc comment inside an option type does not change the surface", () => {
  const plain = liveSurface(
    "export declare function f(opts?: { readonly pad?: boolean }): string;",
  );
  const commented = liveSurface(
    "export declare function f(opts?: {\n  /** Pad with zeros. */\n  readonly pad?: boolean;\n}): string;",
  );
  assert.deepEqual(commented, plain);
});

test("a protected member is part of the surface", () => {
  const live = liveSurface("export declare class Base {\n  protected step(): void;\n}");
  assert.deepEqual(live.nepdate, ["Base protected step(): void", "export class Base"]);
});
