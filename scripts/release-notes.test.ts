import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { changelogSection, releaseNotes } from "./release-notes.ts";
import { distTag } from "./release-semver.ts";

const CHANGELOG = `# Changelog

## [Unreleased]

## [0.1.0-beta.1] - 2026-10-21

First public pre-release.

### Added

- Everything.

## [0.0.9] - 2026-01-01

- Older.
`;

test("changelogSection returns one section without its heading", () => {
  assert.equal(
    changelogSection(CHANGELOG, "0.1.0-beta.1"),
    "First public pre-release.\n\n### Added\n\n- Everything.",
  );
  assert.equal(changelogSection(CHANGELOG, "0.0.9"), "- Older.");
});

test("changelogSection does not match a version prefix", () => {
  assert.equal(changelogSection(CHANGELOG, "0.1.0"), undefined);
});

test("releaseNotes adds the install and verification blocks for the exact version", () => {
  const notes = releaseNotes(CHANGELOG, "0.1.0-beta.1");
  assert.ok(notes.startsWith("First public pre-release."));
  assert.ok(notes.includes("npm install nepdate-core@0.1.0-beta.1 nepdate-patro@0.1.0-beta.1"));
  assert.ok(
    notes.includes("npm install nepdate-core@0.1.0-beta.1 nepdate-datepicker@0.1.0-beta.1"),
  );
  assert.ok(notes.includes("The three tarballs attached here"));
  assert.ok(notes.includes("pre-release on the `beta` dist-tag"));
  assert.ok(notes.includes("npm audit signatures"));
  assert.ok(!notes.includes("## [0.0.9]"));
});

test("releaseNotes for a stable version says nothing about a dist-tag", () => {
  const notes = releaseNotes("## [0.1.0] - 2026-11-01\n\n- Stable.\n", "0.1.0");
  assert.ok(!notes.includes("dist-tag"));
});

test("releaseNotes fails without a section", () => {
  assert.throws(() => releaseNotes(CHANGELOG, "0.2.0"), /no section for 0.2.0/);
});

test("distTag never sends a pre-release to latest", () => {
  assert.equal(distTag("0.1.0"), "latest");
  assert.equal(distTag("0.1.0-beta.1"), "beta");
  assert.equal(distTag("1.0.0-RC.1"), "rc");
  assert.equal(distTag("0.1.0-1"), "next");
  assert.throws(() => distTag("0.1.0+build"), /not a strict/);
});

test("the script prints the notes and exits 1 without a section", () => {
  const script = fileURLToPath(new URL("./release-notes.ts", import.meta.url));
  const root = fileURLToPath(new URL("../", import.meta.url));
  const missing = spawnSync(process.execPath, [script, "9.9.9"], { cwd: root, encoding: "utf8" });
  assert.equal(missing.status, 1);
  assert.ok(missing.stderr.includes("no section for 9.9.9"));
});
