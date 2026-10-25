// Preflight for a release (ADR-0005): the three packages, both peer ranges and the changelog must
// agree on one version, and the [Unreleased] section must be empty. Run from the repository root:
//   node scripts/release-check.ts 0.1.0
//   node scripts/release-check.ts 0.1.0-beta.1
//
// Every failed check names the value it expected.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SEMVER, SEMVER_HINT } from "./release-semver.ts";

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

// The body of [Unreleased] stops at the next version heading. A missing heading is valid: the
// project may not use an Unreleased section between releases.
function unreleasedErrors(changelog: string): string[] {
  const heading = /^## \[Unreleased\][ \t]*$/m.exec(changelog);
  if (heading === null) return [];
  const rest = changelog.slice(heading.index + heading[0].length);
  const next = /^## \[/m.exec(rest);
  const body = next === null ? rest : rest.slice(0, next.index);
  if (body.trim() === "") return [];
  return ["CHANGELOG.md has entries under [Unreleased], expected an empty section"];
}

const version = process.argv[2];
if (version === undefined || !SEMVER.test(version)) {
  console.error("usage: node scripts/release-check.ts X.Y.Z[-PRERELEASE]");
  console.error(`release-check: expected ${SEMVER_HINT}, got ${String(version)}`);
  process.exit(2);
}

const root = process.cwd();
const errors: string[] = [];
const core = readManifest(join(root, "packages/nepdate/package.json"));
const patro = readManifest(join(root, "packages/nepdate-patro/package.json"));
const picker = readManifest(join(root, "packages/nepdate-picker/package.json"));

for (const [name, manifest] of [
  ["nepdate-core", core],
  ["nepdate-patro", patro],
  ["nepdate-picker", picker],
] as const) {
  if (manifest.version !== version) {
    errors.push(`${name} version ${String(manifest.version)}, expected ${version}`);
  }
}
// patro and the picker build on the core, so each pins it with a tilde range on the same version.
for (const [name, manifest] of [
  ["nepdate-patro", patro],
  ["nepdate-picker", picker],
] as const) {
  const peer = manifest.peerDependencies?.["nepdate-core"];
  if (peer !== `~${version}`) {
    errors.push(
      `${name} peerDependencies["nepdate-core"] is ${String(peer)}, expected ~${version}`,
    );
  }
}
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
// The heading must carry the release date, and only an exact match counts: a 0.1.0 section does
// not cover 0.1.0-beta.1, and the other way round.
const section = new RegExp(
  `^## \\[${escapeRegExp(version)}\\] - \\d{4}-\\d{2}-\\d{2}[ \\t]*$`,
  "m",
);
if (!section.test(changelog)) {
  errors.push(
    `CHANGELOG.md has no "## [${version}] - YYYY-MM-DD" section, expected one for ${version}`,
  );
}
errors.push(...unreleasedErrors(changelog));

if (errors.length > 0) {
  for (const error of errors) console.error(`release-check: ${error}`);
  console.error(`release-check: ${errors.length} problem(s), expected ${version}`);
  process.exit(1);
}
console.log(
  `release-check: ${version} agrees in the three manifests, both peer ranges, the empty [Unreleased] section and the changelog`,
);
