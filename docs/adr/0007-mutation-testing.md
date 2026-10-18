# ADR-0007: Mutation testing

- Status: Accepted
- Date: 2026-10-18
- Deciders: Sanam Pakuwal

## Context

ADR-0004 requires 90% line coverage of both `src/` trees. Coverage says a line ran, not that a test
would notice if the line changed. T8 adds a mutation gate so a weak assertion cannot pass as a
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
   Tests, bench code, scripts, docs and the shared data are not mutated. Static mutants are outside
   the measured set (`ignoreStatic: true`): the Stryker 10 Vitest runner does not reload a module
   evaluated at import time under Vitest 5, so it reported a constructor mutant as survived even
   when the mutant made the import throw. The runner records those skipped mutants as survived, so
   the summary and the check filter the `static` flag; the normal suite still covers the load-time
   behaviour. The measured set is the 1,146 non-static mutants.

3. **Score.** The score is Stryker's mutation score:
   `(killed + timeout) / (killed + timeout + survived + no coverage) * 100`.
   Runtime errors, compile errors, ignored mutants and pending mutants are not part of the
   denominator. The score is reported before and after triage. The 1,510 total from the first run
   includes the 364 static mutants that are now ignored; the measured set is 1,146.

4. **Equivalent mutants.** A survivor is either killed by a new test or listed in
   `docs/mutation/equivalent.md` with its mutant id, the source diff and a one-line proof that no
   input can observe the change. "Hard to test" is not a proof. The check script rejects a survivor
   that is in neither place. A real bug found by a survivor is a finding, not an equivalent entry.

5. **Floor.** The floor is the score after T8-03 triage, rounded down to a whole percentage. It is
   stored in `docs/mutation/floor.json` and repeated in this ADR. A report below the floor, or a
   survivor without an equivalent entry, fails `scripts/mutation-check.ts` and blocks a release.

6. **Where it runs.** `npm run mutation` runs both configs after a build. Concurrency is 2, which
   keeps two Vitest runners inside the memory of the shared machine; the first attempt at 4 hit a
   V8 out-of-memory crash in the property test. On Windows the Stryker temp directory and
   incremental file are under `D:\devcache\stryker\`; other platforms use `.stryker-tmp/`. JSON
   reports go to `reports/mutation/` and are not committed. The release workflow runs the mutation
   job before `publish`. A separate weekly workflow runs the same check and uploads the reports; it
   never runs on a pull request.

## Consequences

- A release is blocked when tests stop noticing a change, not only when they fail.
- The first run is slow (1,510 mutants at 10.0.0) and runs at most four workers, so it stays off the
  per-PR path.
- Equivalent mutants stay in the score as survivors. The floor accounts for them, and the
  equivalent list keeps them from being counted as untriaged.
- The floor has to be raised by a person when a change adds killed mutants. Lowering it needs a new
  ADR.
