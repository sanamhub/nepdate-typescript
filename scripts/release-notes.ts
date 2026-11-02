// Writes the GitHub release notes for one version to stdout: the changelog section, then how to
// install that exact version and how to check what was installed. The commit log is not used; it
// says how the work happened, not what shipped.
//
//   node scripts/release-notes.ts 0.1.0-beta.1 > RELEASE_NOTES.md
//   node scripts/release-notes.ts 0.1.0-beta.2 --kind picker --core-version 0.1.0-rc.1

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  changelogOf,
  distTag,
  type ReleaseKind,
  SEMVER,
  SEMVER_HINT,
  tagOf,
} from "./release-semver.ts";

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

export interface ReleaseNotesOptions {
  readonly kind?: ReleaseKind;
  // Required for a picker release: the core version the picker peers on.
  readonly coreVersion?: string;
}

export function releaseNotes(
  changelog: string,
  version: string,
  options: ReleaseNotesOptions = {},
): string {
  if (!SEMVER.test(version)) throw new Error(`${version} is not ${SEMVER_HINT}`);
  const kind = options.kind ?? "sdk";
  const coreVersion = options.coreVersion ?? version;
  if (kind === "picker" && options.coreVersion === undefined) {
    throw new Error("a picker release needs the core version it peers on");
  }
  const body = changelogSection(changelog, version);
  if (body === undefined) throw new Error(`${changelogOf(kind)} has no section for ${version}`);
  const tag = tagOf(kind, version);
  const dist = distTag(version);
  const channel =
    dist === "latest"
      ? ""
      : kind === "picker"
        ? `\n\nThis is a pre-release on the \`${dist}\` dist-tag, so a plain \`npm install nepdate-datepicker\` does not pick it up.`
        : `\n\nThis is a pre-release on the \`${dist}\` dist-tag, so a plain \`npm install nepdate-core\` does not pick it up.`;
  const install =
    kind === "picker"
      ? `npm install nepdate-core@${coreVersion} nepdate-datepicker@${version}`
      : `npm install nepdate-core@${version} nepdate-patro@${version}`;
  const installNote =
    kind === "picker"
      ? "The date picker installs with the core it peers on:"
      : "The core and the patro install together:";
  const verification =
    kind === "picker"
      ? `- The package was published from this tag by GitHub Actions with npm provenance. After
  installing, \`npm audit signatures\` checks the registry signatures and the provenance
  attestations.
- The tarball attached here is the one that was published. \`SHA256SUMS\` in the workflow run
  lists its hash.
- Before this release page was created, the picker version and the core it peers on were installed
  from the registry on Linux, macOS and Windows with Node 22 and 24, and the README quick start and
  one month grid ran.`
      : `- The two packages were published from this tag by GitHub Actions with npm provenance. After
  installing, \`npm audit signatures\` checks the registry signatures and the provenance
  attestations.
- The two tarballs attached here are the ones that were published. \`SHA256SUMS\` in the workflow
  run lists their hashes.
- Before this release page was created, the two versions were installed from the registry on Linux,
  macOS and Windows with Node 22 and 24, and the README quick start and one patro lookup ran.`;
  return `${body}

### Install

\`\`\`bash
${install}
\`\`\`

${installNote}${channel}

### Verification

${verification}

[Full changelog](${REPOSITORY}/blob/${tag}/${changelogOf(kind)})
`;
}

// Run as a script, not when a test imports the functions above.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === import.meta.filename) {
  const argv = process.argv.slice(2);
  let version: string | undefined;
  let kind: ReleaseKind = "sdk";
  let coreVersion: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--kind") {
      const value = argv[++index];
      if (value !== "sdk" && value !== "picker") {
        console.error("release-notes: --kind must be sdk or picker");
        process.exit(2);
      }
      kind = value;
    } else if (argument === "--core-version") {
      coreVersion = argv[++index];
    } else if (version === undefined) {
      version = argument;
    } else {
      console.error(`release-notes: unexpected argument ${String(argument)}`);
      process.exit(2);
    }
  }
  if (version === undefined) {
    console.error(
      "usage: node scripts/release-notes.ts X.Y.Z[-PRERELEASE] [--kind sdk|picker] [--core-version X.Y.Z]",
    );
    process.exit(2);
  }
  const options: ReleaseNotesOptions = coreVersion === undefined ? { kind } : { kind, coreVersion };
  try {
    process.stdout.write(releaseNotes(readFileSync(changelogOf(kind), "utf8"), version, options));
  } catch (error) {
    console.error(`release-notes: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
