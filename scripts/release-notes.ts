// Writes the GitHub release notes for one version to stdout: the CHANGELOG section, then how to
// install that exact version and how to check what was installed. The commit log is not used; it
// says how the work happened, not what shipped.
//   node scripts/release-notes.ts 0.1.0-beta.1 > RELEASE_NOTES.md

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { distTag, SEMVER, SEMVER_HINT } from "./release-semver.ts";

const REPOSITORY = "https://github.com/sanamhub/nepdate-typescript";

/** The body of the "## [version] - date" section, without its heading, or undefined. */
export function changelogSection(changelog: string, version: string): string | undefined {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`## [${version}] - `));
  if (start < 0) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## ["));
  const body = (end < 0 ? rest : rest.slice(0, end)).join("\n").trim();
  return body === "" ? undefined : body;
}

export function releaseNotes(changelog: string, version: string): string {
  if (!SEMVER.test(version)) throw new Error(`${version} is not ${SEMVER_HINT}`);
  const body = changelogSection(changelog, version);
  if (body === undefined) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const tag = distTag(version);
  const channel =
    tag === "latest"
      ? ""
      : `\n\nThis is a pre-release on the \`${tag}\` dist-tag, so a plain \`npm install nepdate\` does not pick it up.`;
  return `${body}

### Install

\`\`\`bash
npm install nepdate@${version} nepdate-patro@${version}
\`\`\`${channel}

### Verification

- Both packages were published from this tag by GitHub Actions with npm provenance. After
  installing, \`npm audit signatures\` checks the registry signatures and the provenance
  attestations.
- The two tarballs attached here are the ones that were published. \`SHA256SUMS\` in the workflow
  run lists their hashes.
- Before this release page was created, both versions were installed from the registry on Linux,
  macOS and Windows with Node 22 and 24, and the README quick start and one patro lookup ran.

[Full changelog](${REPOSITORY}/blob/v${version}/CHANGELOG.md)
`;
}

// Run as a script, not when a test imports the functions above.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === import.meta.filename) {
  const version = process.argv[2];
  if (version === undefined) {
    console.error("usage: node scripts/release-notes.ts X.Y.Z[-PRERELEASE]");
    process.exit(2);
  }
  try {
    process.stdout.write(releaseNotes(readFileSync("CHANGELOG.md", "utf8"), version));
  } catch (error) {
    console.error(`release-notes: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
