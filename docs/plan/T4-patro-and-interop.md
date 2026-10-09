# T4: Patro package and interop

Read first: hub [ADR-0004](https://github.com/sanamhub/nepdate/blob/main/docs/adr/0004-patro-in-a-separate-package.md) (patro in a separate package; not in `shared/`), `shared/spec/PATRO.md`, `docs/API.md`
(`nepdate-patro`, `today`, `fromJSDate`), ADR-0001 §1–2, ADR-0002 §7, ADR-0003, ADR-0004 gate 6,
`shared/spec/PORT-PLAN.md` phase 4.

T4-01 and T4-02 work only in `packages/nepdate-patro/` and `scripts/codegen.ts`. T4-03 and T4-04
work only in `packages/nepdate/`. Nothing in `packages/nepdate/` may import or mention event data.

## Tasks

### T4-01 Patro tables (`packages/nepdate-patro/src/tables.gen.ts`)
Extend `scripts/codegen.ts` per ADR-0002 §7, reading every `shared/data/patro/<year>.json`:
`COVERAGE_FIRST` and `COVERAGE_LAST` (serials), `TITHI_FIRST` (the serial of the first tithi
day), a `Uint8Array` tithi index per day from `TITHI_FIRST` (fail on a gap), sorted `Int32Array`s
of holiday and event-day serials, a `Uint8Array` event count per event day, a `Uint16Array` of name
ids, and the deduplicated (np, en) name pool as two string arrays. Typed arrays are emitted as
base64 string literals decoded at load (ADR-0002 §7: 21.6 KB gzip against 29.6 KB for array
literals). Serials follow ALGORITHM §4; the generator
computes them from `shared/data/calendar/bs-calendar.json`, not by importing the core.
AC: T = 2190 tithi days, H = 294 holidays, E = 1671 event days with 3032 events, 753 distinct
(np, en) pairs (PATRO §3); `--check` passes.

### T4-02 `nepdate-patro` queries
`info`, `coverage`, `publicHolidays` (`packages/nepdate-patro/src/index.ts`), importing
`NepaliDate` and `DateRange` from `"nepdate"`. Serial of a date: `NepaliDate.MIN.daysUntil(date)`;
date of a serial: `NepaliDate.MIN.addDays(serial)` (ADR-0002 §7). At module load, build once: one
frozen `Named` per pool entry, one frozen events array per event day, and an array `INFO` with one
frozen `CalendarInfo` per day from `COVERAGE_FIRST` to `COVERAGE_LAST`; days with no data point to
one shared frozen empty info. `info(date)` is then: serial, range check, `INFO[serial -
COVERAGE_FIRST]`, and the shared empty info outside coverage. No binary search and no allocation
per call.
AC:
- Every PATRO §4 anchor, including the order of events.
- `coverage()` is 2077-01-01..2084-08-20 (`start` and `end`).
- `[...publicHolidays()]` has 294 dates in ascending order, the first 2077-01-01 and the last
  2084-08-18.
- `info(d)` is the same frozen object on two calls for the same day (`toBe`), and
  `Object.isFrozen(info(d).events)` is true.
- Building the tables at import takes under 3 ms (measured in a test, reported, not asserted; the
  prototype took 1.5 to 2 ms).
- CI gate 6 (ADR-0004) passes: the core manifest has no dependency on `nepdate-patro`, no core
  `dist/*.js` contains `nepdate-patro`, and the packed core tarball doesn't contain `World Day Against Human Trafficking`.
- Gates 3 to 6 (core) run and pass before anything in `nepdate-patro` is built; gates 7 to 9
  pass for `nepdate-patro` (both packages build and test on their own).

### T4-03 `Date` edges and `today`
`fromJSDate(d, "utc")` uses `getUTC*`, `"local"` uses `get*`; `toJSDate(zone)` uses `Date.UTC` or
`new Date(y, m - 1, d)`. `today(timeZone = "Asia/Kathmandu")` formats `Date.now()` with
`Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })` and
reads the parts with `formatToParts`.
AC (the clock is set with `vi.setSystemTime(Date.UTC(2024, 6, 30, 18, 30))`):
- `fromJSDate(new Date(Date.UTC(2024, 6, 30, 18, 30)), "utc")` is 2081-04-15.
- `today()` is 2081-04-16 (Nepal, UTC+05:45) and `today("UTC")` is 2081-04-15.
- `NepaliDate.of(2081, 4, 15).toJSDate("utc").getTime() === Date.UTC(2024, 6, 30)`.
- Under each CI `TZ` (ADR-0004), `fromJSDate(NepaliDate.of(2081, 4, 15).toJSDate("local"),
  "local")` equals `NepaliDate.of(2081, 4, 15)`.

### T4-04 Temporal-shaped interop test
If `globalThis.Temporal` exists (Node 26, Deno), a test checks
`NepaliDate.fromGregorian(Temporal.PlainDate.from("2024-07-30"))` is 2081-04-15 and
`Temporal.PlainDate.from(NepaliDate.of(2081, 4, 15).toGregorian()).toString() === "2024-07-30"`;
otherwise it is skipped. No polyfill in devDependencies.

### T4-05 Catalogue, property tests, benchmark
- `test/csharp-catalog.test.ts` in each package: add every catalogue row tagged phase 4 (patro rows
  in `packages/nepdate-patro/test/`, interop rows in `packages/nepdate/test/`).
- Property test (fast-check, fixed seed): for every serial in coverage, `info` agrees with a
  straightforward lookup in the JSON of `shared/data/patro/` read by the test.
- `bench/own.ts`: add B7 (`info` on the 64 patro dates of BENCHMARK §3) and B8 (a month grid: for
  each of the 64 dates, `NepaliDate.of` and `info` for every day of its month); `nepdate-patro` from
  `file:../packages/nepdate-patro`.
AC: the catalogue tests list no missing id for phase 4; the PR pastes the `bench/own.ts` output.

## Checkpoint

The implementation agent stops here. The reviewer checks:
- [ ] `npm run ci` passes; gate 6 shows the core tarball has no `World Day Against Human
      Trafficking` and no `nepdate-patro` import.
- [ ] `packages/nepdate/` builds and tests with `packages/nepdate-patro/` deleted (shown in the
      PR).
- [ ] Every catalogue row tagged phase 4 has a case or a named deviation.
- [ ] Counts T = 2190, H = 294, E = 1671 and every PATRO §4 anchor are tested.
- [ ] `info` has no binary search, no object or array literal on its call path.
- [ ] `today()` tests use `vi.setSystemTime`, and the `TZ` matrix ran.
- [ ] `bench/own.ts` in the PR: B7 < 10 ns (ADR-0002 §10).
