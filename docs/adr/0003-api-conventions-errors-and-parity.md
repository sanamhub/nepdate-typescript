# ADR-0003: API conventions, errors and parity mapping

- Status: Accepted
- Date: 2026-09-25
- Updated: 2026-10-07 (D-13 row, hub ADR-0004)
- Deciders: Sanam Pakuwal

## Decision

**Conventions** (full surface in `docs/API.md`):
- Static factories (`NepaliDate.of`, `fromGregorian`, `parse`) throw `NepDateError`; `tryParse`
  returns `null`. This matches Temporal, which throws `RangeError`.
- Months are 1-based; weekday 0 = Sunday (same as `Date#getDay`).
- Temporal interop is **structural**: `fromGregorian` accepts anything with `year`, `month`, `day`
  (a `Temporal.PlainDate` qualifies) and `toGregorian()` returns a plain object for
  `Temporal.PlainDate.from()`. No Temporal global or polyfill is needed or imported.
- `fromJSDate`/`toJSDate` take the zone (`"utc"` or `"local"`) as a required argument.
- `today(timeZone = "Asia/Kathmandu")` reads the date with
  `Intl.DateTimeFormat("en-CA", { timeZone })`, never the machine's zone.
- No `valueOf` (it would make `<` compare strings or numbers silently); `NepaliDate.compare` for
  sorting.
- String options use string-literal unions, not enums (`erasableSyntaxOnly`).
- Arguments must be safe integers (`Number.isSafeInteger`), else `NepDateError("not-an-integer")`.

**Errors:** one class, `NepDateError extends RangeError`, with `kind` as a string-literal union, so
`instanceof RangeError` still works.

**Parity** (`shared/spec/PARITY.md`, applies unchanged):

| ID | TypeScript |
|---|---|
| D-01 | no public constructor; `NepaliDate.of` validates |
| D-02, D-03 | `addMonths(n, overflow)`, `addDays(n)`; non-integers throw |
| D-04 | `monthShortName` returns `Asa` / `Aso` |
| D-05, D-06 | `parse` (strict), `parseLenient` |
| D-07 | `daysUntil(other): number` |
| D-08 | `FiscalYear` with `start`, `end`, `quarterRange` |
| D-09 | `DateRange`: `length`, `contains`, iteration only |
| D-10 | not ported |
| D-11 | `toJSON()` is `"YYYY-MM-DD"` |
| D-12 | `monthLength`; year length via `DateRange.year(y).length` |
| D-13 | separate npm package `nepdate-patro` (hub ADR-0004): `info(date)`, `coverage()`, `publicHolidays()` |
| D-14 | not ported; `today()` and `addDays(±1)` |
| D-15 | `lang` option on every formatter |

A TypeScript-only deviation is not allowed; propose it to the hub.
