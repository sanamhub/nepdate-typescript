// Preflight for a release (ADR-0005, amended by ADR-0018). An SDK tag checks that the core and the
// patro agree with the tag, that the patro peer range is ~X.Y.Z, and that the root CHANGELOG.md has
// the dated section and an empty [Unreleased]. A picker tag checks the picker manifest, that its
// nepdate-core peer range accepts the core version in the repository, and the picker's own changelog.
//
//   node scripts/release-check.ts 0.1.0-beta.1
//   node scripts/release-check.ts 0.1.0-beta.2 --kind picker
//
// Every failed check names the value it expected.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { satisfies, validRange } from "semver";
import { changelogOf, type ReleaseKind, SEMVER, SEMVER_HINT } from "./release-semver.ts";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Manifest {
  readonly version?: string;
  readonly peerDependencies?: Record<string, string>;
}

function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

function versionErrors(name: string, manifest: Manifest, version: string): string[] {
  return manifest.version === version
    ? []
    : [`${name} version ${String(manifest.version)}, expected ${version}`];
}

// The body of [Unreleased] stops at the next version heading. A missing heading is valid: the
// project may not use an Unreleased section between releases.
function unreleasedErrors(changelog: string, file: string): string[] {
  const heading = /^## \[Unreleased\][ \t]*$/m.exec(changelog);
  if (heading === null) return [];
  const rest = changelog.slice(heading.index + heading[0].length);
  const next = /^## \[/m.exec(rest);
  const body = next === null ? rest : rest.slice(0, next.index);
  if (body.trim() === "") return [];
  return [`${file} has entries under [Unreleased], expected an empty section`];
}

// The heading must carry the release date, and only an exact match counts: a 0.1.0 section does
// not cover 0.1.0-beta.1, and the other way round.
function sectionErrors(changelog: string, version: string, file: string): string[] {
  const section = new RegExp(
    `^## \\[${escapeRegExp(version)}\\] - \\d{4}-\\d{2}-\\d{2}[ \\t]*$`,
    "m",
  );
  return section.test(changelog)
    ? []
    : [`${file} has no "## [${version}] - YYYY-MM-DD" section, expected one for ${version}`];
}

function parseArguments(
  argv: readonly string[],
): { version: string; kind: ReleaseKind } | undefined {
  let version: string | undefined;
  let kind: ReleaseKind = "sdk";
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--kind") {
      const value = argv[++index];
      if (value !== "sdk" && value !== "picker") return undefined;
      kind = value;
    } else if (version === undefined) {
      version = argument;
    } else {
      return undefined;
    }
  }
  if (version === undefined || !SEMVER.test(version)) return undefined;
  return { version, kind };
}

const parsed = parseArguments(process.argv.slice(2));
if (parsed === undefined) {
  console.error("usage: node scripts/release-check.ts X.Y.Z[-PRERELEASE] [--kind sdk|picker]");
  console.error(
    `release-check: expected ${SEMVER_HINT} and --kind sdk or --kind picker, got ${process.argv
      .slice(2)
      .join(" ")}`,
  );
  process.exit(2);
}
const { version, kind } = parsed;

const root = process.cwd();
const core = readManifest(join(root, "packages/nepdate/package.json"));
const errors: string[] = [];

if (kind === "sdk") {
  errors.push(...versionErrors("nepdate-core", core, version));
  const patro = readManifest(join(root, "packages/nepdate-patro/package.json"));
  errors.push(...versionErrors("nepdate-patro", patro, version));
  // The patro builds on the core, so it pins it with a tilde range on the same version.
  const peer = patro.peerDependencies?.["nepdate-core"];
  if (peer !== `~${version}`) {
    errors.push(
      `nepdate-patro peerDependencies["nepdate-core"] is ${String(peer)}, expected ~${version}`,
    );
  }
} else {
  const picker = readManifest(join(root, "packages/nepdate-picker/package.json"));
  errors.push(...versionErrors("nepdate-datepicker", picker, version));
  // The picker keeps its own version, so its core peer is a range rather than ~<picker version>.
  // It must accept the core version in the repository, which is the SDK version it was built on.
  const peer = picker.peerDependencies?.["nepdate-core"];
  if (core.version === undefined) {
    errors.push("nepdate-core has no version, so the picker peer range cannot be checked");
  } else if (typeof peer !== "string" || validRange(peer) === null) {
    errors.push(
      `nepdate-datepicker peerDependencies["nepdate-core"] is ${String(peer)}, expected a valid range that accepts ${core.version}`,
    );
  } else if (!satisfies(core.version, peer)) {
    errors.push(
      `nepdate-datepicker peerDependencies["nepdate-core"] is ${peer}, expected a range that accepts ${core.version}`,
    );
  }
}

const changelogFile = changelogOf(kind);
const changelog = readFileSync(join(root, changelogFile), "utf8");
errors.push(...sectionErrors(changelog, version, changelogFile));
errors.push(...unreleasedErrors(changelog, changelogFile));

if (errors.length > 0) {
  for (const error of errors) console.error(`release-check: ${error}`);
  console.error(`release-check: ${errors.length} problem(s), expected ${version}`);
  process.exit(1);
}
if (kind === "picker") {
  console.log(
    `release-check: ${version} agrees in the picker manifest, its nepdate-core peer range, the empty [Unreleased] section and ${changelogFile}`,
  );
} else {
  console.log(
    `release-check: ${version} agrees in the core and patro manifests, the patro peer range, the empty [Unreleased] section and ${changelogFile}`,
  );
}
