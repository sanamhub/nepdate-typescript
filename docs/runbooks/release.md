# Runbook: release `nepdate` and `nepdate-patro` (npm)

Decided in ADR-0005. Owner: maintainer. Approver: a second person. One tag releases both packages
with the same version.

## Before tagging

1. `main` is green. `npm run ci` passes locally.
2. `packages/nepdate/package.json` and `packages/nepdate-patro/package.json` both have the new
   version X.Y.Z; `nepdate-patro` has `peerDependencies.nepdate` `~X.Y.Z` and
   `devDependencies.nepdate` `X.Y.Z`; `package-lock.json` is up to date (`npm install` changed
   nothing). `CHANGELOG.md` has `## [X.Y.Z] - YYYY-MM-DD`.
3. `node scripts/release-check.ts X.Y.Z` passes.

## Releasing

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

`release.yml` runs preflight, CI and `npm pack` for both packages, waits for the `production`
approval, publishes `nepdate` and then `nepdate-patro` by trusted publishing (provenance added
automatically), creates the GitHub Release from the changelog section with both tarballs, then
runs the smoke job (ADR-0005) on Node and Deno.

If the run fails after `nepdate` is published but before `nepdate-patro` is, fix the cause and
re-run the failed jobs. The publish step skips a version that is already on npm, so only
`nepdate-patro` is published. Never bump the version to get around this.

### First release only (0.1.0)

Trusted publishing is set in each package's settings on npmjs.com, so both packages must exist
first (T0-06):
1. Create one granular access token on npmjs.com: read and write, packages "All packages" (a new
   package name can't be selected before it exists), expires in 1 day. Store it as `NPM_TOKEN` in
   the `production` environment. Never paste it anywhere else.
2. Tag and approve as above; for this run only, the workflow publishes both packages with the
   token and `--provenance`.
3. On npmjs.com → `nepdate` → Settings → Trusted publishing: repository
   `sanamhub/nepdate-typescript`, workflow `release.yml`, environment `production`. Then
   "Require 2FA and disallow tokens".
4. Repeat step 3 for `nepdate-patro`, with the same repository, workflow and environment.
5. Delete the token on npmjs.com and the `NPM_TOKEN` secret. Remove the token branch from
   `release.yml` in the next PR.

## After releasing

1. Both npm pages (`nepdate`, `nepdate-patro`) show version X.Y.Z with a provenance badge.
2. Add an empty `## [Unreleased]` to the changelog.

## Rolling back

`npm deprecate nepdate@X.Y.Z "<reason>"` and `npm deprecate nepdate-patro@X.Y.Z "<reason>"`,
release `X.Y.(Z+1)` of both with the fix, note both in the changelog. Don't `npm unpublish`.
