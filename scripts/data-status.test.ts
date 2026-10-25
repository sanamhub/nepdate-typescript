// Fixed-date tests for the data freshness gate (ADR-0011) on the real built patro tables.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = resolve(ROOT, "scripts/data-status.ts");

function run(args: readonly string[]): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("AD 2027-06-03 passes with 183 holiday days left", () => {
  const result = run(["--today", "2027-06-03"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /holidays: .*183 days left/);
  assert.match(result.stdout, /today \(AD\): 2027-06-03/);
  assert.match(result.stdout, /WARNING: tithi data ends in -51 days/);
  assert.doesNotMatch(result.stderr, /FAIL/);
});

test("AD 2027-06-04 fails with 182 holiday days left", () => {
  const result = run(["--today", "2027-06-04"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /holidays: .*182 days left/);
  assert.match(result.stderr, /FAIL: public holiday data ends in 182 days/);
});

test("help names the AD flag and the UTC default", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--today\s+AD date to count from/);
  assert.match(result.stdout, /default: current UTC date/);
});

test("an impossible AD date exits 2", () => {
  const result = run(["--today", "2027-02-30"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not a real date/);
});

test("a missing --today value exits 2", () => {
  const result = run(["--today"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage:/);
});
