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
      peerDependencies: { "@nepdate/core": options.peer ?? "~0.1.0" },
    }),
  );
  writeFileSync(
    join(dir, "CHANGELOG.md"),
    options.changelog ?? "# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-10-18\n",
  );
  return dir;
}

function check(
  dir: string,
  version = "0.1.0",
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [SCRIPT, version], { cwd: dir, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("release-check accepts matching manifests, peer range, empty [Unreleased] and changelog", () => {
  const result = check(fixture());
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("0.1.0 agrees");
  expect(result.stdout).toContain("empty [Unreleased]");
});

test("release-check fails when the core version differs", () => {
  const result = check(fixture({ coreVersion: "0.0.9" }));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("@nepdate/core version 0.0.9, expected 0.1.0");
});

test("release-check fails when the patro version differs", () => {
  const result = check(fixture({ patroVersion: "0.1.1" }));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("@nepdate/patro version 0.1.1, expected 0.1.0");
});

test("release-check fails when the peer range is not ~X.Y.Z", () => {
  const result = check(fixture({ peer: "~0.2.0" }));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('peerDependencies["@nepdate/core"] is ~0.2.0, expected ~0.1.0');
});

test("release-check fails when the changelog has no section for the version", () => {
  const result = check(fixture({ changelog: "# Changelog\n" }));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'has no "## [0.1.0] - YYYY-MM-DD" section, expected one for 0.1.0',
  );
});

test("release-check fails when [Unreleased] has entries", () => {
  const result = check(
    fixture({
      changelog:
        "# Changelog\n\n## [Unreleased]\n\n- Still to release.\n\n## [0.1.0] - 2026-10-18\n",
    }),
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("entries under [Unreleased], expected an empty section");
});

test("release-check accepts a changelog without an [Unreleased] heading", () => {
  const result = check(fixture({ changelog: "# Changelog\n\n## [0.1.0] - 2026-10-18\n" }));
  expect(result.status).toBe(0);
});

test("release-check fails when the version argument is not X.Y.Z", () => {
  for (const bad of ["0.1", "0.1.0+build.1", "0.1.0-", "0.1.0-beta.01"]) {
    const result = check(fixture(), bad);
    expect(result.status, bad).toBe(2);
    expect(result.stderr).toContain("expected a strict X.Y.Z or X.Y.Z-PRERELEASE version");
  }
});

test("release-check fails when the changelog section has no date", () => {
  const result = check(fixture({ changelog: "# Changelog\n\n## [0.1.0]\n" }));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('"## [0.1.0] - YYYY-MM-DD"');
});

function betaFixture(changelog: string): string {
  return fixture({
    coreVersion: "0.1.0-beta.1",
    patroVersion: "0.1.0-beta.1",
    peer: "~0.1.0-beta.1",
    changelog,
  });
}

test("release-check accepts a pre-release with its own dated section", () => {
  const result = check(
    betaFixture("# Changelog\n\n## [Unreleased]\n\n## [0.1.0-beta.1] - 2026-10-21\n"),
    "0.1.0-beta.1",
  );
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("0.1.0-beta.1 agrees");
});

test("release-check does not let a stable section stand in for a pre-release", () => {
  const result = check(betaFixture("# Changelog\n\n## [0.1.0] - 2026-10-21\n"), "0.1.0-beta.1");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('"## [0.1.0-beta.1] - YYYY-MM-DD"');
});

test("release-check does not let a pre-release section stand in for the stable version", () => {
  const result = check(fixture({ changelog: "# Changelog\n\n## [0.1.0-beta.1] - 2026-10-21\n" }));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('"## [0.1.0] - YYYY-MM-DD"');
});

function tagVersion(ref: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [VERSION_SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, EVENT_NAME: "push", REF_NAME: ref },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("release-version accepts a vX.Y.Z tag and prints the version and the latest dist-tag", () => {
  const result = tagVersion("v0.1.0");
  expect(result.status).toBe(0);
  expect(result.stdout.trim().split(/\r?\n/)).toEqual(["version=0.1.0", "dist-tag=latest"]);
});

test("release-version gives a pre-release its own dist-tag, never latest", () => {
  for (const [tag, expected] of [
    ["v0.1.0-beta.1", "beta"],
    ["v0.1.0-rc.2", "rc"],
    ["v0.1.0-0.3", "next"],
  ] as const) {
    const result = tagVersion(tag);
    expect(result.status, tag).toBe(0);
    expect(result.stdout.trim().split(/\r?\n/), tag).toEqual([
      `version=${tag.slice(1)}`,
      `dist-tag=${expected}`,
    ]);
  }
});

test("release-version rejects build metadata", () => {
  const result = tagVersion("v0.1.0+build.1");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("is not a strict X.Y.Z or X.Y.Z-PRERELEASE version");
});

test("release-version rejects a partial tag", () => {
  const result = tagVersion("v0.1");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("is not a strict X.Y.Z or X.Y.Z-PRERELEASE version");
});

test("release-version rejects a leading zero", () => {
  const result = tagVersion("v01.2.3");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("is not a strict X.Y.Z or X.Y.Z-PRERELEASE version");
});
