// Prints the release version and its npm dist-tag for the workflow's GITHUB_OUTPUT, after a strict
// semver check. A tag push carries the version as vX.Y.Z or vX.Y.Z-PRERELEASE; a workflow_dispatch
// reads it from the core manifest. The workflow passes the tag and event through env, never through
// a run: expression.
//   node scripts/release-version.ts   ->  version=X.Y.Z
//                                         dist-tag=latest

import { readFileSync } from "node:fs";
import { distTag, SEMVER, SEMVER_HINT } from "./release-semver.ts";

function fail(message: string): never {
  console.error(`release-version: ${message}`);
  process.exit(1);
}

const event = process.env.EVENT_NAME ?? "";
const ref = process.env.REF_NAME ?? "";
let version: string;
if (event === "push") {
  const match = /^v(.+)$/.exec(ref);
  if (match === null) fail(`tag ${ref} is not vX.Y.Z`);
  version = match[1] as string;
} else {
  const manifest = JSON.parse(readFileSync("packages/nepdate/package.json", "utf8")) as {
    version?: unknown;
  };
  if (typeof manifest.version !== "string") fail("packages/nepdate/package.json has no version");
  version = manifest.version;
}
if (!SEMVER.test(version)) fail(`${version} is not ${SEMVER_HINT}`);
console.log(`version=${version}`);
console.log(`dist-tag=${distTag(version)}`);
