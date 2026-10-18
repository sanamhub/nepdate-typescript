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
