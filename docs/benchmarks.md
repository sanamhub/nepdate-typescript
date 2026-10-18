# Benchmarks

Operations B1 to B8 of [`shared/spec/BENCHMARK.md`](https://github.com/sanamhub/nepdate/blob/main/spec/BENCHMARK.md),
run on 2026-10-18. Every row runs in a fresh process pinned to logical CPU 2. Before each
TypeScript measurement the child samples the load; if all CPUs are busier than 15% it waits 5 s and
retries, five times. A row that is still above 15% is marked `LOADED` and kept out of the target
verdicts. The C# column was measured on this machine in the same session, not copied from the hub.

No target verdict is final except B1's `target < 30 ns` check: every other TypeScript row was
`LOADED`, and the C# run itself ran at a median 66% load. The numbers below are what the machine
produced; the verdict column says what can be concluded from them. Nothing was relaxed to get a
pass.

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
| Load, `nepdate` rows | 12% to 91% busy (per row below) |
| Load, C# run | 63% to 74% busy, median 66% |

Exact commands, from the repository root after `npm run build`:

```
node bench/own.ts
node bench/dotnet.ts
node bench/compare.ts
node bench/order.ts
```

`bench/own.ts` and `bench/compare.ts` spawn one `node --expose-gc bench/measure.ts` per row under
`cmd /c start "" /affinity 4 /wait /b`. `bench/dotnet.ts` runs the hub's `tools/dotnet-bench` with
NuGet and build caches on `D:\devcache\dotnet`; the command it used is:

```
dotnet run -c Release -f net10.0 -p:BaseOutputPath=D:\devcache\dotnet\bin\ -p:BaseIntermediateOutputPath=D:\devcache\dotnet\obj\ --project E:\github\sanamhub\nepdate\tools\dotnet-bench -- --filter * --artifacts D:\devcache\dotnet\artifacts\2026-10-18T02-47-39
```

The BenchmarkDotNet report is at
`D:\devcache\dotnet\artifacts\2026-10-18T02-47-39\results\DotnetBench.Benchmarks-report.csv`. The
job runs the .NET 8 column too; only the .NET 10 rows are used here.

## `nepdate` and C#

Time is nanoseconds per single operation. B8 is one whole month grid. Bytes are mitata's heap delta
under `--expose-gc`, marked approximate; B5 and B6 are "not measured" because V8 rope strings make
the figure unreliable (BENCHMARK §4). The C# time and bytes are BenchmarkDotNet's mean and allocated
bytes per operation. `LOADED` means the row ran above 15% all-CPU load and is excluded from target
verdicts.

| Op | Operation | `nepdate` ns/op | load | core 2 | bytes/op | status | C# .NET 10 ns/op | C# load | C# bytes | target |
|---|---|---:|---:|---:|---|---|---:|---:|---:|---|
| B1 | BS to AD: `of(y, m, d).toGregorian()` | 31.9 | 12% | 12% | 8 approx. | final | 20.00 | 66% | 0 | < 30 |
| B2 | AD to BS: `fromGregorian(g)` | 37.4 | 46% | 56% | 0 approx. | LOADED | 24.25 | 66% | 0 | < 30 |
| B3 | `addDays(1000)` | 21.2 | 46% | 53% | 0 approx. | LOADED | 23.76 | 66% | 0 | < 20 |
| B4 | `addMonths(13)` clamp | 28.7 | 52% | 44% | 56 approx. | LOADED | 24.41 | 66% | 0 | < 20 |
| B5 | `long({weekday: true, lang: "ne"})` | 280.2 | 66% | 47% | not measured | LOADED | 221.00 | 66% | 435 | < 153 |
| B6 | `parse("YYYY/MM/DD")` | 244.9 | 91% | 94% | not measured | LOADED | 31.39 | 66% | 0 | < 64 |
| B7 | `info(date)` | 19.5 | 64% | 69% | 0 approx. | LOADED | 63.77 | 66% | 51 | < 10 |
| B8 | month grid: `of` and `info` for every day | 1890.1 | 87% | 100% | 1708 approx. | LOADED | 3745.69 | 66% | 1429 | none |

Only B1 is `final`: it ran at 12% load. It misses the 30 ns target (31.9 ns) and would meet a 3× C#
limit of 60.00 ns. The C# row is `LOADED`, however, so the B1 3× verdict is pending a quiet run.

The other TypeScript rows are loaded and say nothing final about a target. The raw numbers still
show the shape: B2 and B7 are above their 30 ns and 10 ns targets on this run, B3 is just above 20,
B5 and B6 are well above their limits, and B4 is below 20 ns only because it ran at 52% load and
cannot be judged. The earlier quiet phase checkpoints had B1 about 27 ns, B2 about 24 ns and B7 about
6.8 ns; those are not verdicts for this session.

Negative control: six busy Node processes were started on the logical CPUs, then B1 was run. It
retried six times, recorded 92.7% load and 149.6 ns/op, and was marked `LOADED`. The gate kept that
row out of the verdicts, as it is meant to.

| Check | Limit | Measured | Verdict |
|---|---:|---:|---|
| B1 ADR target | < 30 ns | 31.9 | final miss |
| B1 3× C# | < 60.00 ns | 31.9 | pending (C# row loaded) |
| B2 ADR target | < 30 ns | 37.4 | pending (row loaded) |
| B2 3× C# | < 72.75 ns | 37.4 | pending (row loaded) |
| B3 ADR target | < 20 ns | 21.2 | pending (row loaded) |
| B4 ADR target | < 20 ns | 28.7 | pending (row loaded) |
| B5 ADR target | < 153 ns | 280.2 | pending (row loaded) |
| B6 ADR target | < 64 ns | 244.9 | pending (row loaded) |
| B7 ADR target | < 10 ns | 19.5 | pending (row loaded) |
| B7 3× C# | < 191.31 ns | 19.5 | pending (row loaded) |

The 3× limits from this machine's C# column are 60.00 ns for B1, 72.75 ns for B2 and 191.31 ns for
B7. The hub-machine limits that ADR-0002 §10 prints (39.9, 55.9 and 143.8 ns) came from the old hub
column and are not used here. ADR-0002 now records the same-machine limits; its decisions and
targets are unchanged.

## Competitors

Each row is B1 or B2 for the package in [competitors.md](competitors.md), in the order of that file,
not a ranking. `n` is the number of dates measured: 64 except `nepali-datetime` B2, which throws on
BS 2000-01-01 and is timed on the other 63. A package that disagrees is listed with its number and
never ranked above one that agrees. The load is the all-CPU figure sampled before the measurement;
`core 2` is in the row detail printed by `bench/compare.ts`.

| Package | B1 ns/op | B1 load | B1 agrees | B2 ns/op | B2 load | B2 agrees | First in-range mismatch |
|---|---:|---:|---|---:|---:|---|---|
| `nepali-date-converter@3.4.0` | 20532.9 | 78% | no | 10972.1 | 23% | no | B1 BS 2086-07-23 off by 1; B2 AD 2029-11-08 off by 1 |
| `bikram-sambat@1.8.1` | 2898.0 | 47% | no | 2397.6 | 62% | no | B1 BS 2088-01-04 off by 1; B2 AD 2031-04-19 off by 1 |
| `bikram-sambat-js@1.0.3` | 14998.7 | 21% | no | 15484.5 | 41% | no | B1 BS 2088-01-04 off by 1; B2 AD 1956-04-08 off by 1 |
| `@remotemerge/nepali-date-converter@1.2.1` | 3381.9 | 32% | no | 13195.2 | 49% | no | B1 BS 2086-07-23 off by 1; B2 AD 2029-11-08 off by 1 |
| `nepali-datetime@2.0.0` | 396.0 | 27% | no | 316.5 | 44% | no | B1 BS 2086-07-23 off by 1; B2 throws at AD 1943-04-14 |
| `@sbmdkl/nepali-date-converter@2.0.5` | 21425.7 | 38% | no | 20349.2 | 55% | no | B1 BS 2088-01-04 off by 1; B2 AD 2031-04-19 off by 1 |
| `nepali-date-library@1.1.16` | 1149.2 | 26% | no | 2013.8 | 51% | no | B1 BS 2085-02-17 off by 1; B2 AD 2028-05-30 off by 1 |
| `@inicrea/bikram-sambat-core@0.1.3` | 610.8 | 26% | no | 442.0 | 33% | no | B1 BS 2088-01-04 off by 1; B2 AD 2031-04-19 off by 1 |
| `world-calendars@1.0.4` | 974.2 | 11% | no | 1042.9 | 12% | no | B1 BS 2033-03-07 off by 9; B2 AD 1976-06-20 off by 8 |

The two `world-calendars` timings are the only competitor rows measured below 15% load, so those two
numbers are final for what they measure. The agreement verdicts do not depend on load: every one of
the nine disagrees somewhere inside its own documented range.

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
inside all nine ranges. The out-of-range list is empty for every package; there was no
`58/64` case to show. The count that matters is the in-range count, and it is 64/64 for both
directions everywhere.

The earlier page reported every B2 row as a mismatch at AD 1943-04-14 and called it "before the
table". That was a harness error, not package behaviour: it compared the returned BS date with the
AD expected date. The corrected comparison uses the BS expected date and the package's month
offset, and the first B2 mismatches are now in the projection years, plus the
`nepali-datetime` throw at its own start date. The old B2 statement is withdrawn.

## Order dependence

Five pairs, each: B1 alone, every competitor agreement pass in a fresh process, B1 again. The
competitor passes are not timed; the question is whether their processes leave state behind for the
next B1 process. Pairing keeps the load close within a pair and controls the slow drift that made a
single ten-minute batch inconclusive.

| Pair | B1 alone ns/op | load | B1 after competitors ns/op | load | difference |
|---|---:|---:|---:|---:|---:|
| 1 | 32.3 | 16% | 47.7 | 73% | +47.3% |
| 2 | 38.1 | 59% | 33.9 | 22% | -11.1% |
| 3 | 40.4 | 47% | 34.0 | 23% | -15.8% |
| 4 | 35.6 | 36% | 34.9 | 26% | -1.9% |
| 5 | 34.6 | 40% | 40.3 | 60% | +16.6% |

Median B1 alone 35.6 ns/op, median after competitors 34.9 ns/op, median paired difference -1.9%,
limit 10%. No order effect was detected. Pair 1 is the noisiest pair and the only one where the after
run was much slower; its load also rose from 16% to 73%, so it is not evidence of state leaking
between processes.

## Bundle sizes

esbuild `--bundle --minify --format=esm`, gzip level 9, unchanged from the 0.1.0 tree:

| Package | Minified | Gzip |
|---|---:|---:|
| `nepdate` | 15,896 B | 5,588 B |
| `nepdate-patro` alone (`--external:nepdate`) | 131,139 B | 26,349 B |
| `nepdate-patro` with `nepdate` bundled | 146,601 B | 31,933 B |
