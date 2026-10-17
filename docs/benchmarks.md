# Benchmarks

Operations B1 to B8 of [`shared/spec/BENCHMARK.md`](https://github.com/sanamhub/nepdate/blob/main/spec/BENCHMARK.md),
run on 2026-10-18. The load column is the busy share of all 16 logical CPUs, sampled for 250 ms
immediately before that number. The machine was not idle: Java, browsers and the agent harness were
running, and the sampled load ranged from 38% to 95%. Each row is the median of five runs for
`nepdate` and three runs for each competitor, with the median load of those runs. The load is not
corrected for, so these numbers are higher and noisier than the quiet-machine runs in the phase
checkpoints.

## Machine

| Item | Value |
|---|---|
| CPU | 12th Gen Intel Core i5-12500H, 12 cores, 16 logical processors, 3.10 GHz |
| RAM | 31.7 GB |
| OS | Microsoft Windows 11 Home, 10.0.26300, 64-bit |
| Node | 24.20.0 |
| npm | 12.2.0 |
| mitata | 1.0.34 |
| Pinned to | logical CPU 2 (`/affinity 4`) |
| Date | 2026-10-18 |
| Load during runs | 38% to 95% busy (median per row below) |

Exact commands, from the repository root after `npm run build`:

```
cmd /c "start /affinity 4 /wait /b node --expose-gc bench/own.ts"
cmd /c "start /affinity 4 /wait /b node --expose-gc bench/compare.ts"
```

`bench/compare.ts` runs B1 and B2 for the packages of [competitors.md](competitors.md) on the 64
dates of BENCHMARK §2. A direction that throws on any of the 64 dates is reported `n/a` rather than
measured on a subset. Bytes per operation are mitata's heap delta under `--expose-gc`, marked
"approx."; B5 and B6 are "not measured" because V8 rope strings make the figure unreliable
(BENCHMARK §4). The C# column is the .NET 10 column of the hub's `docs/benchmarks/dotnet.md`,
measured on the hub machine, so its load column is `n/a`.

## Operations

| Op | Implementation | ns/op | Load | Bytes/op | Agrees | Notes |
|---|---|---:|---:|---:|---|---|
| B1 | `nepdate` | 56.3 | 71% | 8 approx. | yes | `of(y, m, d).toGregorian()`, median of 5, target < 30, 3x C# < 39.9: miss |
| B1 | `nepali-date-converter@3.4.0` | 9072.9 | 66% | n/a | no | first difference 2086-07-23, off by 1 |
| B1 | `bikram-sambat@1.8.1` | 4693.7 | 77% | n/a | no | first difference 2088-01-04, off by 1 |
| B1 | `bikram-sambat-js@1.0.3` | 26159.3 | 55% | n/a | no | first difference 2088-01-04, off by 2 |
| B1 | `@remotemerge/nepali-date-converter@1.2.1` | 6360.7 | 62% | n/a | no | first difference 2086-07-23, off by 1 |
| B1 | `nepali-datetime@2.0.0` | 930.8 | 59% | n/a | no | first difference 2086-07-23, off by 1 |
| B1 | `@sbmdkl/nepali-date-converter@2.0.5` | 60689.4 | 58% | n/a | no | first difference 2088-01-04, off by 1 |
| B1 | `nepali-date-library@1.1.16` | 2314.2 | 69% | n/a | no | first difference 2085-02-17, off by 1 |
| B1 | `@inicrea/bikram-sambat-core@0.1.3` | 792.2 | 57% | n/a | no | first difference 2088-01-04, off by 1 |
| B1 | `world-calendars@1.0.4` | 2453.4 | 57% | n/a | no | first difference 2033-03-07, off by 9 |
| B1 | C# NepDate 2.0.7, .NET 10 | 13.29 | n/a | 0 | n/a | hub machine, not this machine |
| B2 | `nepdate` | 39.7 | 79% | 56 approx. | yes | `fromGregorian(g)`, median of 5, target < 30, 3x C# < 55.9: target miss, 3x met |
| B2 | `nepali-date-converter@3.4.0` | 12411.5 | 75% | n/a | no | AD 1943-04-14 is before its table, returns 2000-00-01 |
| B2 | `bikram-sambat@1.8.1` | 3428.1 | 67% | n/a | no | AD 1943-04-14 is before its table, returns the default |
| B2 | `bikram-sambat-js@1.0.3` | 21554.7 | 63% | n/a | no | AD 1943-04-14 is before its table, returns the default |
| B2 | `@remotemerge/nepali-date-converter@1.2.1` | 15302.1 | 64% | n/a | no | AD 1943-04-14 is before its table, returns the default |
| B2 | `nepali-datetime@2.0.0` | n/a | 45% | n/a | no | throws `DateOutOfRangeError` on AD 1943-04-14 |
| B2 | `@sbmdkl/nepali-date-converter@2.0.5` | 30884.0 | 65% | n/a | no | AD 1943-04-14 is before its table, returns the default |
| B2 | `nepali-date-library@1.1.16` | 3771.2 | 75% | n/a | no | AD 1943-04-14 is before its table, returns the default |
| B2 | `@inicrea/bikram-sambat-core@0.1.3` | 1466.5 | 79% | n/a | no | AD 1943-04-14 is before its table, returns the default |
| B2 | `world-calendars@1.0.4` | 1599.2 | 68% | n/a | no | AD 1943-04-14 is before its table, returns the default |
| B2 | C# NepDate 2.0.7, .NET 10 | 18.64 | n/a | 0 | n/a | hub machine, not this machine |
| B3 | `nepdate` | 23.7 | 64% | 56 approx. | n/a | `addDays(1000)`, target < 20: miss |
| B4 | `nepdate` | 30.0 | 67% | 56 approx. | n/a | `addMonths(13)` clamp, target < 20: miss |
| B5 | `nepdate` | 498.1 | 79% | not measured | n/a | `long({weekday: true, lang: "ne"})`, target < 153: miss |
| B6 | `nepdate` | 117.6 | 68% | not measured | n/a | `parse("YYYY/MM/DD")`, target < 64: miss |
| B7 | `nepdate` | 12.8 | 64% | 0 | n/a | `info(date)`, target < 10: miss; 3x C# < 143.8: met |
| B8 | `nepdate` | 842.0 | 66% | 1707 approx. per grid | n/a | month grid (`of` then `info` for every day), no target |

All nine competitors disagree on B1 somewhere: eight differ by one or two days only in the BS
2085 to 2088 projection years, which [competitors.md](competitors.md) predicts, and
`world-calendars` differs from BS 2033. All of them or their defaults disagree on B2 at the first
date, AD 1943-04-14, because their AD tables start at 1970; `nepali-datetime` throws there. A
package that disagrees is listed with its numbers and is not ranked above one that agrees; no
package agrees on all 64 dates in both directions, so the order above is the order of
[competitors.md](competitors.md), not a ranking. The B2 numbers for packages that return a default
are the cost of that wrong answer, not a correct conversion.

The B1, B2, B3, B4, B5, B6 and B7 misses against the ADR-0002 §10 targets are reported here rather
than fixed. They coincide with 38% to 95% load from other processes; the quiet-machine phase
checkpoints had B1 about 27 ns, B2 about 24 ns, B5 about 155 ns and B7 about 6.8 ns. The 3x C#
limit of BENCHMARK §6 is met for B2 and B7 and missed for B1.

## Bundle sizes

esbuild `--bundle --minify --format=esm`, gzip level 9, at this commit:

| Package | Minified | Gzip |
|---|---:|---:|
| `nepdate` | 15,896 B | 5,588 B |
| `nepdate-patro` alone (`--external:nepdate`) | 131,139 B | 26,349 B |
| `nepdate-patro` with `nepdate` bundled | 146,601 B | 31,933 B |
