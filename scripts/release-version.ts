// Prints the release version, its line, its packages and its npm dist-tag for the workflow's
// GITHUB_OUTPUT, after a strict semver check. A tag push carries the version as vX.Y.Z or
// datepicker-vX.Y.Z; a workflow_dispatch reads the core line and reads its version from the core
// manifest. The workflow passes the tag and event through env, never through a run: expression.
//   node scripts/release-version.ts   ->  version=X.Y.Z
//                                         kind=sdk
//                                         dist-tag=latest
//                                         core-version=X.Y.Z
//                                         packages=nepdate-core,nepdate-patro
//                                         tag=vX.Y.Z

import { readFileSync } from "node:fs";
import {
  distTag,
  packagesOf,
  parseReleaseRef,
  type ReleaseKind,
  SEMVER,
  SEMVER_HINT,
  tagOf,
} from "./release-semver.ts";

function fail(message: string): never {
  console.error(`release-version: ${message}`);
  process.exit(1);
}

const event = process.env.EVENT_NAME ?? "";
const ref = process.env.REF_NAME ?? "";
let version: string;
let kind: ReleaseKind;
if (event === "push") {
  const release = parseReleaseRef(ref);
  if (release === undefined) fail(`tag ${ref} is not vX.Y.Z or datepicker-vX.Y.Z`);
  version = release.version;
  kind = release.kind;
} else {
  const manifest = JSON.parse(readFileSync("packages/nepdate/package.json", "utf8")) as {
    version?: unknown;
  };
  if (typeof manifest.version !== "string") fail("packages/nepdate/package.json has no version");
  version = manifest.version;
  kind = "sdk";
}
if (!SEMVER.test(version)) fail(`${version} is not ${SEMVER_HINT}`);

const core = JSON.parse(readFileSync("packages/nepdate/package.json", "utf8")) as {
  version?: unknown;
};
if (typeof core.version !== "string" || !SEMVER.test(core.version)) {
  fail("packages/nepdate/package.json has no release version");
}

console.log(`version=${version}`);
console.log(`kind=${kind}`);
console.log(`dist-tag=${distTag(version)}`);
console.log(`core-version=${core.version}`);
console.log(`packages=${packagesOf(kind).join(",")}`);
console.log(`tag=${tagOf(kind, version)}`);
