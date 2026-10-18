// Preflight for a release (ADR-0005): both packages, the peer range and the changelog must agree
// on one version. Run from the repository root:
//   node scripts/release-check.ts 0.1.0

import { readFileSync } from "node:fs";
import { join } from "node:path";

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

interface Manifest {
  readonly version?: string;
  readonly peerDependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

const version = process.argv[2];
if (version === undefined || !SEMVER.test(version)) {
  console.error("usage: node scripts/release-check.ts X.Y.Z");
  process.exit(2);
}

const root = process.cwd();
const errors: string[] = [];
const core = readManifest(join(root, "packages/nepdate/package.json"));
const patro = readManifest(join(root, "packages/nepdate-patro/package.json"));

if (core.version !== version) {
  errors.push(`nepdate version ${String(core.version)} is not ${version}`);
}
if (patro.version !== version) {
  errors.push(`nepdate-patro version ${String(patro.version)} is not ${version}`);
}
if (patro.peerDependencies?.nepdate !== `~${version}`) {
  errors.push(
    `nepdate-patro peerDependencies.nepdate is ${String(
      patro.peerDependencies?.nepdate,
    )}, expected ~${version}`,
  );
}
if (patro.devDependencies?.nepdate !== version) {
  errors.push(
    `nepdate-patro devDependencies.nepdate is ${String(
      patro.devDependencies?.nepdate,
    )}, expected ${version}`,
  );
}
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
if (!changelog.includes(`## [${version}]`)) {
  errors.push(`CHANGELOG.md has no "## [${version}]" section`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`release-check: ${error}`);
  console.error(`release-check: ${errors.length} problem(s) for ${version}`);
  process.exit(1);
}
console.log(
  `release-check: ${version} agrees in both manifests, the peer and dev ranges, and the changelog`,
);
