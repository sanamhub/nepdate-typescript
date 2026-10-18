import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

const SCRIPT = fileURLToPath(new URL("../../../scripts/release-check.ts", import.meta.url));
const VERSION_SCRIPT = fileURLToPath(
  new URL("../../../scripts/release-version.ts", import.meta.url),
);
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const fixtures: string[] = [];

afterEach(() => {
  for (const dir of fixtures.splice(0)) rmSync(dir, { recursive: true, force: true });
});

interface Fixture {
  readonly coreVersion?: string;
  readonly patroVersion?: string;
  readonly peer?: string;
  readonly dev?: string;
  readonly changelog?: string;
}

function manifest(version: string, extra: Record<string, unknown> = {}): string {
  return `${JSON.stringify({ name: "fixture", version, ...extra }, null, 2)}\n`;
}

function fixture(options: Fixture = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "release-check-"));
  fixtures.push(dir);
  mkdirSync(join(dir, "packages/nepdate"), { recursive: true });
  mkdirSync(join(dir, "packages/nepdate-patro"), { recursive: true });
  writeFileSync(
    join(dir, "packages/nepdate/package.json"),
    manifest(options.coreVersion ?? "0.1.0"),
  );
  writeFileSync(
    join(dir, "packages/nepdate-patro/package.json"),
    manifest(options.patroVersion ?? "0.1.0", {
      peerDependencies: { nepdate: options.peer ?? "~0.1.0" },
      devDependencies: { nepdate: options.dev ?? "0.1.0" },
    }),
  );
  writeFileSync(join(dir, "CHANGELOG.md"), options.changelog ?? "# Changelog\n\n## [0.1.0]\n");
  return dir;
}

function check(dir: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [SCRIPT, "0.1.0"], { cwd: dir, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("release-check accepts matching manifests, peer range and changelog", () => {
  const result = check(fixture());
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("0.1.0 agrees");
});

test("release-check fails when the two version fields differ", () => {
  const result = check(fixture({ patroVersion: "0.1.1" }));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("nepdate-patro version 0.1.1 is not 0.1.0");
});

test("release-check fails when the peer range is not ~X.Y.Z", () => {
  const result = check(fixture({ peer: "~0.2.0" }));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("peerDependencies.nepdate is ~0.2.0, expected ~0.1.0");
});

test("release-check fails when the changelog has no section for the version", () => {
  const result = check(fixture({ changelog: "# Changelog\n" }));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('CHANGELOG.md has no "## [0.1.0]" section');
});

function tagVersion(ref: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [VERSION_SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, EVENT_NAME: "push", REF_NAME: ref },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("release-version accepts a vX.Y.Z tag and prints the version", () => {
  const result = tagVersion("v0.1.0");
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe("version=0.1.0");
});

test("release-version rejects a partial tag", () => {
  const result = tagVersion("v0.1");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("is not a strict X.Y.Z version");
});

test("release-version rejects a leading zero", () => {
  const result = tagVersion("v01.2.3");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("is not a strict X.Y.Z version");
});
