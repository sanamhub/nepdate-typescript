# T5: Docs, benchmarks, release 0.1.0

Read first: ADR-0002 §10, `shared/spec/BENCHMARK.md`, ADR-0005, `docs/competitors.md`, `docs/runbooks/release.md`,
`shared/spec/PORT-PLAN.md` phase 5.

## Tasks

### T5-01 Docs
- TSDoc on every export of both packages (what it does, returns, `@throws`, an `@example`).
- Root `README.md` (copied into the `nepdate` tarball as its npm page): quick start for Node, Deno
  (`npm:nepdate`) and a browser `<script type="module">`, a Temporal example, and a short
  "Patro (tithi, holidays, events)" section that installs `nepdate-patro` and calls `info()`. Absolute links.
- `packages/nepdate-patro/README.md` (its npm page): install both packages, one `info()` example,
  the coverage limit (BS 2077-01-01 to 2084-08-20) and the data provenance note from
  `shared/data/README.md`. Absolute links.
- No README in the core tarball may contain an event name: use Republic Day (2081-02-15) in
  examples, never 2081-04-15 (its events include `World Day Against Human Trafficking`, which gate 6 rejects).

AC: `scripts/docs-check.ts`, added to `npm run ci` as gate 10 (ADR-0004; it runs after both
builds), passes and checks that:
- every ` ```ts ` block of the root `README.md` and of `packages/nepdate-patro/README.md`, written to
  `.readme-check/<n>.ts` at the repository root (git-ignored) and run with `node`, exits 0
  (PORT-PLAN phase 5: the quick start runs in CI). The Deno block (it imports `npm:nepdate`) is
  skipped; the browser example is an ` ```html ` block and is not run;
- every exported declaration in `packages/*/dist/*.d.ts` has a `/** ... */` comment directly
  above it.

### T5-02 Benchmarks against competitors and C# (`bench/`)
Follow `shared/spec/BENCHMARK.md` exactly; this task only adds what is TypeScript-specific.
- `bench/package.json` (from T1-06): add the nine packages of `docs/competitors.md`, pinned
  exactly. Never in the root `package.json`.
- `bench/compare.ts`: for each competitor, B1 and B2 through the call listed in
  `docs/competitors.md` (string APIs get `YYYY-MM-DD` strings built before the timed loop, so only
  the call is timed), on the 64 dates of BENCHMARK §2. Our own rows are B1 to B8 from
  `bench/own.ts`. Every result goes to `do_not_optimize`; B5 results are also read (last char code)
  so ropes are flattened inside the measurement.
- Run: `npm run build`, then from `cmd`:
  `start /affinity 4 /wait /b node --expose-gc bench/compare.ts` (logical CPU 2, BENCHMARK §1),
  one benchmark per process as in T1-06, machine idle, on AC power.
- "agrees": a competitor agrees when its result for all 64 dates in both directions equals
  `shared/data` (computed by our own `NepaliDate`, which the vectors already prove). A package that
  disagrees is listed with its numbers but never ranked above one that agrees.
- Allocation: mitata's heap per operation under `--expose-gc`, labelled "approx." in the table;
  marked "not measured" for B5 and B6, where V8 ropes make it unreliable (BENCHMARK §4).
- Size: esbuild `--bundle --minify --format=esm` of each package's conversion entry, gzip level 9.
  `nepdate` alone, and `nepdate-patro` in its own row.
- `docs/benchmarks.md`: the BENCHMARK §5 layout (machine table, Node and package versions, the
  exact command, the date) with one table: ID, `nepdate` ns/op, approx. bytes/op, each competitor's
  ns/op and agrees, and the C# NepDate column copied from the hub's `docs/benchmarks/dotnet.md`
  (.NET 10: B1 13.29, B2 18.64, B3 17.50, B4 18.85, B5 153.02, B6 21.55, B7 47.93, B8 3133).
  A second table gives bundle sizes.

AC:
- `docs/benchmarks.md` has B1 to B8 for `nepdate`, B1 and B2 for all nine competitors with the
  agrees column, the C# column and the size table.
- `node --expose-gc bench/compare.ts` runs to the end from a clean `npm ci` in `bench/`.
- Every target of ADR-0002 §10 and BENCHMARK §6 (TypeScript: B1, B2 and B7 within 3× of C#) is
  met, or the PR reports the miss with the numbers and a `--cpu-prof` profile.

### T5-03 Release workflow + runbook
`.github/workflows/release.yml` and `scripts/release-check.ts` per ADR-0005 and
`docs/runbooks/release.md`.
AC:
- A `workflow_dispatch` dry run packs both packages, runs `publint` and `attw` on each tarball, and
  skips publishing.
- `node scripts/release-check.ts 0.1.0` fails when the two `version` fields differ, when
  `peerDependencies.nepdate` in `nepdate-patro` is not `~0.1.0`, or when the changelog has no
  `## [0.1.0]` section (one test each).
- The publish job publishes `nepdate` before `nepdate-patro`, and skips a package whose version
  is already on npm (`npm view`).

### T5-04 0.1.0
Set `"version": "0.1.0"` in both package manifests, `peerDependencies.nepdate` to `~0.1.0` and
`devDependencies.nepdate` to `0.1.0` in `nepdate-patro`, run `npm install` so the lockfile agrees,
and move `[Unreleased]` to `## [0.1.0] - <date>`. **Agent stops here.** The human tags and
approves.

## Checkpoint

The implementation agent stops at T5-04, before any tag. The reviewer checks:
- [ ] `npm run ci` passes with gate 10; every README `ts` block ran.
- [ ] `docs/benchmarks.md` follows BENCHMARK §5, names the exact command with `/affinity 4`, and has
      the C# column; no competitor that disagrees is ranked first.
- [ ] B1, B2 and B7 are within 3× of C# NepDate and the ADR-0002 §10 targets are met, or the miss is
      reported with numbers.
- [ ] A release dry run (`workflow_dispatch`, `dry-run: true`) packed both packages and published
      nothing.
- [ ] Both versions are 0.1.0, `peerDependencies.nepdate` is `~0.1.0`, and the changelog has
      `## [0.1.0]`.
