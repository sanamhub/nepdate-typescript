# ADR-0005: Releases

- Status: Accepted
- Date: 2026-09-25
- Updated: 2026-10-07 (hub ADR-0004: two packages, one version, one tag)
- Deciders: Sanam Pakuwal

## Decision

- `nepdate` and `nepdate-patro` always have the same version, set in
  `packages/nepdate/package.json` and `packages/nepdate-patro/package.json`. The root
  `package.json` has no version. Semver. One tag `vX.Y.Z` releases both. One root `CHANGELOG.md`
  (Keep a Changelog) covers both; an entry that concerns only one package starts with its name.
- A change that touches only one package still releases both (hub ADR-0004 §3), so users never
  have to work out which pair goes together.
- `node scripts/release-check.ts X.Y.Z` passes only when the tag, both `version` fields and a
  changelog section `## [X.Y.Z]` agree, and `nepdate-patro` has `peerDependencies.nepdate` equal
  to `~X.Y.Z` and `devDependencies.nepdate` equal to `X.Y.Z`.
- `release.yml` on tag `v*`, and `workflow_dispatch` with `dry-run` (default `true`):
  preflight (`release-check`) → CI → `npm pack` each package once → `environment: production`
  (required reviewer) → `npm publish` of the core tarball, then of the patro tarball, with **npm
  trusted publishing** (OIDC, `id-token: write`, npm CLI 11.5.1+), which adds provenance
  automatically → GitHub Release with notes from the changelog section and both tarballs attached
  → a smoke job (below).
- Publish order is core first, so `nepdate-patro@X.Y.Z` never exists on npm without its
  `nepdate@X.Y.Z`. Each publish step first runs `npm view <name>@X.Y.Z version`; if that version
  is already on npm the step is skipped, so re-running a half-finished release publishes only what
  is missing.
- Smoke job, on Node and Deno (`npm:` specifier): a clean project installs only `nepdate@X.Y.Z`,
  runs the README core example and checks that `node_modules/nepdate-patro` does not exist; a
  second clean project installs `nepdate@X.Y.Z` and `nepdate-patro@X.Y.Z` and runs the README
  patro example.
- Trusted publishing is configured per package on npmjs.com, so it is set up twice, once for
  `nepdate` and once for `nepdate-patro`. After the first publish, the human sets both packages
  to "Require 2FA and disallow tokens" (runbook).
- JSR is not published in v0.1 (YAGNI); `isolatedDeclarations` keeps it possible later.
- Rollback: `npm deprecate nepdate@X.Y.Z "<reason>"` and `npm deprecate nepdate-patro@X.Y.Z
  "<reason>"`, then publish `X.Y.(Z+1)` of both. Don't `npm unpublish` (allowed only within 72
  hours and breaks installs).

## Consequences

- No npm token exists anywhere after the first release.
- The weekly `shared-sync` PR, once merged, is released as a patch version of both packages.
