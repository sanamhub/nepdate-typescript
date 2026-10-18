// Gate 12 (T9-02): the committed public API snapshot and the signatures in docs/API.md.
// Run from the repository root: `node scripts/api-check.ts` or `node scripts/api-check.ts --write`.
//
// The only update path is --write. A documented addition still fails until the snapshot is written.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  documentedErrors,
  entryCount,
  PACKAGES,
  readDocumentedSurface,
  readLiveSurface,
  readSnapshot,
  snapshotText,
  staleSnapshotErrors,
} from "./api-surface.ts";

const ROOT = resolve(import.meta.dirname, "..");
const SNAPSHOT = join(ROOT, "docs", "api-snapshot.json");
const DOCS = join(ROOT, "docs", "API.md");
const write = process.argv.includes("--write");
const unknown = process.argv.slice(2).filter((argument) => argument !== "--write");

function fail(message: string): never {
  console.error(`api-check: ${message}`);
  process.exit(1);
}

if (unknown.length > 0) fail(`unknown argument ${unknown.join(", ")}`);

const live = readLiveSurface(PACKAGES, ROOT);
const documented = readDocumentedSurface(readFileSync(DOCS, "utf8"));
const count = entryCount(live);

if (write) {
  // Check the contract before writing, so an undocumented export cannot be frozen by accident.
  const problems = documentedErrors(live, documented);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`api-check: ${problem}`);
    fail("docs/API.md must have every declaration before the snapshot is written");
  }
  writeFileSync(SNAPSHOT, snapshotText(live));
  const written = readSnapshot(readFileSync(SNAPSHOT, "utf8"));
  const stale = staleSnapshotErrors(live, written);
  if (stale.length > 0) {
    for (const problem of stale) console.error(`api-check: ${problem}`);
    fail("the written snapshot does not match the live surface");
  }
  console.log(
    `api-check: wrote ${count} entries for ${PACKAGES.length} packages to docs/api-snapshot.json`,
  );
} else {
  if (!existsSync(SNAPSHOT))
    fail("docs/api-snapshot.json is missing; run node scripts/api-check.ts --write");
  const snapshot = readSnapshot(readFileSync(SNAPSHOT, "utf8"));
  const errors = [...staleSnapshotErrors(live, snapshot), ...documentedErrors(live, documented)];
  if (errors.length > 0) {
    for (const error of errors) console.error(`api-check: ${error}`);
    fail(`${errors.length} problem(s)`);
  }
  console.log(
    `api-check: ${count} entries for ${PACKAGES.length} packages match docs/api-snapshot.json and docs/API.md`,
  );
}
