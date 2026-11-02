// The release version rule, shared by release-version.ts, release-check.ts and release-notes.ts. A
// version is strict X.Y.Z with an optional semver pre-release such as 0.1.0-beta.1. Build metadata
// (+...) is refused: npm drops it on publish, so two tags could name one package version.
//
// Two tag shapes share one workflow (ADR-0018). vX.Y.Z releases nepdate-core and nepdate-patro;
// datepicker-vX.Y.Z releases nepdate-datepicker. The `v*` tag filter cannot match a name that starts
// with `datepicker-`, because GitHub matches the filter from the start of the tag.

const IDENTIFIER = String.raw`(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)`;

export const SEMVER = new RegExp(
  String.raw`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(${IDENTIFIER}(?:\.${IDENTIFIER})*))?$`,
);

export const SEMVER_HINT = "a strict X.Y.Z or X.Y.Z-PRERELEASE version";

export const SDK_TAG_PREFIX = "v";
export const PICKER_TAG_PREFIX = "datepicker-v";

export const SDK_PACKAGES = ["nepdate-core", "nepdate-patro"] as const;
export const PICKER_PACKAGE = "nepdate-datepicker";

export type ReleaseKind = "sdk" | "picker";

export interface ReleaseRef {
  readonly kind: ReleaseKind;
  readonly version: string;
}

/** The kind and version a release tag names, or undefined for another tag. */
export function parseReleaseRef(ref: string): ReleaseRef | undefined {
  if (ref.startsWith(PICKER_TAG_PREFIX)) {
    return { kind: "picker", version: ref.slice(PICKER_TAG_PREFIX.length) };
  }
  if (ref.startsWith(SDK_TAG_PREFIX)) {
    return { kind: "sdk", version: ref.slice(SDK_TAG_PREFIX.length) };
  }
  return undefined;
}

/** The packages a tag of this kind releases. */
export function packagesOf(kind: ReleaseKind): readonly string[] {
  return kind === "picker" ? [PICKER_PACKAGE] : SDK_PACKAGES;
}

/** The changelog a tag of this kind is checked against and its notes read from. */
export function changelogOf(kind: ReleaseKind): string {
  return kind === "picker" ? "packages/nepdate-picker/CHANGELOG.md" : "CHANGELOG.md";
}

/** The tag that releases this version on this line. */
export function tagOf(kind: ReleaseKind, version: string): string {
  return `${kind === "picker" ? PICKER_TAG_PREFIX : SDK_TAG_PREFIX}${version}`;
}

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
