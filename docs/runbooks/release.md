# Runbook: release `nepdate` and `nepdate-patro` (npm)

Decided in [ADR-0005](../adr/0005-releases.md). Owner: maintainer. Approver: a second person. One
tag releases both packages with the same version.

This runbook is for the human who runs the release. The implementation agent stops before the tag.
A release is not a CI run: read the whole page before starting, and do not skip a precondition
because the workflow is green.

## Preconditions

1. **U-04 is settled.** The source of the tithi, holiday and event data in `nepdate-patro` is known,
   and the owner has confirmed that the data may be published under the MIT license. U-04 is the
   open question in the hub's
   [proposals](https://github.com/sanamhub/nepdate/blob/main/docs/upstream/proposals.md#u-04-question-where-does-the-tithi-holiday-and-event-data-come-from).
   If it is not settled, stop. Publish neither package: the core tarball is clean, but the release
   is one tag and one version for both.
2. **The owner approves.** The owner comments on the release pull request or the release issue with
   the version and the date. An approval on the pull request is not an approval of the tag if the
   commit changed after it.
3. **`main` is green.** Every required check on the commit to tag has passed, including `ci`,
   `temporal`, `browser` and the OS matrix. A local `npm run ci` is not a substitute.
4. **The `production` environment has a reviewer.** In GitHub, Settings, Environments, `production`,
   at least one required reviewer is configured. The reviewer must not be the person who pushes the
   tag. The publish job waits for that approval.
5. **The version is ready.** Both `packages/nepdate/package.json` and
   `packages/nepdate-patro/package.json` say X.Y.Z. `nepdate-patro` has
   `peerDependencies.nepdate` `~X.Y.Z` and no `devDependencies`; the workspace link supplies the
   local core during development. `package-lock.json` changed only as `npm install` required.
   `CHANGELOG.md` has an empty `## [Unreleased]` and `## [X.Y.Z] - YYYY-MM-DD`. A missing
   `[Unreleased]` heading is allowed, but any entry under it blocks the release.
6. **The release check passes.** From the repository root:

   ```
   node scripts/release-check.ts X.Y.Z
   ```

   Every failure names the expected value. The command checks both versions, the peer range, the
   empty `[Unreleased]` section and the dated changelog section.

## Tag

```
git switch main
git pull --ff-only
git tag vX.Y.Z
git push origin vX.Y.Z
```

The tag push starts `release.yml`. Do not move or delete a tag after the publish job starts. If the
run fails before publishing, fix the cause and re-run the failed jobs; do not bump the version to get
around a failure.

### First release only

Trusted publishing is configured per package on npmjs.com, so both packages must exist before it can
be used. For 0.1.0 only:

1. Create one granular access token: read and write, all packages, expires in one day. Store it as
   `NPM_TOKEN` in the `production` environment. Do not paste it anywhere else.
2. Push the tag and approve the environment. The workflow publishes both packages with the token and
   `--provenance`. Both publish steps receive `NODE_AUTH_TOKEN` from `secrets.NPM_TOKEN` and unset
   it when the secret is empty, so no empty token is configured. `npm publish` (npm 11.5.1 or later)
   tries OIDC trusted publishing first, using the job's `id-token: write`, and uses a token it
   obtains that way in place of any configured one; only when the exchange fails does it fall back
   to `NODE_AUTH_TOKEN`. For the first publish there is no trusted publisher yet, so the exchange
   fails and the token is used. After steps 3 and 4 OIDC wins even while the secret still exists,
   which is why step 5 deletes it rather than relying on it being ignored. `actions/setup-node@v7`
   no longer writes a dummy token
   ([v7 notes](https://github.com/actions/setup-node#whats-new-in-v7),
   [OIDC example](https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md#publishing-to-npm-with-trusted-publisher-oidc)).
3. On npmjs.com, for `nepdate`: Settings, Trusted publishing, repository
   `sanamhub/nepdate-typescript`, workflow `release.yml`, environment `production`. Then enable
   "Require 2FA and disallow tokens".
4. Repeat step 3 for `nepdate-patro`.
5. Delete the token on npmjs.com and the `NPM_TOKEN` secret. Remove the token fallback from
   `release.yml` in the next pull request.

## What the workflow jobs do

`release.yml` has five jobs. The default permission is `contents: read`; only `publish` gets
`contents: write` and `id-token: write`.

`pack` runs on a runner with no secrets:

1. Check out the tag with `persist-credentials: false`.
2. Set up Node 24.
3. Refuse a `workflow_dispatch` that is not a dry run. A dispatch can pack and check, never publish.
4. `npm ci` and `npm run ci`.
5. `scripts/release-version.ts` reads the version from the tag (push) or the core manifest
   (dispatch), rejects anything that is not strict `X.Y.Z`, and writes it to the job output.
6. `scripts/release-check.ts` checks both manifests, the peer range, the empty `[Unreleased]`
   section and the changelog section, and names the expected value on every failure.
7. `scripts/data-status.ts` reads the built patro tables and blocks the release when fewer than
   183 days of public holiday data remain. Tithi and event warnings are printed and copied into the
   release notes.
8. Build both packages, `npm pack` each one into `release-tarballs`, and run
   `scripts/tarball-check.ts --sums release-tarballs/SHA256SUMS`. The check allows only `dist/`,
   `LICENSE`, `NOTICE`, `README.md` and `package.json` in each tarball, checks the version and peer
   range, and rejects `devDependencies` or runtime dependencies. Then run `publint` and `attw` on
   each tarball and upload the directory including `SHA256SUMS` for seven days. The job output
   carries the version to `smoke`.

`smoke` needs `pack`. It has `contents: read`, no environment and no secret:

1. Check out the tag, download the `release-tarballs` artifact, and set up Node 24.
2. Create a clean project, install only `nepdate-X.Y.Z.tgz`, and run the README core example.
   `scripts/smoke.ts --mode core` reads the example from `README.md`, runs it, and fails if
   `node_modules/nepdate-patro` exists.
3. Create a second clean project, install both tarballs, and run the README patro example.
   `--mode patro` also checks `coverage()` reports BS 2077-01-01 to 2084-08-20.
4. No registry login is used. A broken README example fails this job, so the published npm page and
   the tarballs are checked against the same text.

`mutation` needs `pack`, has `contents: read`, and runs the mutation suite plus
`npm run mutation:check` before `publish` can start. A score below the floor or an untriaged survivor
blocks the release.

`publish` runs only when `github.event_name == 'push'` and the ref starts with `refs/tags/v`. It needs
both `pack` and `smoke`:

1. Wait for the `production` environment reviewer.
2. Check out the tag with full history, then refuse a commit that is not on `origin/main`:
   `git fetch --no-tags origin main` and `git merge-base --is-ancestor "$COMMIT_SHA" origin/main`.
   The SHA comes from `${{ github.sha }}` through `env`, never from a `run:` expression. A tag on a
   side branch stops here, before any tarball is downloaded.
3. Download the tarballs and `SHA256SUMS` from `pack`. The tag commit is checked out again for the
   changelog.
4. Set up Node with the npm registry, read the version and run `release-check` again. Run
   `sha256sum -c SHA256SUMS` before either package is published.
5. Publish `nepdate`, then `nepdate-patro`, using only the downloaded tarballs. The publish job does
   not run `npm pack`. Each step first runs
   `npm view <name>@X.Y.Z version`; if the version already exists the step is skipped, so a
   half-finished release can be re-run without publishing twice. Publishing uses OIDC trusted
   publishing and `--provenance --access public`; the token fallback is above.
6. Create the GitHub Release `vX.Y.Z` from the changelog section and attach both tarballs.

`verify` needs `publish`. It has `contents: read`, no `id-token` and no environment. It creates a
clean temporary project and installs `nepdate@X.Y.Z` and `nepdate-patro@X.Y.Z` from the public
registry. A failed install is retried every 30 seconds for up to 10 minutes. It then runs the README
quick start (`NepaliDate.of(2081, 2, 15)`, `toGregorian`, `toJSON`, `long`) and one `info()` call
that checks Republic Day. A failed verify job means the release is not done.

If `verify` fails, do not publish the same files again and do not use a different build under the
same version. Deprecate both packages with a reason, fix the cause on `main`, and publish the next
patch version of both with this runbook:

```
npm deprecate nepdate@X.Y.Z "reason, use X.Y.(Z+1)"
npm deprecate nepdate-patro@X.Y.Z "reason, use X.Y.(Z+1)"
```

The manual checks below remain useful evidence after `verify` passes.

## Verify on npm

Run these after the workflow finishes, before announcing the release:

```
npm view nepdate@X.Y.Z version
npm view nepdate-patro@X.Y.Z version peerDependencies
npm view nepdate@X.Y.Z dist.integrity dist.attestations
```

`dist.attestations` must name the provenance attestation. On the npm page, both versions must show
the provenance badge.

Install the published packages in a clean directory and verify the registry signatures:

```
mkdir nepdate-smoke && cd nepdate-smoke
npm init -y
npm install nepdate@X.Y.Z
npm audit signatures
node --input-type=module -e "import { NepaliDate } from 'nepdate'; console.log(NepaliDate.of(2081, 2, 15).toGregorian())"
test ! -d node_modules/nepdate-patro
```

Then pack the published tarball and check its shape, not the local one:

```
npm pack nepdate@X.Y.Z
npx publint nepdate-X.Y.Z.tgz
npx attw nepdate-X.Y.Z.tgz --profile esm-only
```

Repeat the install and `attw` check for `nepdate-patro@X.Y.Z`; it must install `nepdate@X.Y.Z` as its
peer. A local `npm pack` before publishing is not evidence about the registry.

## Smoke installs

The `smoke` job runs the two installs on every release. Run them again by hand only if the job was
skipped or a tarball was rebuilt outside the workflow. Core only: a clean project installs
`nepdate@X.Y.Z`, runs the README core example, and has no `node_modules/nepdate-patro`. Both
packages: a second clean project installs both versions, runs the README patro example, and checks
`coverage()` reports BS 2077-01-01 to 2084-08-20. If Deno is available, run the
`npm:nepdate@X.Y.Z` example from the README. Record the Node, npm and Deno versions in the release
notes.

## Rollback

Do not `npm unpublish`. It is allowed only for 72 hours, breaks every install that already resolved
the version, and does not fix a bad tarball.

If a published version is wrong:

1. Deprecate both packages with a reason:

   ```
   npm deprecate nepdate@X.Y.Z "reason, use X.Y.(Z+1)"
   npm deprecate nepdate-patro@X.Y.Z "reason, use X.Y.(Z+1)"
   ```

2. Fix the cause on `main`, add a changelog entry under `## [Unreleased]`, and release X.Y.(Z+1) of
   both packages with this runbook.
3. Note the deprecation and the replacement in the changelog and the GitHub Release.

If the failure is after `nepdate` is published and before `nepdate-patro` is, fix the cause and
re-run the failed publish job. It skips the version that already exists. Do not lower the version.

## Name fallback

The npm name `nepdate` may be rejected as too similar to the existing `nep-date`. The registry
decides at publish time; the owner decides the fallback at that moment, not before.

If npm rejects the name:

1. Stop the release. Do not publish the patro package under the old name and do not move the tag.
2. Ask the owner to choose. The fallback is the scoped pair `@sanamhub/nepdate` and
   `@sanamhub/nepdate-patro`. A scoped package is public only with `--access public`.
3. Change both `name` fields, the patro `peerDependencies` key, the README imports, the `npm view`
   names in `release.yml`, and the trusted publishing configuration on npmjs.com.
4. Run `npm install` so the lockfile agrees, run `npm run ci`, and open a pull request. Tag a new
   commit with the same X.Y.Z only after the pull request is green and approved. Never move a tag
   that has been pushed.
5. Configure trusted publishing for both scoped names, then run this runbook again.

The version and the tag format do not change. The changelog and the GitHub Release use the scoped
names after the switch.

## After releasing

1. Check both npm pages: version X.Y.Z, provenance badge, the right README.
2. Add an empty `## [Unreleased]` section to `CHANGELOG.md` in a pull request.
3. Close the release issue with the npm links, the GitHub Release link and the smoke results.
