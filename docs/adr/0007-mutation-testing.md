# ADR-0007: Mutation testing

- Status: Accepted
- Date: 2026-10-18
- Deciders: Sanam Pakuwal

## Context

ADR-0004 requires 90% line coverage of both `src/` trees. Coverage says a line ran, not that a test
would notice if the line changed. A mutation gate keeps a weak assertion from passing as a
strong test. The gate has to be affordable on a shared developer machine and in CI, and it must not
mutate generated tables or files that the coverage rule leaves out.

## Decision

1. **Tool and pins.** StrykerJS is the mutation tool: `@stryker-mutator/core` 10.0.0 with
   `@stryker-mutator/vitest-runner` 10.0.0, both exact root `devDependencies`. The runner uses the
   project's Vitest 5.0.3. The two configs are `stryker.core.conf.mjs` and
   `stryker.patro.conf.mjs`, built from `stryker.base.mjs`. The runner uses `related: false`
   because the tests import `../src/*.js`, which Vitest's related mode does not map back to the
   `.ts` files in the Stryker sandbox. Per-test coverage analysis still selects the covering tests
   for each mutant.

2. **Scope.** Only `packages/nepdate/src/**/*.ts` and `packages/nepdate-patro/src/**/*.ts` are
   mutated. `*.gen.ts` files are excluded: `scripts/codegen.ts` owns them and the codegen gate
   checks them. ADR-0004 excludes no other path from coverage, so no other path is excluded here.
   Tests, bench code, scripts, docs and the shared data are not mutated. Static mutants (code that
   runs while a module is imported, such as the table builds) are measured like the rest
   (`ignoreStatic: false`). The Stryker 10 Vitest runner drops a test file that throws at import
   instead of counting a failure, so a static mutant that made the import throw was reported
   survived. Each package therefore has `test/entry-load.test.ts`, which imports the entry inside a
   test, so the throw is a failed test. Static mutants run the whole suite and are the slow part of
   a run.

   The Stryker 10 Vitest runner also builds its per-mutant test-name filter with names joined by a
   space while Vitest 5 joins them with " > " (stryker-js#6210). The Stryker Vitest configs widen
   each space in the filter to accept either joiner; the filter selects a superset of the covering
   tests, never a subset. The shim is removed when the pins move past the upstream fix.

3. **Score.** The score is Stryker's mutation score:
   `(killed + timeout) / (killed + timeout + survived + no coverage) * 100`.
   Runtime errors, compile errors, ignored mutants and pending mutants are not part of the
   denominator. The score is reported before and after triage. All 1,512 mutants are measured,
   364 of them static.

4. **Equivalent mutants.** A survivor is either killed by a new test or listed in
   `docs/mutation/equivalent.md` with its mutant id, the source diff and a one-line proof that no
   input can observe the change. "Hard to test" is not a proof. The check script rejects a survivor
   that is in neither place. A real bug found by a survivor is a finding, not an equivalent entry.
   The check also rejects a listed mutant that the report shows killed (its proof is wrong) or does
   not contain (the source moved under the list, so the ids must be triaged again). A listed mutant
   that timed out is not flagged, because a timeout on a loaded machine proves nothing.

5. **Floor.** The floor is the score after the first triage, rounded down to a whole percentage. The
   measured score is 93.98% over all 1,512 mutants, so the floor is **93**. It is stored in `docs/mutation/floor.json` and
   repeated in this ADR. A report below the floor, or a survivor without an equivalent entry, fails
   `scripts/mutation-check.ts` and blocks a release.

6. **Where it runs.** `npm run mutation` runs both configs after a build. Concurrency is 2, which
   keeps two Vitest runners inside the memory of the shared machine; the first attempt at 4 hit a
   V8 out-of-memory crash in the property test. The Stryker temp directory and incremental file
   are under `.stryker-tmp/`, or under `STRYKER_TEMP` when it is set. JSON reports go to
   `reports/mutation/` and are not committed. The release workflow runs the mutation job before
   `publish`. A separate weekly workflow runs the same check and uploads the reports; it never runs
   on a pull request.

## Consequences

- A release is blocked when tests stop noticing a change, not only when they fail.
- A full run is slow (1,512 mutants, about 20 minutes at two workers on the shared machine), so it
  stays off the per-PR path.
- Equivalent mutants stay in the score as survivors. The floor accounts for them, and the
  equivalent list keeps them from being counted as untriaged.
- The floor has to be raised by a person when a change adds killed mutants. Lowering it needs a new
  ADR.
