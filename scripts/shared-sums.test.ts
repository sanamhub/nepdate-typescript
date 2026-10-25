// Tests for the shared checksum gate (ADR-0012). Every case uses a temporary tree; the real
// manifest is checked once at the end, but never written.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { manifestFor, manifestProblems, sharedFiles, writeManifest } from "./shared-sums.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = resolve(ROOT, "scripts/shared-sums.ts");
const MANIFEST = join("scripts/shared.sha256");
const VERSION = "a".repeat(40);

function rootFor(t: TestContext): string {
  const root = mkdtempSync(join(tmpdir(), "nepdate-shared-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "shared", "data"), { recursive: true });
  mkdirSync(join(root, "shared", "spec"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(join(root, "shared", "VERSION"), `${VERSION}\n`);
  writeFileSync(join(root, "shared", "data", "calendar.txt"), "calendar\n");
  writeFileSync(join(root, "shared", "spec", "spec.md"), "# spec\n");
  writeFileSync(join(root, MANIFEST), manifestFor(root));
  return root;
}

function manifest(root: string): string {
  return readFileSync(join(root, MANIFEST), "utf8");
}

function pythonCommand(): string {
  return process.env.SHARED_PYTHON ?? (process.platform === "win32" ? "py" : "python3");
}

function fakeHub(root: string, code: number): string {
  const hub = join(root, "hub");
  mkdirSync(join(hub, "tools"), { recursive: true });
  const body = [
    "import sys",
    'if sys.argv[1:] != [".", "--check"]:',
    '    print("unexpected arguments", file=sys.stderr)',
    "    sys.exit(2)",
    code === 0 ? 'print("hub says yes")' : 'print("hub says no")',
    `sys.exit(${code})`,
    "",
  ].join("\n");
  writeFileSync(join(hub, "tools", "shared_sync.py"), body);
  return hub;
}

function runWrite(root: string, hub: string) {
  return spawnSync(process.execPath, [SCRIPT, "--write", hub], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SHARED_PYTHON: pythonCommand() },
  });
}

test("a matching tree passes", (t) => {
  const root = rootFor(t);
  assert.deepEqual(manifestProblems(root, manifest(root)), []);
});

test("a missing file fails with its path", (t) => {
  const root = rootFor(t);
  rmSync(join(root, "shared", "data", "calendar.txt"));
  assert.deepEqual(manifestProblems(root, manifest(root)), [
    "shared/data/calendar.txt is listed but missing",
  ]);
});

test("an extra file fails with its path", (t) => {
  const root = rootFor(t);
  writeFileSync(join(root, "shared", "spec", "extra.md"), "extra\n");
  assert.deepEqual(manifestProblems(root, manifest(root)), [
    "shared/spec/extra.md is present but not listed",
  ]);
});

test("one changed byte fails with its path and hashes", (t) => {
  const root = rootFor(t);
  writeFileSync(join(root, "shared", "data", "calendar.txt"), "calendaR\n");
  const problems = manifestProblems(root, manifest(root));
  assert.equal(problems.length, 1);
  assert.match(
    problems[0] as string,
    /^shared\/data\/calendar\.txt has SHA-256 [0-9a-f]{64}, expected/,
  );
});

test("a wrong header fails", (t) => {
  const root = rootFor(t);
  const lines = manifest(root).split("\n");
  lines[0] = `# hub ${"b".repeat(40)}`;
  const problems = manifestProblems(root, lines.join("\n"));
  assert.equal(problems.length, 1);
  assert.match(problems[0] as string, /^header is "# hub b{40}", expected "# hub a{40}"$/);
});

test("a bad VERSION fails", (t) => {
  const root = rootFor(t);
  writeFileSync(join(root, "shared", "VERSION"), "not-a-commit\n");
  assert.deepEqual(manifestProblems(root, manifest(root)), [
    'shared/VERSION is not a full 40-character hex commit: "not-a-commit"',
  ]);
});

test("a malformed digest fails", (t) => {
  const root = rootFor(t);
  const lines = manifest(root).split("\n");
  lines[1] = `${"z".repeat(64)}  shared/data/calendar.txt`;
  const problems = manifestProblems(root, lines.join("\n"));
  assert.equal(problems.length, 2);
  assert.match(problems[0] as string, /^line 2 is malformed: /);
  assert.equal(problems[1], "shared/data/calendar.txt is present but not listed");
});

test("a successful write replaces the manifest", (t) => {
  const root = rootFor(t);
  writeFileSync(join(root, MANIFEST), "stale\n");
  const written = writeManifest(root);
  assert.equal(written.version, VERSION);
  assert.equal(written.files, 2);
  assert.deepEqual(manifestProblems(root, manifest(root)), []);
});

test("a failed hub check leaves the manifest unchanged", (t) => {
  const root = rootFor(t);
  writeFileSync(join(root, MANIFEST), "stale\n");
  const result = runWrite(root, fakeHub(root, 1));
  assert.equal(result.status, 1, result.stderr);
  assert.equal(manifest(root), "stale\n");
  assert.match(`${result.stdout}${result.stderr}`, /hub says no/);
  assert.match(`${result.stdout}${result.stderr}`, /hub check failed with exit 1/);
});

test("a successful hub check writes the manifest", (t) => {
  const root = rootFor(t);
  writeFileSync(join(root, MANIFEST), "stale\n");
  const result = runWrite(root, fakeHub(root, 0));
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    `${result.stdout}${result.stderr}`,
    /shared-sums: wrote scripts\/shared\.sha256 \(2 files\)/,
  );
  assert.deepEqual(manifestProblems(root, manifest(root)), []);
});

test("the committed manifest matches the real shared tree", () => {
  const text = readFileSync(join(ROOT, "scripts/shared.sha256"), "utf8");
  assert.deepEqual(manifestProblems(ROOT, text), []);
  assert.equal(text.trimEnd().split("\n").length - 1, sharedFiles(ROOT).length);
});
