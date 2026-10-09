# T1: Core types and BS ↔ AD conversion

Read first: ADR-0002, ADR-0003, `docs/API.md` (NepaliDate, errors), `shared/spec/ALGORITHM.md` §1–7,
`shared/spec/PARITY.md`, `shared/spec/PORT-PLAN.md` phase 1.

All source files are under `packages/nepdate/src/`, tests under `packages/nepdate/test/`.

## Tasks

### T1-01 Generated tables
Extend `scripts/codegen.ts` to emit `PACKED_MONTH_LENGTHS`: one base64 string of the 3588 month
lengths, 2 bits each (length − 29, month 1 of 1901 in the low bits of byte 0), and
`EPOCH_UNIX_DAYS = -45920` (ADR-0002 §5). `src/tables.ts` (hand-written) decodes it at module load
into `MONTH_LENGTHS` (`Uint8Array`, 3588) and builds `MONTH_START` (`Int32Array`, 3589) and
`YEAR_START` (`Int32Array`, 300) by prefix sums.
AC: decoded `MONTH_LENGTHS` equals `shared/data/calendar/bs-calendar.json` for every month;
`YEAR_START[299] === 109212`; `MONTH_START[3588] === 109212`; `--check` passes; module load builds
the tables in under 1 ms (measured in a test, reported, not asserted; the prototype took about
0.5 ms, ADR-0002).

### T1-02 Errors (`src/errors.ts`)
`NepDateError extends RangeError` with `kind`; `name` is `"NepDateError"`.
AC: the error thrown by `NepaliDate.of(2081, 4, 33)` is `instanceof NepDateError` and
`instanceof RangeError`, with `name === "NepDateError"`.

### T1-03 `NepaliDate` construction and accessors (`src/date.ts`)
Private constructor (TS `private` + a module-private token so JS callers can't bypass `of`).
`of` checks `Number.isSafeInteger` for each argument, then ALGORITHM §3 (error precedence: year,
month, day), reading the month length once as `MONTH_START[i + 1] - MONTH_START[i]`. The
constructor assigns `year`, `month`, `day` and then `#serial`, always in that order and nothing
else, so every instance shares one V8 hidden class (ADR-0002 §3). No `Object.freeze`. Accessors per
API; `weekday` = `(serial + 4) % 7` (serial is never negative).
AC: `of(2081, 4, 32)` works; `of(2081, 4, 33)` throws with `kind === "invalid-day"`;
`of(2081.5, 1, 1)` throws `"not-an-integer"`; `of(1900, 13, 40)` throws `"out-of-range"`;
`of(2081, 13, 1)` throws `"invalid-month"`.

### T1-04 Conversion (`src/gregorian.ts`)
Hinnant `daysFromCivil` / `civilFromDays` (ALGORITHM §5) with every division written as
`(a / b) | 0` on non-negative operands: shift the era so intermediate values never go below 0
(ADR-0002 §4). No `Math.floor` in this file. `toGregorian`, `fromGregorian` (accepts any
`{year, month, day}`; validates the Gregorian date first, then the range). Serial to BS is O(1)
(ADR-0002 §6): `i = (serial * 3588 / 109212) | 0`, then `i--` if `MONTH_START[i] > serial`, else
`i++` if `MONTH_START[i + 1] <= serial`; year `1901 + ((i / 12) | 0)`, month `i % 12 + 1`, day
`serial - MONTH_START[i] + 1`. `MIN`, `MAX`, `compare`, `equals`, `firstOfMonth`, `lastOfMonth`.
AC:
- `NepaliDate.MIN.toGregorian()` is `{year: 1844, month: 4, day: 11}`;
  `NepaliDate.MAX.toGregorian()` is `{year: 2143, month: 4, day: 15}`.
- `fromGregorian({year: 2023, month: 2, day: 29})` throws `"invalid-gregorian"`.
- `fromGregorian({year: 1844, month: 4, day: 10})` and `fromGregorian({year: 2143, month: 4,
  day: 16})` throw `"out-of-range"`.

### T1-05 Tests
- `test/vectors.test.ts`: `month-boundaries.csv` (7176 rows) and golden `dates.tsv` (1018 rows)
  columns `ad`, `weekday`, `day_of_year`, `month_length`. The vector files give the weekday as an
  English name (`Thursday`); the test maps it with its own array `["Sunday", ..., "Saturday"]`
  (index = `weekday`), because `weekdayName` arrives in T3.
- `test/exhaustive.test.ts`: every serial 0..=109211 round-trips (109,212 dates), and for every
  serial the O(1) month index equals the result of a plain binary search over `MONTH_START`.
- `test/csharp-catalog.test.ts`: every catalogue row tagged with this phase (roadmap, "C# test
  catalogue").
- `test/property.test.ts` (fast-check, fixed seed): for any valid Gregorian date from AD
  1844-04-11 to 2143-04-15, `fromGregorian(g).toGregorian()` deep-equals `g`, and `weekday`
  equals `new Date(Date.UTC(g.year, g.month - 1, g.day)).getUTCDay()` (the test may use `Date`).
- `test/types.test-d.ts` (Vitest `expectTypeOf`, run by `tsc`): assigning to `date.year` is a type
  error (`// @ts-expect-error`), `new NepaliDate()` is a type error, `NepaliDate.of` returns
  `NepaliDate`.

### T1-06 Own benchmark (`bench/`)
`bench/package.json` (private, `mitata` pinned exactly, `nepdate` from `file:../packages/nepdate`)
and `bench/own.ts` with B1 and B2 of `shared/spec/BENCHMARK.md` (the 64 dates of §2, results passed
to `do_not_optimize`, time divided by 64). Run it pinned:
`cmd /c "start /affinity 4 /wait /b node --expose-gc bench/own.ts"` after `npm run build`. Not in
`npm run ci`. T2 to T4 add their operations to the same file; T5-02 adds competitors.
AC: prints one line per operation with mean ns/op and heap/op; the PR description pastes the
output.

## Checkpoint

The implementation agent stops here. The reviewer checks:
- [ ] `npm run ci` passes and `test/exhaustive.test.ts` ran all 109,212 serials (count in the
      output).
- [ ] Every catalogue row tagged phase 1 has a case or a named deviation (the catalogue test is
      green and lists no missing id).
- [ ] No `Date`, `Math.floor`, `split` or regex in `src/`; no binary search in the conversion path.
- [ ] `NepaliDate` constructor assigns exactly `year`, `month`, `day`, `#serial`, in that order;
      no `Object.freeze` on instances.
- [ ] `bench/own.ts` output in the PR: B1 < 30 ns and B2 < 30 ns (ADR-0002 §10); a miss comes with
      a `--cpu-prof` profile.
- [ ] Exports match `docs/API.md` for this phase and nothing more.
