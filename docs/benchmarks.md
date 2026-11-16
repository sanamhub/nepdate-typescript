# Benchmarks

Operations B1 to B8 of [`shared/spec/BENCHMARK.md`](https://github.com/sanamhub/nepdate/blob/main/spec/BENCHMARK.md),
run on 2026-11-16. Every row runs in a fresh process pinned to logical CPU 2. Before each
measurement the child samples the all-CPU load; if it is at or above 15% it waits 5 s and retries,
five times. During the row it samples the mean busy share of every CPU except CPU 2, because the
benchmark keeps CPU 2 busy by design. A row is marked `LOADED` when either figure is at or above
15%, and a loaded row is kept out of target verdicts. [ADR-0008](adr/0008-during-row-background-load.md)
records the during-row rule.

Every row of this pass is final, in the main run and in the competitor run; each row's load is in
[`raw/2026-11-16/own.txt`](raw/2026-11-16/own.txt) and
[`raw/2026-11-16/compare.txt`](raw/2026-11-16/compare.txt).

## Machine

| Item | Value |
|---|---|
| CPU | 12th Gen Intel Core i5-12500H, 12 cores, 16 logical processors, 3.10 GHz |
| RAM | 31.7 GB |
| OS | Microsoft Windows 11 Home, 10.0.26300, 64-bit |
| Power plan | Ultimate Performance |
| Node | 26.13.1 |
| mitata | 1.0.34 |
| C# NepDate | 2.0.7 on .NET 10.0.15, from the hub's 2026-11-16 run |
| Pinned to | logical CPU 2 (`/affinity 4`) |
| Date | 2026-11-16 |
| Idle gate before the main run | 5.0 percent average, 8.9 peak (30 one-second samples) |
| Load during the main run | 5.1 percent average, 14.9 peak over 62 one-second samples |
| Idle gate before the competitor run | 4.4 percent average, 7.5 peak |
| Load during the competitor run | 4.9 percent average, 12.5 peak over 92 one-second samples |

The machine was idle: no other build, test suite or benchmark ran during either run. The samples are
in [`raw/2026-11-16/`](raw/2026-11-16/) (`cpu-samples-own.txt`, `cpu-samples-compare.txt`,
`load.txt`).

## Commands

From the repository root after `npm run build`:

```
node bench/own.ts --out docs/raw/2026-11-16
node bench/compare.ts --out docs/raw/2026-11-16
```

`bench/own.ts` and `bench/compare.ts` spawn one `node --expose-gc bench/measure.ts` per row under
`cmd /c start "" /affinity 4 /wait /b`. The raw files are under
[`raw/2026-11-16/`](raw/2026-11-16/): `own.json`, `compare.json`, the printed tables
(`own.txt`, `compare.txt`) and the console log `bench.log`.

## Results

Time per single operation, ns/op. The heap column is mitata's heap delta per operation, an
approximation, not an allocator count. The C# column is the .NET 10 column of the hub's
[`docs/benchmarks/dotnet.md`](https://github.com/sanamhub/nepdate/blob/main/docs/benchmarks/dotnet.md).

| ID | Operation | nepdate ns/op | heap/op | C# .NET 10 ns/op | C# bytes/op |
|---|---|---:|---:|---:|---:|
| B1 | BS to AD | 24.3 | 8 B approx. | 13.27 | 0 |
| B2 | AD to BS | 22.8 | 23 B approx. | 18.70 | 0 |
| B3 | add 1000 days | 12.0 | 23 B approx. | 20.06 | 0 |
| B4 | add 13 months, Clamp | 11.4 | 24 B approx. | 19.30 | 0 |
| B5 | long format, Nepali, weekday | 136.9 | 19 B approx. | 139.04 | 435 |
| B6 | strict parse `YYYY/MM/DD` | 63.3 | 313 B approx. | 21.13 | 0 |
| B7 | patro info | 4.8 | 0 B approx. | 48.63 | 51 |
| B8 | patro month grid | 351.4 | 2 B approx. | 3,274.50 | 1,429 |

## Competitors (B1 and B2)

| Package | Version | B1 ns/op | B1 agrees | B2 ns/op | B2 agrees |
|---|---|---:|---|---:|---|
| `world-calendars` | 1.0.4 | 712.2 | no | 757.3 | no |
| `nepali-date-converter` | 3.4.0 | 1,961.4 | no | 2,108.3 | no |
| `bikram-sambat` | 1.8.1 | 1,917.0 | no | 1,372.8 | no |

Every selected package is slower than NepDate on both conversions. None agrees on all 64 dates.
The first mismatches are:

- `world-calendars` at BS 2033-03-07: it returns 1976-06-29, the hub data has 1976-06-20.
- `nepali-date-converter` at BS 2086-07-23: it returns 2029-11-09, the hub data has 2029-11-08.
- `bikram-sambat` at BS 2088-01-04: it returns 2031-04-18, the hub data has 2031-04-19.

The full lists are in [`raw/2026-11-16/compare.txt`](raw/2026-11-16/compare.txt).

## Targets

BENCHMARK section 6 asks for B1, B2 and B7 within 3 times C# NepDate. B1 is 1.83 times, B2 is 1.22
times and B7 is 0.10 times. Passes. The heap figures are approximate and are not used as allocation
targets.
