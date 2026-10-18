# T8: Mutation testing and bench evidence

Branch `feat/T8-mutation` from `6c6fdb3` (T7 merged, review commit `659531c`). Read first:
ADR-0002, ADR-0004, ADR-0006, `docs/benchmarks.md`, `.github/workflows/release.yml`,
`scripts/ci.ts`, and the T7 review row in `docs/plan/PROGRESS.md`.

T7 reviewed the benchmark page and the release workflow. It found four gaps for this phase: the
benchmark rows have no committed raw output, `measure.ts` samples load only before a row, the smoke
script runs only at release time, and its coverage range is hard-coded. Mutation testing has never
run. This phase closes those gaps. It does not run a quiet benchmark pass: the machine is shared and
the reviewer runs quiet passes when it is idle.

## T8-00 Plan

- Add this file, the T8 roadmap row and the PROGRESS rows.
- Every task below has acceptance criteria that a test, a command or the checkpoint can check.

AC:
- The roadmap has a T8 row pointing here.
- PROGRESS has rows for the plan, every task and the checkpoint.

## T8-01 Stryker setup and ADR-0007

- Add `@stryker-mutator/core` and `@stryker-mutator/vitest-runner` as exact root
  `devDependencies`, at the same version.
- Add one config per package: `stryker.core.conf.json` for `packages/nepdate/src/` and
  `stryker.patro.conf.json` for `packages/nepdate-patro/src/`. Each names its package's
  `vitest.config.ts` and the package test directory.
- Scope: every `.ts` file under the two `src/` trees, excluding `*.gen.ts` and any path ADR-0004
  excludes from coverage. Nothing else is mutated. Static mutants are ignored, because the Stryker
  10 Vitest runner does not reload a module evaluated at import time under Vitest 5; the first run
  showed a constructor mutant reported survived even when it broke the import.
- `concurrency` is at most 4; the committed value is 2, because four Vitest workers on this
  machine hit a V8 out-of-memory crash in the property test. The Stryker temp and incremental
  directories are under `D:\devcache\stryker\`; the JSON reports go to `reports/mutation/`.
- Add `npm run mutation` to run both configs in order, after a build so the patro tests resolve
  `nepdate`.
- Add `docs/adr/0007-mutation-testing.md`: the tool and pins, the scope and exclusions, the score
  formula, the equivalent-mutant rule, the floor rule and where it runs. The floor is filled in by
  T8-04 after triage.

AC:
- `npm run mutation -- --help` or a scoped `npx stryker run <config> --mutate <one file>` starts and
  uses the vitest runner, the configured concurrency and the D: temp directory.
- The config's `mutate` list contains both sources and neither generated table; a dry run reports
  the expected file count and no generated file.
- ADR-0007 states the tool, pins, scope, score formula, equivalent rule, floor rule and run
  locations.

## T8-02 First full run and committed summary

- Run both configs once on the tree at the start of the phase. Record the wall time and
  concurrency.
- Commit `docs/mutation/<date>/summary.json` and `summary.md` with the counts per file:
  killed, survived, timeout, no coverage, runtime error and compile error, plus the totals.
- Quote Stryker's own summary line. The score is `killed + timeout` over
  `killed + timeout + survived + no coverage`, as the Stryker metrics page defines it.
- Keep the raw Stryker JSON out of the commit; commit the summary and the list of survivors that
  T8-03 needs.

AC:
- `summary.json` has one entry per mutated file and totals that add up to Stryker's total.
- `summary.md` names the date, commit, wall time, concurrency and Stryker summary line.
- The counts and score in the summary match the report; no number comes from another machine.

## T8-03 Triage every survivor

For every mutant with status `Survived` or `NoCoverage`:
- Add one test that kills it, named after the behaviour, next to that module's tests, with one
  behaviour per test; or
- Add an entry to `docs/mutation/equivalent.md` with the mutant id, the source diff and a one-line
  proof that the mutant cannot change observable behaviour.

"Hard to test" is not equivalence. A survivor that shows a real bug stops the task: add a failing
test marked `it.fails`, record it as a finding in the summary, and report it.

After triage, run both configs again and commit the second summary under
`docs/mutation/<date>/after/`.

AC:
- Every survivor and no-coverage mutant from the first run has a killing test or an equivalent
  entry; the second run has no untriaged survivor.
- The equivalent entries name a real mutant id, show the diff and give a proof that is not "hard to
  test".
- The before and after scores are both in the summary, and every new test fails when its mutant is
  applied (checked by the second Stryker run).
- If a real bug is found, its `it.fails` test and finding are in the summary and the PR.

## T8-04 Automation

- Add `scripts/mutation-check.ts`. It reads the two Stryker JSON reports, computes the score and
  per-file counts, reads the floor from `docs/mutation/floor.json`, reads the ids in
  `docs/mutation/equivalent.md`, and exits non-zero when:
  - the score is below the floor, or
  - a survived or no-coverage mutant has no equivalent entry.
- Add `scripts/mutation-check.test.ts` with fixtures for a passing report, a below-floor report and
  an untriaged survivor. The below-floor case is the negative control.
- Add `npm run mutation:check` and make it part of the mutation command's final step.
- Add `mutation` to `.github/workflows/release.yml` before `publish`; `publish` needs it. It runs
  both configs and the check, and a score below the floor blocks the release.
- Add `.github/workflows/mutation.yml`, on a weekly schedule and manual dispatch only, never on a
  pull request. It runs the same two configs and the check and uploads the two JSON reports.
- Set the floor to the T8-03 score rounded down; write it in `floor.json` and ADR-0007.

AC:
- `node scripts/mutation-check.ts` passes on the T8-03 reports and exits 1 on a report below the
  floor and on a report with an untriaged survivor.
- `node --test scripts/mutation-check.test.ts` passes with the passing, below-floor and untriaged
  cases.
- `release.yml` has a `mutation` job that runs before `publish`, and `publish` needs it.
- `mutation.yml` runs on `schedule` and `workflow_dispatch` only, with no `pull_request` trigger.
- `docs/mutation/floor.json` and ADR-0007 state the same floor.

## T8-05 Bench evidence and the load sample

- `bench/own.ts`, `bench/compare.ts`, `bench/order.ts` and `bench/dotnet.ts` gain
  `--out <dir>`. Each writes its JSON output to `<dir>/<name>.json`; the docs name
  `bench/results/<date>/` as the directory every future pass commits.
- `bench/measure.ts` samples background load during a row. The figure is the mean busy percentage
  of every CPU except the pinned CPU 2, because the benchmark keeps CPU 2 busy. A row is `LOADED`
  when that during-row figure is above 15%, as well as when the before-row all-CPU figure is.
- The before-row figure stays in the row. The new during-row figure is a new field, and the JSON
  row, the table and the summary print it.
- Refactor the CPU split and the load decision into pure functions in `bench/load.ts`. Add
  `bench/load.test.ts` with cases for the split, the mean and the 15% decision; no benchmark is
  spawned. The negative control is a synthetic sample above 15% that must be marked `LOADED`.
- Update `docs/benchmarks.md` with the new fields and the committed-results rule. Do not add new
  measured numbers.

AC:
- Each of the four scripts writes its JSON to the given `--out` directory and still prints its
  normal table.
- `bench/measure.ts` records a during-row background figure that excludes CPU 2, and the row's
  `loaded` flag is true when either figure is above 15%.
- `node --test bench/load.test.ts` passes, including a negative control above 15%.
- `docs/benchmarks.md` says every future pass commits `bench/results/<date>/` and describes both
  load figures. No new benchmark number is presented as a verdict.

## T8-06 Packed smoke gate

- Add a gate to `scripts/ci.ts` that packs both packages into a temporary directory, creates two
  clean temporary projects and installs the tarballs with npm offline, then runs
  `scripts/smoke.ts --mode core` and `--mode patro`.
- The expected coverage range comes from `shared/data/patro/` (the first and last day keys), not a
  literal in `scripts/smoke.ts`. The patro tables are generated from the same data, so either source
  is allowed; the script uses the shared data.
- The gate runs after both builds and after the docs gate, so it is gate 11.
- Negative control: a broken README block makes the gate fail; revert it.

AC:
- `node scripts/ci.ts` runs gate 11 and its last line becomes `ci: 11/11 gates passed`.
- The gate installs only local tarballs with npm offline; it does not read a registry.
- The core project has no `nepdate-patro`; the patro project reports the shared-data range.
- Negative control: the first README `ts` block with an invalid day fails the gate and names the
  block; revert.

## Checkpoint

The implementation agent stops after T8-06. The reviewer checks:

- [ ] The Stryker pins are exact and ADR-0007 records tool, scope, floor and run locations.
- [ ] The first full run is committed with wall time, concurrency and per-file counts, and its
      score is quoted from Stryker's summary.
- [ ] Every survivor has a killing test or an equivalent entry with id, diff and proof.
- [ ] The check script exits non-zero below the floor and on an untriaged survivor.
- [ ] `release.yml` has the mutation job before `publish`; the weekly workflow has no PR trigger.
- [ ] `--out` writes the four JSON files and `measure.ts` records the during-row figure without
      CPU 2.
- [ ] Gate 11 packs, installs offline and runs both smoke modes; the coverage range comes from the
      shared data.
- [ ] A fresh clone runs `npm ci && npm run ci` and ends with `ci: 11/11 gates passed`.
- [ ] No tag, publish, remote, setting or secret changed.
