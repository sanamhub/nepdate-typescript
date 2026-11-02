# Runbook: release the SDK and the date picker (npm)

Decided in [ADR-0005](../adr/0005-releases.md) and [ADR-0018](../adr/0018-picker-own-version-and-tag.md).
Owner: maintainer. Approver: a second person. Two tags exist. `vX.Y.Z[-PRERELEASE]` releases
`nepdate-core` and `nepdate-patro`, which share one version. `datepicker-vX.Y.Z[-PRERELEASE]`
releases `nepdate-datepicker` on its own version. A tag releases only its own line. A package the
workflow has never published needs one manual publish first: see
[First publish of a new package](#first-publish-of-a-new-package).

This runbook is for the maintainer who runs the release. A release is not a CI run: read the whole
page before starting, and do not skip a precondition because the workflow is green.

## Preconditions

1. **U-04 is settled.** The source of the tithi, holiday and event data in `nepdate-patro` is known,
   and the owner has confirmed that the data may be published under the MIT license. U-04 is the
   open question in the hub's
   [proposals](https://github.com/sanamhub/nepdate/blob/main/docs/upstream/proposals.md#u-04-question-where-does-the-tithi-holiday-and-event-data-come-from).
   If it is not settled, stop. Publish no package: the core tarball is clean, but `nepdate-patro`
   carries the data.
2. **The owner approves.** The owner comments on the release pull request or the release issue with
   the version, the line (SDK or picker) and the date. An approval on the pull request is not an
   approval of the tag if the commit changed after it.
3. **`main` is green.** Every required check on the commit to tag has passed, including `ci`,
   `temporal`, `browser` and the OS matrix. A local `npm run ci` is not a substitute.
4. **The `production` environment has a reviewer.** In GitHub, Settings, Environments, `production`,
   at least one required reviewer is configured. The reviewer must not be the person who pushes the
   tag. The publish job waits for that approval.
5. **The version is ready.** For an SDK release, `packages/nepdate/package.json` and
   `packages/nepdate-patro/package.json` say X.Y.Z. `nepdate-patro` has
   `peerDependencies["nepdate-core"]` `~X.Y.Z` and no `devDependencies`. For a picker release,
   `packages/nepdate-picker/package.json` says its own X.Y.Z and its
   `peerDependencies["nepdate-core"]` range accepts the core version in the repository. The picker
   does not share the SDK version. Every package still has a zero runtime-dependency rule and no
   `devDependencies`; the workspace link supplies the local core during development.
   `package-lock.json` changed only as `npm install` required.
6. **The released line has a changelog.** An SDK release needs an empty `## [Unreleased]` and
   `## [X.Y.Z] - YYYY-MM-DD` in `CHANGELOG.md`. A picker release needs the same two in
   `packages/nepdate-picker/CHANGELOG.md`. A missing `[Unreleased]` heading is allowed, but any entry
   under it blocks the release.
7. **The release check passes.** From the repository root:

   ```
   node scripts/release-check.ts X.Y.Z
   node scripts/release-check.ts X.Y.Z --kind picker
   ```

   Run the command for the line being released. Every failure names the expected value. The SDK
   check covers the two manifests, the patro peer range, the empty `[Unreleased]` section and the
   root changelog. The picker check covers its manifest, its `nepdate-core` peer range, the empty
   `[Unreleased]` section and the picker changelog.

## Tag

A pre-release such as `0.1.0-rc.1` follows the same steps with its own dated changelog section
(`## [0.1.0-rc.1] - YYYY-MM-DD`); a stable section does not cover it and the other way round.

SDK release, from `main`:

```
git switch main
git pull --ff-only
git tag vX.Y.Z
git push origin vX.Y.Z
```

Picker release, from `main`:

```
git switch main
git pull --ff-only
git tag datepicker-vX.Y.Z
git push origin datepicker-vX.Y.Z
```

The tag push starts `release.yml`. Do not move or delete a tag after the publish job starts. If the
run fails before publishing, fix the cause and re-run the failed jobs; do not bump the version to get
around a failure. A tag that is neither `vX.Y.Z` nor `datepicker-vX.Y.Z` fails the version step
before anything is packed.

## Trusted publishing

The publish job uses npm trusted publishing over OIDC. There is no npm token and no `NPM_TOKEN`
secret. npm matches the publisher by repository, workflow file name and environment, so every
package gets one GitHub trusted publisher for `release.yml` in
`sanamhub/nepdate-typescript` with the `production` environment.

The owner, with write access to each package and 2FA on the account, runs one command per package:

```
npm trust github nepdate-core --file release.yml --repo sanamhub/nepdate-typescript --env production --allow-publish
npm trust github nepdate-patro --file release.yml --repo sanamhub/nepdate-typescript --env production --allow-publish
npm trust github nepdate-datepicker --file release.yml --repo sanamhub/nepdate-typescript --env production --allow-publish
```

`--allow-publish` is required: npm refuses a trust entry with no allowed action. `--file`,
`--repo` and `--env` are npm's short names for the workflow file, the repository and the
environment. `npm trust` needs npm 11.15.0 or later; `npm install -g npm@11.21.1` provides it.
`npm trust list <package>` prints the entries, and `npm trust revoke --id <id> <package>` removes
one before it is replaced. A new trust entry must complete its first publish within two days, so add
it when the release is ready, not months earlier.

After the first trusted publish, set each package to "Require 2FA and disallow tokens" in its
Publishing access settings. The publish job installs npm 11.21.1 itself, because Node 24 bundles an
older npm. Trusted publishing needs 11.5.1 or later, a publish-time dist-tag over OIDC needs 11.21.0
or 12.2.0, and `npm trust` needs 11.15.0.

## First publish of a new package

Trusted publishing is configured on a package that already exists, so a package new to npm is
published once by hand, then handed to the workflow. `nepdate-datepicker` was that package
(ADR-0015, Consequences): its first version was `0.1.0-beta.1`, the version the core and patro
already had on npm, so its `~0.1.0-beta.1` peer resolved. The owner did this by hand, not the
workflow.

1. The commit to publish from is on `main`, `ci` is green on it, and the package's version is one
   the other line already has on npm. Do it before the change that adds the package to
   `release.yml` merges: a tag pushed after that merge publishes the package with OIDC, which
   fails while no trusted publisher exists.
2. From a clean checkout of that commit, with npm 2FA enabled on the account:

   ```
   git switch main
   git pull --ff-only
   git status --short
   npm ci
   npm run build
   npm publish ./packages/nepdate-picker --access public --tag beta --dry-run
   npm publish ./packages/nepdate-picker --access public --tag beta
   ```

   `git status --short` must print nothing. The `./` keeps npm from reading the path as a GitHub
   `user/repo` shorthand. Read the dry-run file list first: `LICENSE`, `README.md`,
   `package.json`, `dist/theme.css`, `dist/nepdate-datepicker.js` and `dist/*.js`, `*.d.ts`,
   `*.d.ts.map`, nothing else (the rule `scripts/tarball-check.ts` applies in the workflow). npm
   asks for the 2FA code. `--tag beta` matches a `-beta.N` version; a stable version takes
   `--tag latest`. This publish has no provenance, because provenance needs the workflow's OIDC
   token; every later version has it.
3. Add the trusted publisher for `nepdate-datepicker` with the command above, then enable
   "Require 2FA and disallow tokens".
4. Check it: `npm view nepdate-datepicker@0.1.0-beta.1 version peerDependencies dist-tags`. The
   `beta` tag points at `0.1.0-beta.1`. `latest` also points there, because npm sets `latest` on
   a package's first publish whatever `--tag` says; the first stable release moves it.
5. Merge the change that adds the package to the workflow. From the next `datepicker-v*` tag on,
   the package is released by the workflow.

If npm refuses the name, stop and follow ADR-0015: the owner decides the fallback.

## What the workflow jobs do

`release.yml` has six jobs and two tag shapes. The default permission is `contents: read`; only
`publish` gets `id-token: write`, and only `github-release` gets `contents: write`. The kind step
reads `sdk` from `v*` and `picker` from `datepicker-v*`, and every pack, smoke, publish and verify
step that follows is limited to that line.

`pack` runs on a runner with no secrets:

1. Check out the tag with `persist-credentials: false`.
2. Set up Node 24.
3. Refuse a `workflow_dispatch` that is not a dry run. A dispatch can pack and check, never publish.
4. `npm ci` and `npm run ci`.
5. `scripts/release-version.ts` reads the tag and writes the version, the kind, the npm dist-tag,
   the core version, the package list and the tag to the job outputs. It rejects anything that is
   not strict `X.Y.Z` or `X.Y.Z-PRERELEASE`. The dist-tag is `latest` for a stable version and the
   first pre-release identifier otherwise (`beta` for `0.1.0-beta.1`).
6. `scripts/release-check.ts` checks the released line by kind and names the expected value on
   every failure.
7. An SDK release runs `scripts/data-status.ts`, which reads the built patro tables and blocks the
   release when fewer than 183 days of public holiday data remain. Tithi and event warnings are
   printed in the job log; copy them into the release notes by hand. A picker release skips it
   because it has no patro data.
8. Build the core and the line's other package. Pack the core and patro on an SDK tag, or only the
   picker on a picker tag, into `release-tarballs`.
9. `scripts/tarball-check.ts --kind` checks the expected tarballs. The SDK tarballs allow only
   `dist/`, `LICENSE`, `NOTICE`, `README.md` and `package.json`; the picker tarball has a narrower
   list and must contain `dist/theme.css` and `dist/nepdate-datepicker.js`. It checks the version
   and the peer range, and rejects `devDependencies`, runtime dependencies, install lifecycle
   scripts (`preinstall`, `install`, `postinstall`, and `prepare` with its hooks), tar members that
   are not regular files or directories, and paths with `.` or `..` segments. The picker's peer
   range is checked against the core version, not against the picker version. Then run `publint`
   and `attw` on each tarball (`attw` skips the picker's `theme.css` export, which has no types)
   and upload the directory including `SHA256SUMS` for seven days.

`smoke` needs `pack`. It has `contents: read`, no environment and no secret:

1. Check out the tag, download the `release-tarballs` artifact, and set up Node 24.
2. An SDK release creates a clean project, installs only `nepdate-core-X.Y.Z.tgz`, and runs the
   README core example. `scripts/smoke.ts --mode core` reads the example from `README.md`, runs it,
   and fails if `node_modules/nepdate-patro` exists.
3. The SDK release then installs the core and patro tarballs in a second clean project and runs the
   README patro example. `--mode patro` also checks `coverage()` reports BS 2077-01-01 to
   2084-08-20.
4. A picker release creates one clean project, installs the published `nepdate-core@CORE_VERSION`
   and the picker tarball, and runs `scripts/smoke.ts --mode picker`: the main entry loads in Node
   with no DOM, `monthGrid(2081, 4)` has 6 rows, and the package has `dist/theme.css` and a
   `dist/nepdate-datepicker.js` with no import. The core comes from the registry because a picker
   tag does not pack the SDK, so the core version in the repository must already be on npm: after
   an SDK version bump, push the SDK tag and let it publish before a picker tag.
5. No registry login is used. A broken README example fails this job, so the published npm page and
   the tarballs are checked against the same text.

`mutation` needs `pack`, has `contents: read`, and runs the mutation suite plus
`npm run mutation:check` before `publish` can start. A score below the floor or an untriaged survivor
blocks the release.

`publish` runs only when `github.event_name == 'push'` and the ref starts with `refs/tags/v` or
`refs/tags/datepicker-v`. It needs `pack`, `smoke` and `mutation`, and has `contents: read` and
`id-token: write`:

1. Wait for the `production` environment reviewer.
2. Check out the tag with full history, then refuse a commit that is not on `origin/main`:
   `git fetch --no-tags origin main` and `git merge-base --is-ancestor "$COMMIT_SHA" origin/main`.
   The SHA comes from `${{ github.sha }}` through `env`, never from a `run:` expression. A tag on a
   side branch stops here, before any tarball is downloaded.
3. Download the tarballs and `SHA256SUMS` from `pack`. The tag commit is checked out again for the
   changelog.
4. Set up Node with the npm registry, install npm 11.21.1, read the version, run `release-check`
   again, and run `sha256sum -c SHA256SUMS` before any package is published.
5. Publish only the line's packages, using only the downloaded tarballs. The publish job does not
   run `npm pack`. Each step first runs `npm view <name>@X.Y.Z version`; if the version already
   exists the step is skipped, so a half-finished release can be re-run without publishing twice.
   Publishing uses OIDC trusted publishing with `--access public --tag "$DIST_TAG"`. npm adds
   provenance automatically for a trusted publish from a public repository, so `--provenance` is
   not passed. The `--tag` is required: npm moves `latest` to anything published without it, so a
   beta would become what `npm install nepdate-core` installs. A static test fails if any
   `npm publish` lacks it. No `NODE_AUTH_TOKEN` is set.

`verify` needs `publish` and calls `verify-published.yml` with the version, the kind and the core
version. It has `contents: read`, `issues: write`, no `id-token`, no environment and no checkout. On
Linux, macOS and Windows, each with Node 22 and 24, it creates a clean project and installs the
released line exactly from the public registry, retrying every 30 seconds for up to 15 minutes. An
SDK release verifies `nepdate-core@X.Y.Z` and `nepdate-patro@X.Y.Z`; a picker release verifies
`nepdate-core@CORE_VERSION` and `nepdate-datepicker@X.Y.Z`. It checks the installed versions, runs
`npm audit signatures` (registry signatures and provenance), then the README quick start
(`NepaliDate.of(2081, 2, 15)`, `toGregorian`, `toJSON`, `long`), one `info()` call that checks
Republic Day for the SDK line, and one `monthGrid(2081, 4)` call that checks 6 rows for the picker
line. A failed verify job means the release is not done. `verify-published.yml` can also be
dispatched by hand with a version and a kind.

The workflow also runs on a schedule. Every Monday at 06:31 UTC it installs the latest version of
both lines on Linux once with npm, once with pnpm, once with Yarn in `node-modules` mode, once with
Yarn Plug'n'Play and once with bun, and runs the same checks. Every day at 03:27 UTC it reads the
registry document for both lines and sends a HEAD request for each tarball, without downloading
them. A failed scheduled run opens or updates one issue labelled `published-check`, titled
`Published nepdate-core <version> does not install or run`; a green run stays silent. Create the
`published-check` label once in the repository settings.

`github-release` needs `publish` and `verify` and is the only job with `contents: write`. It checks
out the tag, downloads the tarballs, runs `sha256sum -c SHA256SUMS` again, and creates the GitHub
Release named by the tag (`vX.Y.Z` or `datepicker-vX.Y.Z`) with the released tarballs attached.
`scripts/release-notes.ts --kind` writes the notes from the line's changelog section plus an install
block for the exact versions and a verification block. A version with a pre-release part becomes a
GitHub pre-release. Because the job waits for `verify`, a failed verify leaves no release page for
packages that are about to be deprecated.

If `verify` fails, do not publish the same files again and do not use a different build under the
same version. Deprecate the line's packages with a reason, fix the cause on `main`, and publish the
next patch version of that line with this runbook:

```
npm deprecate nepdate-core@X.Y.Z "reason, use X.Y.(Z+1)"
npm deprecate nepdate-patro@X.Y.Z "reason, use X.Y.(Z+1)"
npm deprecate nepdate-datepicker@X.Y.Z "reason, use the next picker version"
```

Use the first two for an SDK release and the third for a picker release.

The manual checks below remain useful evidence after `verify` passes.

## Verify on npm

Run these after the workflow finishes, before announcing the release.

SDK release:

```
npm view nepdate-core@X.Y.Z version
npm view nepdate-patro@X.Y.Z version peerDependencies
npm view nepdate-core@X.Y.Z dist.integrity dist.attestations
```

Picker release:

```
npm view nepdate-datepicker@X.Y.Z version peerDependencies
npm view nepdate-core@CORE_VERSION version
npm view nepdate-datepicker@X.Y.Z dist.integrity dist.attestations
```

`dist.attestations` must name the provenance attestation. On the npm page, the released versions
must show the provenance badge.

Install the published packages in a clean directory and verify the registry signatures:

```
mkdir nepdate-smoke && cd nepdate-smoke
npm init -y
npm install nepdate-core@X.Y.Z
npm audit signatures
node --input-type=module -e "import { NepaliDate } from 'nepdate-core'; console.log(NepaliDate.of(2081, 2, 15).toGregorian())"
test ! -d node_modules/nepdate-patro
```

Then pack the published tarball and check its shape, not the local one:

```
npm pack nepdate-core@X.Y.Z
npx publint nepdate-core-X.Y.Z.tgz
npx attw nepdate-core-X.Y.Z.tgz --profile esm-only
```

Repeat the install and `attw` check for the other package of the line: `nepdate-patro@X.Y.Z`, or
`nepdate-datepicker@X.Y.Z` with `--exclude-entrypoints ./theme.css`. Each must install
`nepdate-core` at the version its peer range allows. A local `npm pack` before publishing is not
evidence about the registry.

## Smoke installs

The `smoke` job runs the installs for the line on every release. Run them again by hand only if the
job was skipped or a tarball was rebuilt outside the workflow. Core only: a clean project installs
`nepdate-core@X.Y.Z`, runs the README core example, and has no `node_modules/nepdate-patro`. SDK
both packages: a second clean project installs both versions and runs the README patro example,
and checks `coverage()` reports BS 2077-01-01 to 2084-08-20. Picker: one clean project installs
`nepdate-core@CORE_VERSION` and `nepdate-datepicker@X.Y.Z` and runs
`scripts/smoke.ts --mode picker`. If Deno is available, run the `npm:nepdate-core@X.Y.Z` example
from the README. Record the Node, npm and Deno versions in the release notes.

## Rollback

Do not `npm unpublish`. It is allowed only for 72 hours, breaks every install that already resolved
the version, and does not fix a bad tarball.

If a published version is wrong:

1. Deprecate the line's packages with a reason, using the commands in
   [What the workflow jobs do](#what-the-workflow-jobs-do).
2. Fix the cause on `main`, add a changelog entry under `## [Unreleased]` in the line's changelog,
   and release the next patch version of that line with this runbook.
3. Note the deprecation and the replacement in the changelog and the GitHub Release.

If the failure is after `nepdate-core` is published and before `nepdate-patro` is, fix the cause
and re-run the failed publish job. It skips the version that already exists. Do not lower the
version.

## Name fallback

The npm name `nepdate-core` may be rejected as too similar to the existing `nep-date`. The registry
decides at publish time; the owner decides the fallback at that moment, not before.

If npm rejects the name:

1. Stop the release. Do not publish the patro package under the old name and do not move the tag.
2. Ask the owner to choose. The fallback is the scoped pair `nepdate-core` and
   `nepdate-patro`. A scoped package is public only with `--access public`.
3. Change both `name` fields, the patro `peerDependencies` key, the README imports, the `npm view`
   names in `release.yml`, and the trusted publishing configuration on npmjs.com.
4. Run `npm install` so the lockfile agrees, run `npm run ci`, and open a pull request. Tag a new
   commit with the same X.Y.Z only after the pull request is green and approved. Never move a tag
   that has been pushed.
5. Configure trusted publishing for both scoped names, then run this runbook again.

The version and the tag format do not change. The changelog and the GitHub Release use the scoped
names after the switch.

## After releasing

1. Check the released npm pages: version X.Y.Z, provenance badge, the right README.
2. Add an empty `## [Unreleased]` section to the line's changelog in a pull request.
3. Close the release issue with the npm links, the GitHub Release link and the smoke results.
