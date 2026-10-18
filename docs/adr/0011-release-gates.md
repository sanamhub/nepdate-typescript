# ADR-0011: Release gates and post-publish verification

- Status: Accepted
- Date: 2026-10-18
- Deciders: Sanam Pakuwal

## Context

T9 made the build and API contracts testable, but the release path still trusted files that nothing
checked. The patro data can run out, `[Unreleased]` can hold an entry for the version being tagged,
a tarball can carry a source file or a development-only field, and a green publish job does not prove
that the registry serves the two exact versions. Go G12, Python P10/P11 and Rust W4-00 solved the
same problems in their ports. This ADR applies their rules to npm.

## Decision

1. **Data freshness reads the built tables.** `scripts/data-status.ts` imports the built
   `packages/nepdate-patro/dist/build.js` and `dist/tables.gen.js`. It does not read
   `shared/data/patro/*.json`, because the release must test the same tables the package ships.
   `--today YYYY-MM-DD` is an AD date and defaults to the current UTC date, as in Go, Python and
   Rust. Public holidays are the blocker: fewer than 183 days left exits 1. Tithi and events print a
   warning and keep exit 0. Exactly 183 days passes.

   The `pack` job runs the script after `release-check`. `ci.yml` does not run it, because a pull
   request should not fail when the data is close to its end. The fixed-date tests use the real
   tables at AD 2027-06-03 (183 holiday days, pass) and 2027-06-04 (182, fail), the same dates as
   the other ports.

2. **A release needs an empty `[Unreleased]`.** `scripts/release-check.ts` reads the body of
   `## [Unreleased]` up to the next version heading. Non-blank content fails. A missing heading is
   allowed. Every failure names the expected value, not only the value found. The existing checks
   cover the two package versions, the peer range and the dated changelog section.

3. **The tarballs are checked before upload.** `scripts/tarball-check.ts` parses each `.tgz` and
   allows only `package/dist/**`, `package/LICENSE`, `package/NOTICE`, `package/README.md` and
   `package/package.json`. A source, test or script path, or a map outside `dist/`, fails. The
   `package.json` in the tarball must name the release version, must carry the patro peer range
   `~X.Y.Z`, and must not carry `devDependencies`, `dependencies` or `optionalDependencies`. The core
   tarball must not carry a patro peer.

   The patro source manifest no longer lists `nepdate` in `devDependencies`. The npm workspace still
   links the local core for development and tests. This supersedes only the devDependency sentence
   in ADR-0001 §1; the peer dependency and the one-version rule are unchanged.

4. **Publish uses the checked bytes.** `pack` writes `release-tarballs/SHA256SUMS` in
   `sha256sum -c` format and uploads the directory as the `release-tarballs` artifact. `publish`
   downloads that artifact, runs `sha256sum -c SHA256SUMS`, and publishes those `.tgz` files. It does
   not run `npm pack`. A changed byte or a rebuilt tarball stops the job before either package is
   published.

5. **The registry is verified after publish.** A `verify` job with `needs: publish` runs on
   `ubuntu-latest` with `permissions: contents: read`, no `id-token` and SHA-pinned actions. It
   creates a clean project and installs `nepdate@X.Y.Z` and `nepdate-patro@X.Y.Z` from the public
   registry. A failed install retries for up to 600 seconds with a 30 second pause. It then runs the
   README quick start and one `info()` call that checks Republic Day.

   When verification fails, the release is not done. Do not publish the same files again and do not
   use a different build for the same version. Deprecate both packages, fix the cause on `main`, and
   publish the next patch version of both. `docs/runbooks/release.md` carries the commands.

## Consequences

- A release now fails on stale holiday data, a non-empty `[Unreleased]`, an unexpected tarball
  member, a manifest leak, a changed tarball or a registry install that does not run.
- The pack job and the verify job each add a few minutes. The retry window covers npm propagation
  delay without hiding a permanent failure.
- The patro package no longer declares a development dependency. A consumer and the workspace both
  resolve the peer `nepdate`; the shipped manifest carries only that peer.
- The tarball check duplicates a little of npm's packing rules on purpose. It checks the file that
  will be uploaded, not the source tree or a dry run.
- No public API or runtime behaviour changes. No tag, publish, remote, setting or secret is part of
  this decision.
