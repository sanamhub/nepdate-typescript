# Changelog

All notable changes to `nepdate-core` and `nepdate-patro` are listed here. The two packages share one
version (ADR-0005, amended by ADR-0018); an entry that concerns only one package starts with its
name. `nepdate-datepicker` has its own version and changelog in
[`packages/nepdate-picker/CHANGELOG.md`](packages/nepdate-picker/CHANGELOG.md). The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0-rc.1] - 2026-11-03

The full API of the NepDate family, with the vectors and the deliberate deviations the hub's
`spec/API.md` and `spec/PARITY.md` name. `nepdate-core` gains the range set operations and the
fiscal-year, batch, integer and year-length members it was missing; the changes below are allowed
because the line is still 0.x.

### Added

- `nepdate-core`: `NepaliDate#yearLength`, the length of the BS year (364 to 367), which replaces
  the Gregorian `IsLeapYear` reading (`D-12`).
- `nepdate-core`: `NepaliDate#isToday`, `isYesterday` and `isTomorrow`, each taking the time zone
  explicitly, so no method depends on a hidden local zone.
- `nepdate-core`: `NepaliDate.fromYmd` and `toYmd`, the `YYYYMMDD` integer form that C# exposed
  through its `TypeConverter` (`D-11`).
- `nepdate-core`: `NepaliDate.fromJSON`, the read half of the `toJSON` hook (`D-11`).
- `nepdate-core`: `NepaliDate.tryParseLenient`, the non-throwing form of `parseLenient`.
- `nepdate-core`: `NepaliDate.toNepaliDates` and `toEnglishDates`, one ordered batch conversion each
  way. The C# parallel flag and batch size do not cross into the API, and the result is in input
  order.
- `nepdate-core`: `DateRange.fromDayCount`, `DateRange.single`, `DateRange.currentMonth`,
  `DateRange.currentFiscalYear` and `DateRange.currentCalendarYear`.
- `nepdate-core`: the rest of the `DateRange` surface: `containsRange`, `overlaps`, `isAdjacentTo`,
  `intersect`, `union`, `except`, `splitByMonth`, `splitByFiscalQuarter`, `datesWithInterval`,
  `workingDays`, `weekendDays`, `toString(options)` and `equals`.
- `nepdate-core`: the `RangeFormatOptions` type for the formatted range string.

### Changed

- `NepDateError` gains the `"invalid-zone"` kind. `today()` and the three relative-date methods wrap
  an unknown zone in it instead of letting the raw `Intl` `RangeError` escape, so one error type
  covers the package.
- `NepaliDate#equals` and `DateRange#equals` return `false` for a value that is not the same type
  instead of throwing a `TypeError`, because a predicate that answers a question should not throw.
- `year`, `month` and `day` are getters over the private day count, so an instance no longer has own
  enumerable data properties. `JSON.stringify` still uses `toJSON`, destructuring still reads the
  three fields, and assigning to one now throws in strict mode instead of leaving the packed day
  count disagreeing with the fields.
- The full API surface grows the core bundle from about 5.4 KB to 6.6 KB gzip, so the size gate's
  single-file budget for the picker, which bundles the core, moves from 11 KB to 12 KB.

### Breaking changes

- `NepDateError` extends `Error`, not `RangeError`. A parse failure is not a numeric range failure,
  and a caller that catches `RangeError` for an unrelated array index must not catch dates.
  Migration: catch `NepDateError` (or `Error`) where you caught `RangeError` from this package;
  `error.kind` is unchanged.
- `NepaliDate#year`, `#month` and `#day` are getters, so `Object.keys(date)` is empty and `{ ...date }`
  copies nothing. Migration: read the three fields directly and use `toGregorian()` or `toJSON()`
  where you copied the fields into another object.
- A pattern that ends in a backslash now writes a literal `\`; it used to write nothing. This matches
  the formatting spec, whose last example is a single trailing backslash. Migration: remove the
  trailing `\` when the old output without it was intended.

## [0.1.0-rc.1] - 2026-11-03

### Changed

- The published check also runs weekly on Linux with npm, pnpm, Yarn in both linkers and bun, and
  daily as a registry metadata check; a failed run opens or updates one issue labelled
  `published-check`.

## [0.1.0-beta.1] - 2026-10-22

First public pre-release. The API may still change before 0.1.0. The core package is
`nepdate-core`: npm refused `nepdate` as too close to `nep-date` (ADR-0013).

### Added

- `nepdate-core`: `NepaliDate` for BS 1901-01-01 to 2199-12-30 with `of`, `fromGregorian`,
  `toGregorian`, `MIN`, `MAX`, `compare`, `equals`, `weekday`, `dayOfYear`, `monthLength`,
  `firstOfMonth` and `lastOfMonth`; `NepDateError` with `kind`.
- `nepdate-patro`: `info`, `coverage` and `publicHolidays` for BS 2077-01-01 to 2084-08-20, with
  tithi, public holiday and event data.
- `nepdate-core`: `NepaliDate.fromJSDate`, `toJSDate` and `today`; the first two take an explicit zone,
  `today` defaults to `Asia/Kathmandu`.
