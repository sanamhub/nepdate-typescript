# T10: Release gates and post-publish verification

Branch `feat/T10-release-gates` from `ab75514` (T9 merged after review). Read first: the T9 review
row in `docs/plan/PROGRESS.md`, ADR-0009, ADR-0010, ADR-0005, `docs/runbooks/release.md`,
`.github/workflows/release.yml`, `scripts/release-check.ts`, and the Go G12, Python P10/P11 and
Rust W4-00 plans.

T9 closed the oldest-Node, API snapshot and example gaps. T10 closes the release path: stale patro
data, a non-empty `[Unreleased]` section, unchecked tarballs and no proof that the registry installs.
The phase runs no benchmark or mutation job, so the shared machine stays free for the reviewer.

## T10-00 Plan

- Add this file, the T10 roadmap row and the PROGRESS rows.
- Every task below has acceptance criteria that a command, a test or the checkpoint can check.

AC:
- The roadmap has a T10 row pointing here.
- PROGRESS has rows for the plan, every task and the checkpoint.

## T10-01 Data freshness

- Add `scripts/data-status.ts`, standard library only except the package under test. It imports the
  built `packages/nepdate-patro/dist/build.js`, not `shared/data/patro/*.json`, and finds the first
  and last day with a tithi, a public holiday and an event.
- `--today YYYY-MM-DD` is an AD date. With no flag the script uses the current UTC date. `--help`
  says both. A missing, malformed or impossible date exits 2.
- Print one line per kind with the BS range, the AD range and the days left from `--today`. Public
  holidays are the release blocker: fewer than 183 days exits 1 and names the holiday range. Tithi
  and events print a `WARNING` line and exit 0. Exactly 183 days passes.
- Fixed-date tests on the real built tables: AD 2027-06-03 passes with 183 holiday days and AD
  2027-06-04 fails with 182, the same dates as Go, Python and Rust. The tests also cover the help
  default text, the pass and fail exit codes, and a bad `--today`.
- `release.yml` runs the script in the `pack` preflight after `release-check`. `ci.yml` does not run
  the script. The tests run in gate 9, after both builds, and are not the release gate.

AC:
- `node scripts/data-status.ts --today 2027-06-03` exits 0 and prints `183 days left` for holidays.
- `node scripts/data-status.ts --today 2027-06-04` exits 1 and prints `182 days left` and the
  holiday failure.
- `node scripts/data-status.ts --help` says the default is the current UTC date and the flag takes
  an AD date.
- `node --test scripts/data-status.test.ts` passes on the built tables.
- `release.yml` has a `Data status` step in `pack`; `ci.yml` has no `data-status` step.
- The script prints a tithi warning on 2027-06-03 and still exits 0.

## T10-02 Release check

- `scripts/release-check.ts` fails when the `## [Unreleased]` section has non-blank content before
  the next version heading. A missing `[Unreleased]` heading stays valid, as in Python P11.
- Every failure names what was expected, not only what was found. The existing version, peer,
  dev-range and changelog failures are reworded to include `expected`; the new failure says the
  section must be empty.
- Add one negative control per check to `packages/nepdate/test/release-check.test.ts`: core version,
  patro version, peer range, dev range, missing changelog section and a non-empty `[Unreleased]`.
  Every negative case asserts the expected value appears in the message. A passing fixture with an
  empty `[Unreleased]` is also tested.
- Update `docs/runbooks/release.md` to name the empty `[Unreleased]` precondition and the expected
  values.

AC:
- `node scripts/release-check.ts 0.1.0` passes on the branch.
- A fixture with a bullet under `[Unreleased]` exits 1 and names `[Unreleased]` and the expected
  empty section.
- Every negative-control test asserts an `expected` value in stderr.
- No public API or package behaviour changes.

## T10-03 Tarball rehearsal

- Add `scripts/tarball-check.ts`. It reads each `.tgz` from `--dir`, parses the tar members and
  requires only `package/dist/**`, `package/LICENSE`, `package/NOTICE`, `package/README.md` and
  `package/package.json`. A source, test, script or map outside `dist/` fails.
- Parse the tarball's `package.json` and fail when the version is not the release version, the
  patro peer range is not `~X.Y.Z`, `devDependencies` is present, or a runtime dependency is
  present. The core tarball must not carry a patro peer or a dev dependency.
- The patro source manifest currently carries `devDependencies.nepdate` only for the workspace.
  Remove that field and rely on the npm workspace link, so the tarball cannot carry it. Update
  `release-check`, the runbook and ADR-0011 to match. The package still has exactly one peer
  dependency and no runtime dependency.
- `--sums <path>` writes a sorted `SHA256SUMS` file in `sha256sum -c` format. The `pack` job runs
  the check after `npm pack`, uploads the tarballs and the sums file, and the `publish` job
  downloads them, runs `sha256sum -c`, and publishes only those files. The publish job never runs
  `npm pack`.
- Static tests in `packages/nepdate/test/release-workflow.test.ts` check the pack step, the sums
  artifact and the publish check. Negative controls: a workflow without the tarball check, and a
  publish job that runs `npm pack` instead of using the artifact.
- `scripts/tarball-check.test.ts` covers the member and manifest rules with an allowed fixture and
  one negative per rule. It runs in gate 9, after both builds; the CLI is also run once on locally
  packed 0.1.0 tarballs.
- ADR-0011 records the member allow-list, the manifest rules, the dev-dependency removal and the
  SHA-256 handoff.

AC:
- `node scripts/tarball-check.ts --version 0.1.0 --dir <packed-tarballs>` exits 0 on both real
  tarballs, prints the member count, and writes `SHA256SUMS`.
- A fixture with `package/src/index.ts`, `package/test/a.test.ts`, `package/scripts/x.ts` or
  `package/app.js.map` outside `dist` fails. A manifest with the wrong version, wrong peer,
  `devDependencies` or a runtime dependency fails.
- `release.yml` runs the check in `pack`, uploads `release-tarballs/` including `SHA256SUMS`, and
  `publish` verifies the sums before either `npm publish`. `publish` contains no `npm pack`.
- The workflow negative controls fail as expected.
- `node --test scripts/tarball-check.test.ts` passes.
- ADR-0011 and the runbook describe the rules.

## T10-04 Post-publish verify

- Add a `verify` job to `.github/workflows/release.yml` with `needs: publish`. It runs on
  `ubuntu-latest`, has `permissions: contents: read`, no `id-token`, and SHA-pinned actions.
- Create a clean temporary project, `npm init -y`, and install `nepdate@X.Y.Z` and
  `nepdate-patro@X.Y.Z` from the public registry. Retry a failed install for up to 600 seconds with
  a 30 second pause, then fail.
- Run the README quick start (`NepaliDate.of(2081, 2, 15)`, `toGregorian`, `toJSON`, `long`) and
  one `info()` call on the installed packages. Use the exact version from `needs.publish` through
  `env`, never inside a `run` expression.
- Static tests in `packages/nepdate/test/release-workflow.test.ts` check the job, its needs,
  permissions, pinning, exact installs, retry window, quick start and `info()` call. Negative
  controls: missing job, wrong needs, `id-token: write`.
- Extend `docs/runbooks/release.md` with an "After the publish" section: what `verify` installs and
  runs, and what to do when it fails. The response is to deprecate both packages, fix the cause and
  publish the next patch; no unpublish and no rebuilding the same version.
- ADR-0011 records the verify job and the failure response.

AC:
- `packages/nepdate/test/release-workflow.test.ts` passes and its three verify negative controls
  fail as expected.
- The verify job needs `publish`, installs both exact versions, retries for 600 seconds, runs the
  README quick start and one `info()` call, and has only `contents: read`.
- `docs/runbooks/release.md` has the job and the deprecate-both, next-patch response.
- No tag, publish, remote, setting or secret change.

## Checkpoint

The implementation agent stops after T10-04. The reviewer checks:

- [ ] `data-status` reads the built tables, passes at AD 2027-06-03 with 183 holiday days, fails at
      2027-06-04 with 182, prints the tithi warning, and runs in `release.yml` but not `ci.yml`.
- [ ] `release-check` rejects a non-empty `[Unreleased]`, every failure prints the expected value,
      and there is one negative control per check.
- [ ] The pack job checks the tarball members and manifest, uploads one `SHA256SUMS`, and publish
      verifies those sums and publishes only the downloaded files. The negative controls pass.
- [ ] The verify job follows publish, uses the registry, retries for 10 minutes, runs the quick
      start and `info()`, has `contents: read` and no `id-token`, and its runbook response is
      deprecate both and publish the next patch.
- [ ] Every static and unit test runs in `npm run ci`; gate 12 still reports 87 entries.
- [ ] A fresh clone on `E:\temp` runs `npm ci && npm run ci` and its last line is pasted in
      PROGRESS and the checkpoint report.
- [ ] No benchmark or mutation run; no tag, publish, remote, setting or secret change.
