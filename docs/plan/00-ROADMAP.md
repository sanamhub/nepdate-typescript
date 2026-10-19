# Roadmap (TypeScript port)

Each phase is one PR (or a short series), sized so an agent finishes it in one session and a
reviewer reads it in about an hour. Task IDs `T<phase>-<n>`; branch `feat/T1-03-serial`; commit
`feat(nepdate): T1-03 serial conversion` (scope `nepdate-patro` for that package). Phases map to
hub `shared/spec/PORT-PLAN.md` phases 0 to 5 one to one (T0 = phase 0, ... T5 = phase 5).

```
T0 repo + CI ─► T1 core + conversion ─► T2 arithmetic/fiscal/range ─┐
                         └────────────► T3 format + parse ───────────┴─► T4 patro + interop ─► T5 docs, bench, release
```

Preconditions: hub task H0 merged, so `shared/VERSION` holds a hub commit (today it reads
`pending`, so T0 can't start yet); hub H3 merged before T0-05. T2 and T3 may run in parallel.

| Phase | File | Output |
|---|---|---|
| T0 | `T0-repo-and-ci.md` | npm workspaces with both packages, tsconfig, Biome, Vitest, CI script, generator skeleton, community files |
| T1 | `T1-core-and-conversion.md` | `NepaliDate`, errors, generated tables, BS↔AD, vectors, exhaustive |
| T2 | `T2-arithmetic-fiscal-range.md` | add days/months/years, diff, fiscal year, range |
| T3 | `T3-format-and-parse.md` | `short`/`long`/`format`, strict and lenient parse |
| T4 | `T4-patro-and-interop.md` | package `nepdate-patro`, `today()`, `fromJSDate`/`toJSDate`, Temporal-shaped interop |
| T5 | `T5-docs-bench-release.md` | docs, benchmarks vs competitors, release workflow for both packages, 0.1.0 |
| T6 | `T6-bench.md` | one process per measurement, same-machine C#, in-range agreement, load discipline, release runbook |
| T7 | `T7-release-quiet.md` | release smoke job, workflow static tests and token fallback, tool type-check, quiet benchmark pass, B1/B6 profiles |
| T8 | `T8-mutation.md` | mutation testing and triage, release and weekly mutation gates, committed bench JSON, packed smoke gate |
| T9 | `T9-api-minnode.md` | tested Node 22.12 floor, public API snapshot gate, runnable TSDoc examples |
| T10 | `T10-release-gates.md` | patro data freshness, release-check, tarball rehearsal, post-publish verification |
| T11 | `T11-workflow-yaml.md` | workflow tests parse the YAML instead of matching text |
| T12 | `T12-workflow-coverage.md` | parsed tests for every workflow, shared pin and expression rules |

## Checkpoints

The implementation agent stops at the end of every phase, opens the PR and waits for review. Each
phase file ends with a "Checkpoint" section: the list the reviewer works through before the next
phase starts. Performance is the first priority (ADR-0002), so from T1 on every checkpoint includes
the `bench/own.ts` output for the operations that phase added.

## C# test catalogue

`shared/spec/vectors/csharp-tests/catalog.tsv` (hub task H5, PORT-PLAN "C# test catalogue") lists
every test of C# NepDate's own suite at `cb05cb65`: 395 `[Fact]` rows and 147 `[InlineData]` rows,
each tagged with a phase, `n/a` or a PARITY deviation. It is in `shared/` since 2026-10-09;
T0-04 stops if it is missing.

| Catalogue tag | Phase | Test file | Package |
|---|---|---|---|
| phase 1 | T1 (T1-05) | `test/csharp-catalog.test.ts` | `nepdate` |
| phase 2 | T2 (T2-06) | `test/csharp-catalog.test.ts` | `nepdate` |
| phase 3 | T3 (T3-06) | `test/csharp-catalog.test.ts` | `nepdate` |
| phase 4, patro rows | T4 (T4-05) | `test/csharp-catalog.test.ts` | `nepdate-patro` |
| phase 4, interop rows | T4 (T4-05) | `test/csharp-catalog.test.ts` | `nepdate` |
| `n/a` (C#-only API such as `TypeConverter` or XML) | none | none | |
| a PARITY deviation | the phase of the API it concerns | the same file, as a deviation entry | |

Rules:
- Each row becomes one Vitest test named exactly after the row's `id`, through `checkCatalog`
  (T0-04): `cases[id]` is a function with the C# test's assertions translated to the API in
  `docs/API.md`, or `{ deviation: "D-nn" }` when PARITY says the port behaves differently.
- A row with no entry fails the run with its `id`, so a phase can't pass with rows left out.
- When the hub adds or retags rows, `shared-sync` brings them in and the catalogue test fails until
  the new rows are handled.
- On top of the catalogue, each phase adds what TypeScript allows and C# doesn't test: fast-check
  property tests with a fixed seed, the parser fuzz test (T3-05), type-level tests with
  `expectTypeOf` and `@ts-expect-error` (T1-05), runtime and time-zone matrices (ADR-0004).
  Allocation is not asserted in tests (V8 gives no reliable per-call count); the benchmark reports
  it.

## Definition of Done (every task)

1. Every acceptance criterion has a test (or a line in the PR saying why it can't).
2. `npm run ci` passes.
3. No export beyond `docs/API.md`; no runtime `dependencies`.
4. `CHANGELOG.md` `[Unreleased]` updated for anything a user would notice.
5. Prose follows `.claude/skills/writing-style/SKILL.md`. PR has "What to look at first".

## Milestones

| Milestone | Phases | Exit |
|---|---|---|
| M1 converts | T0–T1 | month-boundary vectors + exhaustive round-trip pass |
| M2 parity | T2–T3 | all C# golden rows pass except `PARITY.md` deviations |
| M3 0.1.0 | T4–T5 | `nepdate` and `nepdate-patro` 0.1.0 on npm with provenance, benchmark table published |
