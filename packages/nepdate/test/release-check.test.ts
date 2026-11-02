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
  readonly pickerVersion?: string;
  readonly peer?: string;
  readonly pickerPeer?: string;
  readonly changelog?: string;
  readonly pickerChangelog?: string;
}

function manifest(version: string, extra: Record<string, unknown> = {}): string {
  return `${JSON.stringify({ name: "fixture", version, ...extra }, null, 2)}\n`;
}

function fixture(options: Fixture = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "release-check-"));
  fixtures.push(dir);
  mkdirSync(join(dir, "packages/nepdate"), { recursive: true });
  mkdirSync(join(dir, "packages/nepdate-patro"), { recursive: true });
  mkdirSync(join(dir, "packages/nepdate-picker"), { recursive: true });
  const coreVersion = options.coreVersion ?? "0.1.0";
  writeFileSync(join(dir, "packages/nepdate/package.json"), manifest(coreVersion));
  writeFileSync(
    join(dir, "packages/nepdate-patro/package.json"),
    manifest(options.patroVersion ?? "0.1.0", {
      peerDependencies: { "nepdate-core": options.peer ?? "~0.1.0" },
    }),
  );
  writeFileSync(
    join(dir, "packages/nepdate-picker/package.json"),
    manifest(options.pickerVersion ?? "0.1.0", {
      peerDependencies: { "nepdate-core": options.pickerPeer ?? "~0.1.0" },
    }),
  );
  const section = `## [0.1.0] - 2026-10-18\n`;
  const pickerSection = `## [0.1.0] - 2026-10-18\n`;
  writeFileSync(
    join(dir, "CHANGELOG.md"),
    options.changelog ?? `# Changelog\n\n## [Unreleased]\n\n${section}`,
  );
  writeFileSync(
    join(dir, "packages/nepdate-picker/CHANGELOG.md"),
    options.pickerChangelog ?? `# Changelog\n\n## [Unreleased]\n\n${pickerSection}`,
  );
  return dir;
}

function check(
  dir: string,
  version = "0.1.0",
  kind: "sdk" | "picker" = "sdk",
): { status: number | null; stdout: string; stderr: string } {
  const args = kind === "picker" ? [SCRIPT, version, "--kind", "picker"] : [SCRIPT, version];
  const result = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("release-check accepts matching SDK manifests, peer range, empty [Unreleased] and changelog", () => {
  const result = check(fixture());
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("0.1.0 agrees");
  expect(result.stdout).toContain("empty [Unreleased]");
});

test("an SDK check ignores the picker version", () => {
  const result = check(fixture({ pickerVersion: "9.9.9", pickerPeer: "~9.9.9" }));
  expect(result.status).toBe(0);
  expect(result.stderr).not.toContain("nepdate-datepicker");
});

test("release-check fails when the core version differs", () => {
  const result = check(fixture({ coreVersion: "0.0.9" }));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("nepdate-core version 0.0.9, expected 0.1.0");
});

test("release-check fails when the patro version differs", () => {
  const result = check(fixture({ patroVersion: "0.1.1" }));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("nepdate-patro version 0.1.1, expected 0.1.0");
});

test("release-check fails when the patro peer range is not ~X.Y.Z", () => {
  const result = check(fixture({ peer: "~0.2.0" }));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'nepdate-patro peerDependencies["nepdate-core"] is ~0.2.0, expected ~0.1.0',
  );
  expect(result.stderr).not.toContain("nepdate-datepicker");
});

test("release-check fails when the changelog has no section for the version", () => {
  const result = check(fixture({ changelog: "# Changelog\n" }));
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'CHANGELOG.md has no "## [0.1.0] - YYYY-MM-DD" section, expected one for 0.1.0',
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
  expect(result.stderr).toContain(
    "CHANGELOG.md has entries under [Unreleased], expected an empty section",
  );
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
    pickerVersion: "0.1.0-beta.1",
    peer: "~0.1.0-beta.1",
    pickerPeer: "~0.1.0-beta.1",
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

function pickerFixture(options: Fixture = {}): string {
  return fixture({
    coreVersion: "0.1.0-rc.1",
    patroVersion: "0.1.0-rc.1",
    pickerVersion: "0.1.0-beta.2",
    peer: "~0.1.0-rc.1",
    pickerPeer: "~0.1.0-beta.1",
    changelog: "# Changelog\n\n## [Unreleased]\n\n## [0.1.0-rc.1] - 2026-11-02\n",
    pickerChangelog: "# Changelog\n\n## [Unreleased]\n\n## [0.1.0-beta.2] - 2026-11-02\n",
    ...options,
  });
}

test("a picker check accepts the picker version and the core it peers on", () => {
  const result = check(pickerFixture(), "0.1.0-beta.2", "picker");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("0.1.0-beta.2 agrees in the picker manifest");
  expect(result.stdout).toContain("packages/nepdate-picker/CHANGELOG.md");
});

test("a picker check does not require the core and patro to have the picker version", () => {
  const result = check(pickerFixture(), "0.1.0-beta.2", "picker");
  expect(result.status).toBe(0);
  expect(result.stderr).not.toContain("nepdate-core version 0.1.0-beta.2");
});

test("a mismatched picker version fails", () => {
  const result = check(pickerFixture(), "0.1.0-beta.3", "picker");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("nepdate-datepicker version 0.1.0-beta.2, expected 0.1.0-beta.3");
});

test("a picker peer range that misses the core version fails", () => {
  const result = check(pickerFixture({ pickerPeer: "~0.2.0" }), "0.1.0-beta.2", "picker");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'nepdate-datepicker peerDependencies["nepdate-core"] is ~0.2.0, expected a range that accepts 0.1.0-rc.1',
  );
});

test("a picker peer range accepts 0.1.0-rc.N and 0.1.x", () => {
  for (const coreVersion of ["0.1.0-rc.1", "0.1.0", "0.1.4"]) {
    const dir = pickerFixture({
      coreVersion,
      pickerChangelog: "# Changelog\n\n## [Unreleased]\n\n## [0.1.0-beta.2] - 2026-11-02\n",
    });
    const result = check(dir, "0.1.0-beta.2", "picker");
    expect(result.status, coreVersion).toBe(0);
  }
});

test("a picker check fails without its own changelog section", () => {
  const result = check(
    pickerFixture({ pickerChangelog: "# Changelog\n\n## [Unreleased]\n" }),
    "0.1.0-beta.2",
    "picker",
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'packages/nepdate-picker/CHANGELOG.md has no "## [0.1.0-beta.2] - YYYY-MM-DD" section',
  );
});

test("a picker check fails when its [Unreleased] has entries", () => {
  const result = check(
    pickerFixture({
      pickerChangelog:
        "# Changelog\n\n## [Unreleased]\n\n- Later.\n\n## [0.1.0-beta.2] - 2026-11-02\n",
    }),
    "0.1.0-beta.2",
    "picker",
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    "packages/nepdate-picker/CHANGELOG.md has entries under [Unreleased], expected an empty section",
  );
});

test("release-check rejects an unknown kind", () => {
  for (const args of [
    ["0.1.0", "--kind", "sdk2"],
    ["0.1.0", "--kind"],
    ["--kind", "picker"],
  ]) {
    const result = spawnSync(process.execPath, [SCRIPT, ...args], {
      cwd: fixture(),
      encoding: "utf8",
    });
    expect(result.status, args.join(" ")).toBe(2);
    expect(result.stderr).toContain("--kind sdk or --kind picker");
  }
});

function tagOutput(ref: string): Record<string, string> {
  const result = spawnSync(process.execPath, [VERSION_SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, EVENT_NAME: "push", REF_NAME: ref },
  });
  expect(result.status, ref).toBe(0);
  return Object.fromEntries(
    result.stdout
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at), line.slice(at + 1)];
      }),
  );
}

test("an SDK tag selects the core and patro line", () => {
  const output = tagOutput("v0.1.0-rc.1");
  expect(output).toMatchObject({
    version: "0.1.0-rc.1",
    kind: "sdk",
    "dist-tag": "rc",
    packages: "nepdate-core,nepdate-patro",
    tag: "v0.1.0-rc.1",
  });
  expect(output["core-version"]).toBe("0.1.0-beta.1");
});

test("a picker tag selects only the picker", () => {
  const output = tagOutput("datepicker-v0.1.0-beta.2");
  expect(output).toMatchObject({
    version: "0.1.0-beta.2",
    kind: "picker",
    "dist-tag": "beta",
    packages: "nepdate-datepicker",
    tag: "datepicker-v0.1.0-beta.2",
  });
});

test("release-version gives a pre-release its own dist-tag, never latest", () => {
  for (const [tag, expected] of [
    ["v0.1.0-beta.1", "beta"],
    ["v0.1.0-rc.2", "rc"],
    ["datepicker-v0.1.0-rc.2", "rc"],
    ["v0.1.0-0.3", "next"],
  ] as const) {
    expect(tagOutput(tag)["dist-tag"], tag).toBe(expected);
  }
});

test("release-version rejects build metadata", () => {
  const result = spawnSync(process.execPath, [VERSION_SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, EVENT_NAME: "push", REF_NAME: "v0.1.0+build.1" },
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("is not a strict X.Y.Z or X.Y.Z-PRERELEASE version");
});

test("release-version rejects a partial or foreign tag", () => {
  for (const [ref, message] of [
    ["v0.1", "is not a strict X.Y.Z or X.Y.Z-PRERELEASE version"],
    ["datepicker-v0.1", "is not a strict X.Y.Z or X.Y.Z-PRERELEASE version"],
    ["release-0.1.0", "is not vX.Y.Z or datepicker-vX.Y.Z"],
  ] as const) {
    const result = spawnSync(process.execPath, [VERSION_SCRIPT], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, EVENT_NAME: "push", REF_NAME: ref },
    });
    expect(result.status, ref).toBe(1);
    expect(result.stderr).toContain(message);
  }
});

test("release-version rejects a leading zero", () => {
  const result = spawnSync(process.execPath, [VERSION_SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, EVENT_NAME: "push", REF_NAME: "v01.2.3" },
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("is not a strict X.Y.Z or X.Y.Z-PRERELEASE version");
});
