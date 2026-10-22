// The release version rule, shared by release-version.ts and release-check.ts. A version is strict
// X.Y.Z with an optional semver pre-release such as 0.1.0-beta.1. Build metadata (+...) is refused:
// npm drops it on publish, so two tags could name one package version.

const IDENTIFIER = String.raw`(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)`;

export const SEMVER = new RegExp(
  String.raw`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(${IDENTIFIER}(?:\.${IDENTIFIER})*))?$`,
);

export const SEMVER_HINT = "a strict X.Y.Z or X.Y.Z-PRERELEASE version";

/**
 * The npm dist-tag a version is published under. A stable version goes to `latest`. A pre-release
 * must not: npm moves `latest` to whatever is published without `--tag`, so `npm install nepdate-core`
 * would install the beta. It goes to its first identifier (`beta` for 0.1.0-beta.1), or to `next`
 * when that identifier is numeric.
 */
export function distTag(version: string): string {
  const match = SEMVER.exec(version);
  if (match === null) throw new Error(`${version} is not ${SEMVER_HINT}`);
  const prerelease = match[4];
  if (prerelease === undefined) return "latest";
  const first = prerelease.split(".")[0] as string;
  return /^[a-zA-Z][0-9a-zA-Z-]*$/.test(first) ? first.toLowerCase() : "next";
}
