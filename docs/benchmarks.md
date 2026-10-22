# Benchmarks

Operations B1 to B8 of [`shared/spec/BENCHMARK.md`](https://github.com/sanamhub/nepdate/blob/main/spec/BENCHMARK.md),
run on 2026-10-18. Every row runs in a fresh process pinned to logical CPU 2. Before each
TypeScript measurement the child samples the all-CPU load; if it is at or above 15% it waits 5 s and
retries, five times. During the row it samples the mean busy share of every CPU except CPU 2,
because the benchmark keeps CPU 2 busy by design. A row is marked `LOADED` when either figure is
at or above 15%, and a loaded row is kept out of target verdicts. [ADR-0008](adr/0008-during-row-background-load.md)
records the during-row rule. The C# column was measured on this machine in the same session, not
copied from the hub.

This pass has a mix: B1, B2, B5, B6, B7 and B8 are final; B3 and B4 ran loaded. The C# run itself had
a median 77% load, so every 3× C# check is pending under [ADR-0006](adr/0006-same-machine-csharp-column-and-load-gate.md)
even where the TypeScript row is final. No target, 3× rule or load limit was changed.

## Machine

| Item | Value |
|---|---|
| CPU | 12th Gen Intel Core i5-12500H, 12 cores, 16 logical processors, 3.10 GHz |
| RAM | 31.7 GB |
| OS | Microsoft Windows 11 Home, 10.0.26300, 64-bit |
| Node | 24.20.0 |
| npm | 12.2.0 |
| mitata | 1.0.34 |
| .NET SDK | 10.0.402 |
| .NET runtime | 10.0.13, X64 |
| BenchmarkDotNet | 0.15.8 |
| C# NepDate | 2.0.7, from nuget.org |
| Hub checkout | `c6cc327` |
| Pinned to | logical CPU 2 (`/affinity 4`, and `WithAffinity(0x4)` in the C# job) |
| Date | 2026-10-18 |
| Load, `nepdate-core` rows | 5% to 74% busy (per row below) |
| Load, C# run | 17% before, 77% median during, 100% max, 87% after |
| Load, competitors | 6% to 78% busy (per row below) |
| Load, order pairs | 20% to 95% busy, all pairs loaded |
| Load, profiles | B1 11.7%, B6 13.2% |

Exact commands, from the repository root after `npm run build`:

```
node bench/own.ts --out bench/results/<date>
node bench/dotnet.ts --out bench/results/<date>
node bench/compare.ts --out bench/results/<date>
node bench/order.ts --out bench/results/<date>
```

Every future pass commits `bench/results/<date>/` with `own.json`, `dotnet.json`, `compare.json`
and `order.json`, so each number on this page has a source in the tree. The 2026-10-18 pass predates
the `--out` flag and the during-row field; its rows keep the before-row load only.

`bench/own.ts` and `bench/compare.ts` spawn one `node --expose-gc bench/measure.ts` per row under
`cmd /c start "" /affinity 4 /wait /b`. `bench/dotnet.ts` runs the hub's `tools/dotnet-bench` with
NuGet and build caches on `D:\devcache\dotnet`; the command it used is:

```
dotnet run -c Release -f net10.0 -p:BaseOutputPath=D:\devcache\dotnet\bin\ -p:BaseIntermediateOutputPath=D:\devcache\dotnet\obj\ --project E:\github\sanamhub\nepdate\tools\dotnet-bench -- --filter * --artifacts D:\devcache\dotnet\artifacts\2026-10-18T04-29-32
```

The BenchmarkDotNet report is at
`D:\devcache\dotnet\artifacts\2026-10-18T04-29-32\results\DotnetBench.Benchmarks-report.csv`. The
job runs the .NET 8 column too; only the .NET 10 rows are used here.

## `nepdate-core` and C#

Time is nanoseconds per single operation. B8 is one whole month grid. Bytes are mitata's heap delta
under `--expose-gc`, marked approximate; B5 and B6 are "not measured" because V8 rope strings make
the figure unreliable (BENCHMARK §4). The C# time and bytes are BenchmarkDotNet's mean and allocated
bytes per operation. `LOADED` means the row ran at or above 15% load and is excluded from target
verdicts.

| Op | Operation | `nepdate-core` ns/op | load | core 2 | bytes/op | status | C# .NET 10 ns/op | C# load | C# bytes | target |
|---|---|---:|---:|---:|---|---|---:|---:|---:|---|
| B1 | BS to AD: `of(y, m, d).toGregorian()` | 30.9 | 9% | 13% | 8 approx. | final | 32.55 | 77% | 0 | < 30 |
| B2 | AD to BS: `fromGregorian(g)` | 26.7 | 10% | 6% | 23 approx. | final | 50.64 | 77% | 0 | < 30 |
| B3 | `addDays(1000)` | 50.5 | 64% | 89% | 0 approx. | LOADED | 50.66 | 77% | 0 | < 20 |
| B4 | `addMonths(13)` clamp | 55.9 | 74% | 78% | 56 approx. | LOADED | 49.53 | 77% | 0 | < 20 |
| B5 | `long({weekday: true, lang: "ne"})` | 174.5 | 10% | 59% | not measured | final | 414.43 | 77% | 435 | < 153 |
| B6 | `parse("YYYY/MM/DD")` | 65.9 | 5% | 0% | not measured | final | 66.20 | 77% | 0 | < 64 |
| B7 | `info(date)` | 5.6 | 10% | 0% | 0 approx. | final | 134.43 | 77% | 51 | < 10 |
| B8 | month grid: `of` and `info` for every day | 517.1 | 7% | 6% | 1705 approx. | final | 7304.45 | 77% | 1429 | none |

B1 is 0.9 ns above the 30 ns target and B6 is 1.9 ns above the 64 ns target. B5 is 21.5 ns above
153. B2 and B7 meet their targets at 26.7 and 5.6 ns. B3 and B4 are loaded and decide nothing. The
earlier pass had B1 31.9 at 12%, B5 280.2 at 66% and B6 244.9 at 91%; this pass re-measured all
three.

The C# run was loaded at a median 77%, so it is slower than the 13.29 to 47.93 ns hub column that
the earlier page used. Its 3× limits, 97.65 ns for B1, 151.92 ns for B2 and 403.29 ns for B7, are printed only to show
why a loaded column decides nothing. Under ADR-0006 every 3× check is `pending a quiet run`; the raw
ratios (0.95×, 0.53× and 0.04×) are not verdicts.

| Check | Limit | Measured | Verdict |
|---|---:|---:|---|
| B1 ADR target | < 30 ns | 30.9 | final miss |
| B2 ADR target | < 30 ns | 26.7 | final pass |
| B3 ADR target | < 20 ns | 50.5 | pending (row loaded) |
| B4 ADR target | < 20 ns | 55.9 | pending (row loaded) |
| B5 ADR target | < 153 ns | 174.5 | final miss |
| B6 ADR target | < 64 ns | 65.9 | final miss |
| B7 ADR target | < 10 ns | 5.6 | final pass |
| B1 3× C# | < 97.65 ns | 30.9 | pending (C# loaded) |
| B2 3× C# | < 151.92 ns | 26.7 | pending (C# loaded) |
| B7 3× C# | < 403.29 ns | 5.6 | pending (C# loaded) |

## Competitors

Each row is B1 or B2 for the package in [competitors.md](competitors.md), in the order of that file,
not a ranking. `n` is the number of dates measured: 64 except `nepali-datetime` B2, which throws on
AD 1943-04-14 (BS 2000-01-01) and is timed on the other 63. `LOADED` rows are observations, not
verdicts; agreement does not depend on load.

| Package | B1 ns/op | B1 load | B1 status | B1 agrees | B2 ns/op | B2 load | B2 status | B2 agrees | First in-range mismatch |
|---|---:|---:|---|---|---:|---:|---|---|---|
| `nepali-date-converter@3.4.0` | 12673.9 | 47% | LOADED | no | 23619.7 | 73% | LOADED | no | B1 BS 2086-07-23 off 1; B2 AD 2029-11-08 off 1 |
| `bikram-sambat@1.8.1` | 3828.8 | 56% | LOADED | no | 1959.6 | 34% | LOADED | no | B1 BS 2088-01-04 off 1; B2 AD 2031-04-19 off 1 |
| `bikram-sambat-js@1.0.3` | 13765.0 | 13% | final | no | 12894.5 | 13% | final | no | B1 BS 2088-01-04 off 1; B2 AD 1956-04-08 off 1 |
| `@remotemerge/nepali-date-converter@1.2.1` | 4595.6 | 78% | LOADED | no | 18889.9 | 56% | LOADED | no | B1 BS 2086-07-23 off 1; B2 AD 2029-11-08 off 1 |
| `nepali-datetime@2.0.0` | 379.7 | 14% | final | no | 249.1 | 9% | final | no | B1 BS 2086-07-23 off 1; B2 throws at AD 1943-04-14 |
| `@sbmdkl/nepali-date-converter@2.0.5` | 15991.3 | 15% | final | no | 15005.3 | 9% | final | no | B1 BS 2088-01-04 off 1; B2 AD 2031-04-19 off 1 |
| `nepali-date-library@1.1.16` | 981.3 | 14% | final | no | 1556.0 | 9% | final | no | B1 BS 2085-02-17 off 1; B2 AD 2028-05-30 off 1 |
| `@inicrea/bikram-sambat-core@0.1.3` | 740.7 | 63% | LOADED | no | 380.2 | 55% | LOADED | no | B1 BS 2088-01-04 off 1; B2 AD 2031-04-19 off 1 |
| `world-calendars@1.0.4` | 863.7 | 6% | final | no | 1065.4 | 13% | final | no | B1 BS 2033-03-07 off 9; B2 AD 1976-06-20 off 8 |

Every one of the nine disagrees with `shared/data` inside its own documented range. The disagreement
is not proof that the other package is wrong: most first mismatches are in BS 2085 to 2090, and
`shared/data/known-questions.json` lists open questions on those year lengths. The
`bikram-sambat-js` B2 mismatch at AD 1956-04-08 and the `world-calendars` offsets of 8 and 9 days
from BS 2033 are not near those years. ADR-0002 asks `nepdate-core` to be faster than every competitor
that agrees with the data; no package agrees on all 64 dates, so that clause has no row to apply to
in this pass. Every competitor row is still slower than `nepdate-core` B1 and B2.

## Agreement and ranges

"Agrees" is judged only on the BENCHMARK dates inside the package's documented range. The ranges
below are cited from the pinned package in `bench/node_modules`; a README line or a code line is
given for each. Where a package documents only its BS range, the AD range is the Gregorian
equivalent of the BS endpoints, computed through `shared/data`, and marked `derived`.

| Package | BS range | AD range | B1 in range | B2 in range | Source |
|---|---|---|---:|---:|---|
| `nepali-date-converter@3.4.0` | 2000-01-01..2090-12-30 | 1943-04-14..2034-04-13 (derived) | 64/64 | 64/64 | BS: `dist/lib/nepali-date-helper.js:189` |
| `bikram-sambat@1.8.1` | 1970-01-01..2090-12-30 | 1913-04-13..2034-04-13 (derived) | 64/64 | 64/64 | BS: `src/index.js:6-18` |
| `bikram-sambat-js@1.0.3` | 1970-01-01..2100-12-30 | 1913-01-01..2043-12-31 | 64/64 | 64/64 | `dist/index.js:6-7`, `:598-601` |
| `@remotemerge/nepali-date-converter@1.2.1` | 1975-01-01..2099-12-30 | 1918-04-13..2043-04-13 | 64/64 | 64/64 | `README.md:12,21` |
| `nepali-datetime@2.0.0` | 2000-01-01..2099-12-30 | 1943-04-14..2043-04-13 (derived) | 64/64 | 64/64 | `dist/shared/nepali-datetime.CRHMYMLW.mjs:1` |
| `@sbmdkl/nepali-date-converter@2.0.5` | 1978-01-01..2099-12-30 | 1921-01-01..2040-12-31 | 64/64 | 64/64 | BS: `README.md:53`, `dist/@sbmdkl/nepali-date-converter.es.js:136-137`; AD: `README.md:51` |
| `nepali-date-library@1.1.16` | 1976-01-01..2100-12-30 | 1919-04-13..2044-04-12 (derived) | 64/64 | 64/64 | BS: `dist/index.mjs:1` |
| `@inicrea/bikram-sambat-core@0.1.3` | 1975-01-01..2100-12-30 | 1918-04-13..2044-04-12 | 64/64 | 64/64 | `README.md:23-28` |
| `world-calendars@1.0.4` | 1970-01-01..2100-12-30 | 1913-04-13..2044-04-12 (derived) | 64/64 | 64/64 | BS: `dist/calendars/nepali.js:283,415` |

No date is out of range in either direction. Every documented range starts at or before BS
2000-01-01 (AD 1943-04-14) and ends at or after BS 2090-12-30 (AD 2034-04-13), so the 64 dates are
inside all nine ranges. The out-of-range list is empty for every package; there was no `58/64` case
to show. The count that matters is the in-range count, and it is 64/64 for both directions
everywhere.

The earlier page reported every B2 row as a mismatch at AD 1943-04-14 and called it "before the
table". That was a harness error, not package behaviour: it compared the returned BS date with the
AD expected date. The corrected comparison uses the BS expected date and the package's month
offset. The first B2 mismatches are the ones listed in the competitor table, plus the
`nepali-datetime` throw at AD 1943-04-14, its own documented start date. The old B2 statement is
withdrawn.

## Order dependence

Five pairs, each: B1 alone, every competitor agreement pass in a fresh process, B1 again. The
competitor passes are not timed; the question is whether their processes leave state behind for the
next B1 process. Pairing keeps the load close within a pair and controls slow drift.

| Pair | B1 alone ns/op | load | B1 after competitors ns/op | load | difference |
|---|---:|---:|---:|---:|---:|
| 1 | 35.0 | 29% | 40.1 | 52% | +14.6% |
| 2 | 34.5 | 20% | 54.3 | 59% | +57.3% |
| 3 | 46.7 | 43% | 66.5 | 64% | +42.5% |
| 4 | 60.2 | 85% | 76.9 | 95% | +27.8% |
| 5 | 81.5 | 90% | 56.0 | 83% | -31.3% |

Median B1 alone 46.7 ns/op, median after competitors 56.0 ns/op, median paired difference 27.8%,
loads 43% and 64%. Every pair ran above 15%, so this is an observation, not a verdict. The result is
inconclusive: the after run is slower in four pairs and faster in one, and the load moves with it.
It does not show state leaking between processes, and it does not clear the harness either. It needs
a quiet repeat.

## B1 and B6 profiles

Two quiet `--cpu-prof` runs, pinned to CPU 2 with `--no-heap` so the heap probe does not dominate the
sample. The files are under `D:\devcache\profiles`.

| Op | Run | ns/op | all-CPU load | profile |
|---|---|---:|---:|---|
| B1 | pid 29344 | 31.9 | 11.7% | `CPU.20261018.102628.29344.0.001.cpuprofile` |
| B6 | pid 31876 | 72.2 | 13.2% | `CPU.20261018.102821.31876.0.001.cpuprofile` |

B1 self time: the `run` loop in `bench/own-core.ts` 34.0%, idle 20.7%, generated code 11.6%,
`of` in `dist/date.js` 9.3%, a V8 wasm frame 5.4%, garbage collector 4.6%, `civilFromDays` 1.0%,
module loading 1.1%. `run` is the wrapper loop and the inlined `toGregorian` body; the profile does
not separate the inlined frame from the loop.

B6 self time: the `run` loop 36.3%, idle 21.9%, generated code 11.2%, `of` 6.7%, garbage collector
6.0%, module loading 4.0%, `parse` 0.7%, table `build` 0.6%. The parse body is inlined into `run`;
the visible split is the result construction in `of`, the collector and the loop itself. The
profile cannot say how much of `run` is tokenising and how much is object construction.

Decision: report both misses, do not change the hot path on this evidence. B1 is 0.9 ns over its 30
ns target and B6 is 1.9 ns over 64; B6 is already below the 90 ns prototype. A sub-nanosecond change
from these profiles would be guesswork, and the profiles show no single function with a large,
isolated share that the loop does not dominate. The owner can decide whether to chase it. No code
changed, so the exhaustive and fuzz tests remain as they were, green.

## Bundle sizes

esbuild `--bundle --minify --format=esm`, gzip level 9, unchanged from the 0.1.0 tree:

| Package | Minified | Gzip |
|---|---:|---:|
| `nepdate-core` | 15,896 B | 5,588 B |
| `nepdate-patro` alone (`--external:nepdate-core`) | 131,139 B | 26,349 B |
| `nepdate-patro` with `nepdate-core` bundled | 146,601 B | 31,933 B |
