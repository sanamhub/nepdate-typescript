# bench

The TypeScript side of `shared/spec/BENCHMARK.md`. The published numbers and their load are in
[`../docs/benchmarks.md`](../docs/benchmarks.md); this page is the map for a reviewer who wants to
rerun or extend a row.

## One process per row

`bench/own.ts` and `bench/compare.ts` are parents. For every row they spawn a fresh
`node --expose-gc bench/measure.ts` through
`cmd /c start "" /affinity 4 /wait /b`, so the row runs on logical CPU 2 with a new JIT, heap and
import graph. The child prints one JSON object on stdout; the parent prints the table or `--json`.

`bench/measure.ts` is also the process that imports a competitor package. A core-only row never
imports `nepdate-patro`, and a competitor row imports only its own package plus `nepdate` for the
expected dates.

Run from the repository root after `npm run build`:

```
node bench/own.ts
node bench/compare.ts
node bench/compare.ts --check
node bench/order.ts
node bench/dotnet.ts
```

`--json` prints the collected rows and writes nothing else to stdout. Progress goes to stderr.

## Load

Before a measurement the child samples the all-CPU busy share and the busy share of core 2. If the
all-CPU figure is above 15%, it waits 5 s and retries, five times. A row that is still above 15% is
marked `LOADED` and is kept out of target verdicts. The gate is all-CPU, not core 2 alone: the
benchmarks run at 35% to 90% load while core 2 is often below 15%, and the loaded all-CPU runs are
much slower. A final verdict needs a quiet all-CPU run.

`bench/dotnet.ts` records the all-CPU load before, during and after the BenchmarkDotNet job.
BenchmarkDotNet pins itself to core 2, so a core-2 sample during the job would measure the job
itself.

## Agreement ranges

`bench/ranges.ts` holds the documented BS and AD range of every competitor and cites the README or
code line in the pinned package under `bench/node_modules`. Where a package documents only its BS
range, the AD range is the Gregorian equivalent of the BS endpoints through `shared/data`, and the
`basis` is `derived`.

B1 is judged on dates whose BS value is inside the BS range; B2 on dates whose AD value is inside the
AD range. The `--check` output prints the in-range count, the out-of-range dates and the first
in-range mismatch, without measuring. Timing uses the in-range dates only, so `ns/op` is divided by
the number of dates that were timed, not always 64.

B2 returns a BS date. The old harness compared it with the AD expected date; that is why every B2
row looked like a mismatch at the first date. The expected string is now `INPUTS[i].bsIso`, and
`nepali-date-converter` gets its 0-based month plus one.

## Adding a competitor

1. Add the exact version to `bench/package.json` and run `npm install` in `bench/`.
2. Add its B1 and B2 calls to `bench/competitors.ts`.
3. Add its documented ranges and source lines to `bench/ranges.ts`.
4. Run `node bench/compare.ts --check`, then `node bench/compare.ts`.
5. Add the row to `../docs/benchmarks.md`, in `../docs/competitors.md` order.

No package is ranked. A package that disagrees is shown with its number and the first mismatch.
