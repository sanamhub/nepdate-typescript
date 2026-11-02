# ADR-0018: The date picker has its own version and tag

- Status: Proposed
- Date: 2026-11-02
- Deciders: Sanam Pakuwal
- Amends: ADR-0005 (one version and one tag for every package), and the one-version sentence in
  ADR-0015

## Context

ADR-0005 made `nepdate-core`, `nepdate-patro` and `nepdate-datepicker` share one version, and one
`vX.Y.Z` tag released all three. ADR-0015 added the picker as a UI component, and hub ADR-0007
decision 6 puts it outside the SDK version line: the core, the patro data and the picker have
different reasons to change.

The one-version rule now costs more than it saves. A picker fix would wait for an SDK release, and
an SDK release would publish a picker version that contains no picker change. The SDK line is about
to release `0.1.0-rc.1`; the picker has no change in that release but would be forced to
`0.1.0-rc.1` as well. The two lines also need different preflight rules: the SDK has a patro peer and
one root changelog, the picker has a core peer and its own changelog.

npm trusted publishing is configured per package and matches the workflow file name, so both lines
can stay in `release.yml`. One workflow file and one `production` environment keep the owner setup
to one trusted publisher per package.

## Decision

1. **Two version lines.** `nepdate-core` and `nepdate-patro` keep one version and one tag. The
   picker has a version of its own in `packages/nepdate-picker/package.json`. `scripts/version.ts`
   and the CI `version` job stay core and patro only, because they feed the hub's SDK version check.
2. **Two tag shapes.** `vX.Y.Z[-PRERELEASE]` releases the core and the patro. The picker releases on
   `datepicker-vX.Y.Z[-PRERELEASE]`. `release.yml` listens for `v*` and `datepicker-v*`. GitHub's
   `*` matches from the start of the tag name and does not cross a `/`, so `v*` cannot match a tag
   that begins with `datepicker-`. Both shapes use the same workflow, environment and publish jobs.
3. **One tag releases one line.** The pack job packs, the smoke job installs, the publish job
   publishes and the release job attaches only the packages that the tag names. An SDK tag never
   packs, publishes or verifies the picker, and a picker tag never touches the SDK packages. The
   picker smoke installs the published `nepdate-core` at the core version in the repository, because
   the picker tag does not produce a core tarball. That core version must be on npm before a picker
   tag is pushed.
4. **Preflight follows the tag kind.** `scripts/release-check.ts` takes `--kind sdk|picker`. An SDK
   tag checks that the core and patro manifests equal the tag, that the patro peer is `~X.Y.Z`, and
   that the root `CHANGELOG.md` has the dated section and an empty `[Unreleased]`. A picker tag checks
   the picker manifest against the tag, that its `nepdate-core` peer range accepts the core version
   in the repository, and that `packages/nepdate-picker/CHANGELOG.md` has the dated section and an
   empty `[Unreleased]`. It does not compare the picker version with the SDK version.
5. **The picker peer stays `~0.1.0-beta.1`.** npm reads that as `>=0.1.0-beta.1 <0.2.0-0`, so it
   accepts `0.1.0-rc.N`, `0.1.0` and every `0.1.x` stable release. It does not accept a prerelease
   of a later patch such as `0.1.1-beta.1`, because a prerelease range admits prereleases only on
   the tuple that carries one. That is the conservative choice: a later patch's prerelease joins the
   range when the SDK line reaches it, and the preflight rejects a picker release whose range does
   not accept the core version in the repository.
6. **The picker has its own changelog.** Its entries move from the root `CHANGELOG.md` to
   `packages/nepdate-picker/CHANGELOG.md`. The root changelog covers the core and the patro.
7. **Trusted publishing replaces the token.** The publish job uses OIDC with `id-token: write`, the
   `production` environment and npm CLI `11.21.1`. npm generates provenance automatically for a
   trusted publish from a public repository, so `--provenance` is not passed and no `NPM_TOKEN`
   secret exists. The owner configures one GitHub trusted publisher per package with
   `npm trust github <package> --file release.yml --repo sanamhub/nepdate-typescript
   --env production --allow-publish`.
8. **The dist-tag rule covers both lines.** A stable version goes to `latest`; a pre-release goes to
   its first identifier (`beta`, `rc`), never to `latest`.

## Consequences

- The picker can release a fix between SDK releases, and an SDK release publishes no picker version.
- The picker's `0.1.0-beta.1` on npm stays the current picker version while the SDK moves to
  `0.1.0-rc.1`. Its install line names both versions: `nepdate-core@0.1.0-rc.1` and
  `nepdate-datepicker@0.1.0-beta.1`.
- Two tags exist, and the release runbook has one tag command for each line. A tag that names no
  package fails the preflight instead of publishing the wrong line.
- The picker's changelog is read from its package directory. A picker entry no longer appears in the
  root changelog or the SDK release notes.
- The npm CLI is installed in the publish job, so the npm bundled with Node 24 is not used for the
  publish. This keeps the trusted-publisher and dist-tag behaviour on a version that supports both.
