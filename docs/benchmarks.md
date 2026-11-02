# Benchmarks

Operations B1 to B8 of [`shared/spec/BENCHMARK.md`](https://github.com/sanamhub/nepdate/blob/main/spec/BENCHMARK.md),
run on 2026-11-02. Every row runs in a fresh process pinned to logical CPU 2. Before each
measurement the child samples the all-CPU load; if it is at or above 15% it waits 5 s and retries,
five times. During the row it samples the mean busy share of every CPU except CPU 2, because the
benchmark keeps CPU 2 busy by design. A row is marked `LOADED` when either figure is at or above
15%, and a loaded row is kept out of target verdicts. [ADR-0008](adr/0008-during-row-background-load.md)
records the during-row rule.

This pass has B1, B2, B5, B6, B7 and B8 final in the main run. B3 and B4 were loaded in that run, so
they were measured again immediately afterwards with the same harness and both are final. The
competitor rows were final or close to the gate; their per-row load is in
[`raw/2026-11-02/compare.txt`](raw/2026-11-02/compare.txt).

## Machine

| Item | Value |
|---|---|
| CPU | 12th Gen Intel Core i5-12500H, 12 cores, 16 logical processors, 3.10 GHz |
| RAM | 31.7 GB |
| OS | Microsoft Windows 11 Home, 10.0.26300, 64-bit |
| Power plan | Ultimate Performance |
| Node | 26.13.0 |
| mitata | 1.0.34 |
| C# NepDate | 2.0.7 on .NET 10.0.14, from the hub's 2026-11-02 run |
| Pinned to | logical CPU 2 (`/affinity 4`) |
| Date | 2026-11-02 |
| Load before the main run | 13, 5 and 7 percent, sampled 2 s apart |
| Load after the main run | 17, 7 and 3 percent, sampled 2 s apart |
| Load before the B3/B4 rerun | 13, 11 and 9 percent; after 9, 14 and 3 percent |

The machine had the owner's normal desktop applications open. No other build, test suite or
benchmark ran during the run.

## Commands

From the repository root after `npm run build`:

```
node bench/own.ts --out docs/raw/2026-11-02
node bench/compare.ts --out docs/raw/2026-11-02
```

B3 and B4 were repeated with:

```
node --expose-gc bench/measure.ts --impl nepdate --op B3 > docs/raw/2026-11-02/b3.json
node --expose-gc bench/measure.ts --impl nepdate --op B4 > docs/raw/2026-11-02/b4.json
```

`bench/own.ts` and `bench/compare.ts` spawn one `node --expose-gc bench/measure.ts` per row under
`cmd /c start "" /affinity 4 /wait /b`. The raw files are under
[`raw/2026-11-02/`](raw/2026-11-02/): `own.json`, `compare.json`, `b3.json`, `b4.json` and the
console logs.

## Results

Time per single operation, ns/op. The heap column is mitata's heap delta per operation, an
approximation, not an allocator count. The C# column is the .NET 10 column of the hub's
[`docs/benchmarks/dotnet.md`](https://github.com/sanamhub/nepdate/blob/main/docs/benchmarks/dotnet.md).

| ID | Operation | nepdate ns/op | heap/op | C# .NET 10 ns/op | C# bytes/op |
|---|---|---:|---:|---:|---:|
| B1 | BS to AD | 26.3 | 8 B approx. | 13.50 | 0 |
| B2 | AD to BS | 24.2 | 23 B approx. | 20.10 | 0 |
| B3 | add 1000 days | 12.98 | 23 B approx. | 19.05 | 0 |
| B4 | add 13 months, Clamp | 12.04 | 24 B approx. | 20.19 | 0 |
| B5 | long format, Nepali, weekday | 262.3 | 6 B approx. | 150.41 | 435 |
| B6 | strict parse `YYYY/MM/DD` | 76.5 | 313 B approx. | 22.42 | 0 |
| B7 | patro info | 5.1 | 0 B approx. | 48.21 | 51 |
| B8 | patro month grid | 383.1 | 2 B approx. | 3,112.76 | 1,429 |

## Competitors (B1 and B2)

| Package | Version | B1 ns/op | B1 agrees | B2 ns/op | B2 agrees |
|---|---|---:|---|---:|---|
| `world-calendars` | 1.0.4 | 778.8 | no | 832.9 | no |
| `nepali-date-converter` | 3.4.0 | 2,111.4 | no | 2,250.6 | no |
| `bikram-sambat` | 1.8.1 | 2,751.2 | no | 1,482.6 | no |

Every selected package is slower than NepDate on both conversions. None agrees on all 64 dates.
The first mismatches are:

- `world-calendars` at BS 2033-03-07: it returns 1976-06-29, the hub data has 1976-06-20.
- `nepali-date-converter` at BS 2086-07-23: it returns 2029-11-09, the hub data has 2029-11-08.
- `bikram-sambat` at BS 2088-01-04: it returns 2031-04-18, the hub data has 2031-04-19.

The full lists are in [`raw/2026-11-02/compare.txt`](raw/2026-11-02/compare.txt).

## Targets

BENCHMARK section 6 asks for B1, B2 and B7 within 3 times C# NepDate. B1 is 1.95 times, B2 is 1.20
times and B7 is 0.11 times. Passes. The heap figures are approximate and are not used as allocation
targets.
