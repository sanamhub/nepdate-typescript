# T7: Release hardening and the quiet benchmark pass

Branch `feat/T7-release-quiet` from `fa694e2` (T6 merged). Read first: ADR-0005, ADR-0006,
`docs/runbooks/release.md`, `docs/benchmarks.md`, `.github/workflows/release.yml`, and the Python
port's `test_release_workflow.py` for the static-test shape.

T6 left four open items: no smoke job in `release.yml`, no `NODE_AUTH_TOKEN` for the first-release
token path, no check that the tag commit is on `origin/main`, and no type-check of `bench/` or
`scripts/`. The quiet benchmark pass was never made. This phase closes those gaps and records what
the quiet numbers say, or says plainly that the machine never became quiet.

## T7-01 Smoke job

- Add a `smoke` job to `release.yml`, after `pack`, using the uploaded `release-tarballs` artifact.
  It has `permissions: contents: read`, no `environment`, no secrets and no registry login.
- The job creates two clean projects. The core project installs only `nepdate-X.Y.Z.tgz`, runs the
  README core example, and asserts `node_modules/nepdate-patro` does not exist. The patro project
  installs both tarballs, runs the README patro example, and checks `coverage()` reports
  BS 2077-01-01 to 2084-08-20.
- `scripts/smoke.ts` extracts the examples from `README.md`, so a broken README breaks the job:
  `--mode core|patro --project <dir>`.
- `publish` needs `smoke` as well as `pack`.
- Update `docs/runbooks/release.md`.

AC:
- `release.yml` has `smoke` with `needs: pack`, the artifact download, both projects, the no-patro
  assertion and the coverage check; `publish` has `needs: [pack, smoke]`.
- `node scripts/smoke.ts --mode core --project <tmp>` and `--mode patro --project <tmp>` pass on
  locally packed 0.1.0 tarballs, with the load line showing the installed version.
- Negative control: in a throwaway branch, the first README `ts` block calls
  `NepaliDate.of(2081, 2, 32)`; the core smoke run exits 1 and names the failing example. Revert.
- The static test in T7-02 checks the smoke job's shape.

## T7-02 Release workflow gaps

(a) The `publish` checkout uses `fetch-depth: 0`. Before downloading or publishing, a step passes
`${{ github.sha }}` through `env` as `COMMIT_SHA`, checks it is a 40-character lowercase hex SHA,
runs `git fetch --no-tags origin main`, and runs
`git merge-base --is-ancestor "$COMMIT_SHA" origin/main`. A tag that is not on `origin/main` fails
before any tarball is downloaded.

(b) Both publish steps get `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`. When the secret is empty the
step unsets the variable before `npm publish`, so npm takes the OIDC path. This is needed because
`actions/setup-node@v7` writes the token line into `.npmrc` when `registry-url` is set, and the v7
release notes say OIDC does not use `NODE_AUTH_TOKEN`; the trusted-publishing example passes no
token. Update the runbook's first-release section with the fallback rule and cite
[the setup-node v7 notes](https://github.com/actions/setup-node#whats-new-in-v7) and
[the trusted-publishing example](https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md#publishing-to-npm-with-trusted-publisher-oidc).
The secret is not created in this phase.

(c) Add `packages/nepdate/test/release-workflow.test.ts`, a static test of `release.yml` in the
shape of the Python port's `test_release_workflow.py`. Rules: default `contents: read`; no
expression inside a `run:`; every action pinned by SHA; `publish` on a tag push, in `production`,
with `contents: write` and `id-token: write`; full-history checkout; `COMMIT_SHA` via `env`; fetch
`origin/main`; `merge-base` before publish; `NODE_AUTH_TOKEN` and the empty-secret `unset` on both
publish steps; `publish` needs `pack` and `smoke`; smoke has no environment, no secret and uses the
artifact. The negative fixture changes one rule at a time and expects one message for each.

AC:
- The test passes on the shipped workflow.
- Its negative fixture reports a write default, an unpinned action, an expression in `run`, a missing
  main check, a publish before the main check, a missing `NODE_AUTH_TOKEN`, and a missing smoke need.
- The runbook documents the empty-token `unset` rule and cites the setup-node pages.
- No secret, token or repository setting is changed.

## T7-03 Type-check and the report parser test

- Add `tsconfig.tools.json` at the root, extending `tsconfig.base.json`, `noEmit`, `types: ["node"]`,
  `allowImportingTsExtensions`, and `include: ["bench/**/*.ts", "scripts/**/*.ts"]`. Override only
  the declaration-only options and the two index checks that the tool code does not satisfy today.
- Gate 9 runs `npm ci --prefix bench`, then `npx tsc -p tsconfig.tools.json` and
  `node --test bench/report.test.ts`, after both packages are built. The bench package is separate
  from the root workspaces and its type imports need the built packages, so it cannot run in gate 1
  before the builds. The gate name changes to say so.
- Move the BenchmarkDotNet CSV reader out of `bench/dotnet.ts` into `bench/dotnet-report.ts` with
  `parseReportText`, `parseReport`, `parseCsvLine` and `scaled` exported.
- `bench/report.test.ts` covers a `ns` cell, a `μs` cell, a `KB` allocation cell, a quoted method
  name with a comma, a `-` allocation cell and an unknown unit that throws.

AC:
- `npx tsc -p tsconfig.tools.json` passes; a deliberate type error in a bench file makes gate 9 fail
  and is reverted.
- `node --test bench/report.test.ts` passes with the six cases.
- `bench/dotnet.ts` still runs `--csv` on the T6 report and prints the same eight rows.

## T7-04 Quiet benchmark pass

- Run `bench/own.ts`, `bench/dotnet.ts`, `bench/compare.ts` and `bench/order.ts` when the machine is
  quiet. Use the night if the day stays loaded.
- Every row is either ADR-0006 quiet (all-CPU at most 15% before the row, or the C# run's median at
  most 15%) or `LOADED` and pending. A loaded row decides nothing.
- Update `docs/benchmarks.md` with the new numbers, the load next to every row, and the verdict table.
- Do not change the 15% limit, the retry count, a target or a 3x rule. Changing any needs a new ADR
  the owner approves.

AC:
- The four commands have output from one session; the C# report path and load samples are recorded.
- `docs/benchmarks.md` marks every row final or LOADED, and every 3x check has both columns quiet or
  says pending.
- If the machine never becomes quiet, the page says that and lists every row as LOADED; no number is
  presented as a verdict.

## T7-05 Profiles for B1 and B6

- B1's last final number was 31.9 ns against 30. B6 was 244.9 ns against 64 and the 90 ns prototype.
- On a quiet run, take `node --expose-gc --cpu-prof --cpu-prof-dir=D:\devcache\profiles` for
  `bench/measure.ts --impl nepdate --op B1` and `--op B6`, pinned to CPU 2.
- Summarise where the time goes by function and file from the `.cpuprofile` samples.
- Then either fix it with before and after numbers and the exhaustive and fuzz tests green, or
  report the miss with the profile and leave the decision to the owner. No guessing.

AC:
- Two `.cpuprofile` files exist for the quiet run and the page or PR names the top functions with
  their self-time share.
- B1 and B6 each have a before number, a decision, and either an after number with the full test suite
  green or a written miss for the owner.
- No target is changed.

## Checkpoint

The implementation agent stops after T7-05. The reviewer checks:

- [ ] `smoke` runs on locally packed tarballs, fails on a broken README example, and `publish` needs
      it.
- [ ] The static release-workflow test passes and its negative fixture reports every rule.
- [ ] The tag-on-main check is in `publish`, and the first-release token step unsets an empty
      `NODE_AUTH_TOKEN`.
- [ ] `tsconfig.tools.json` is in gate 9 and the parser test has the six cases.
- [ ] The quiet pass is recorded, or the page says the machine never became quiet and every row is
      LOADED.
- [ ] B1 and B6 have profiles and a decision; no target changed.
- [ ] A fresh clone runs `npm ci && npm run ci` and ends with `ci: 10/10 gates passed`.
- [ ] No tag, publish, remote, secret or repository setting changed.
