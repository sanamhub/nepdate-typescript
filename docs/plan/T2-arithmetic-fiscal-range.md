# T2: Arithmetic, diff, fiscal year, range

Read first: `shared/spec/ALGORITHM.md` §8–8b, `docs/API.md` (arithmetic, fiscal, range),
`shared/spec/PARITY.md` D-02, D-03, D-07, D-08, D-09, `shared/spec/PORT-PLAN.md` phase 2.

All files are in `packages/nepdate/`. In every golden file used here, `ERR` means the call throws
`NepDateError` with `kind === "out-of-range"` (the inputs are valid dates, so range is the only
possible failure).

## Tasks

### T2-01 Days
`addDays` (integer check, range check before converting), `daysUntil`.
AC: golden `add-days.tsv` (9162 rows, columns `bs`, `days`, `result`);
`NepaliDate.MAX.addDays(1)` and `NepaliDate.MIN.addDays(-1)` throw `"out-of-range"`;
`addDays(1.5)` throws `"not-an-integer"`.

### T2-02 Months and years
`addMonths`, `addYears` with `"clamp"` (default) and `"spill"` (ALGORITHM §8, where `spill` is
the spec's `Overflow`). Compute the target month index `t = (year - 1901) * 12 + month - 1 + n`,
range-check it first (`0 <= t < 3588`, else `"out-of-range"`), then split with `(t / 12) | 0` and
`t % 12`, which are exact because `t` is non-negative. Read the target month's start and length
from `MONTH_START`; no throwaway date, no search (ADR-0002 §3). Tests for negative `n`.
AC: golden `add-months.tsv` (10180 rows): column `clamp` is `addMonths(months, "clamp")`, column
`overflow` is `addMonths(months, "spill")`; the four §8 examples (2081-04-32 +2 and +5 months, both
modes).

### T2-03 `diff` (ALGORITHM §8a)
§8a has no worked examples, so these are computed from its pseudocode (report any disagreement as
a hub issue):

| `a` | `b` | `negative` | `years` | `months` | `days` | `totalDays` |
|---|---|---|---|---|---|---|
| 2081-04-32 | 2081-06-30 | false | 0 | 2 | 0 | 61 |
| 2081-04-32 | 2082-04-01 | false | 0 | 11 | 1 | 335 |
| 2080-01-01 | 2081-04-15 | false | 1 | 3 | 14 | 473 |
| 2081-04-15 | 2080-01-01 | true | 1 | 3 | 14 | -473 |
| 2081-01-01 | 2081-01-01 | false | 0 | 0 | 0 | 0 |

AC: `a.diff(b)` for every row of the table; for 1000 pairs from a seeded generator, `a.diff(b).totalDays ===
a.daysUntil(b)` and `negative === (a.daysUntil(b) < 0)`.

### T2-04 `FiscalYear` (ALGORITHM §8b)
`fiscalYear()` is `FiscalYear.containing(this)`; `quarter()` per §8b.
AC: golden `dates.tsv` columns `fy_start`, `fy_end`, `quarter_start`, `quarter_end` (1018 rows,
`ERR` as above); `new FiscalYear(2082).label() === "2082/83"`;
`new FiscalYear(2082).label("ne") === "२०८२/८३"`.

### T2-05 `DateRange`
Per API; the iterator walks serials (no re-validation per step) and is a generator function.
`DateRange.month(y, m)` and `DateRange.year(y)` validate `y` and `m` like `NepaliDate.of`.
AC: for every year 1901..2199, `DateRange.year(y).length` equals the sum of its month lengths;
`[...DateRange.month(2081, 4)].length === 32`; `DateRange.month(2081, 13)` throws
`"invalid-month"`.

### T2-06 Catalogue, property tests, benchmark
- `test/csharp-catalog.test.ts`: add every catalogue row tagged phase 2 (roadmap, "C# test
  catalogue").
- `test/property.test.ts` (fast-check, fixed seed): `d.addDays(n).addDays(-n)` equals `d` when both
  stay in range; `d.daysUntil(d.addDays(n)) === n`; `addMonths(n, "clamp").day <= d.day`.
- `bench/own.ts`: add B3 (`addDays(1000)`) and B4 (`addMonths(13)`, clamp).
AC: the catalogue test lists no missing id for phase 2; the PR pastes the `bench/own.ts` output.

## Checkpoint

The implementation agent stops here. The reviewer checks:
- [ ] `npm run ci` passes; `add-days.tsv` (9162) and `add-months.tsv` (10180, both columns) ran
      in full.
- [ ] Every catalogue row tagged phase 2 has a case or a named deviation.
- [ ] `addMonths` and `addYears` build no intermediate `NepaliDate` and use no `Math.floor`.
- [ ] The `DateRange` iterator walks serials without validating each step.
- [ ] `bench/own.ts` in the PR: B3 and B4 < 20 ns (ADR-0002 §10); B1 and B2 did not get slower
      than in T1 by more than 10 %.
