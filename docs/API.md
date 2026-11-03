# `nepdate-core`, `nepdate-patro` and `nepdate-datepicker` (TypeScript): exported API contract (v0.1)

The complete exported surface of the three packages for v0.1. Implement exactly this; a new export
needs this file changed in the same PR, approved by the maintainer. Behaviour: `shared/spec/`.
Conventions: ADR-0003. Months are **1-based** everywhere (unlike JS `Date`). Every optional `lang`
defaults to `"en"`. `nepdate-core` never imports `nepdate-patro` (ADR-0001 §2).

The groups follow the canonical inventory in the hub's `spec/API.md`; its row IDs are named where a
row decides a shape. The TypeScript column of that table gives the name and signature below.

## Dates, identity and comparison

```ts
// "nepdate-core"
export type Lang = "en" | "ne";

export class NepaliDate {
  static readonly MIN: NepaliDate;                           // 1901-01-01
  static readonly MAX: NepaliDate;                           // 2199-12-30
  static of(year: number, month: number, day: number): NepaliDate;     // throws NepDateError
  static today(timeZone?: string): NepaliDate;                         // default "Asia/Kathmandu"
  static compare(a: NepaliDate, b: NepaliDate): -1 | 0 | 1;             // for Array.prototype.sort

  get year(): number;                                        // read-only at run time
  get month(): number;                                       // 1..12
  get day(): number;
  get weekday(): number;                                     // 0 = Sunday (same as Date#getDay)
  get dayOfYear(): number;
  get monthLength(): number;
  get yearLength(): number;                                  // 364..367 (D-12)
  firstOfMonth(): NepaliDate;
  lastOfMonth(): NepaliDate;
  isToday(timeZone: string): boolean;                        // the zone is explicit
  isYesterday(timeZone: string): boolean;
  isTomorrow(timeZone: string): boolean;
  equals(other: NepaliDate): boolean;                        // false for a foreign value
  // No valueOf: `a < b` would silently compare strings. Use compare() or daysUntil().
  // No hash: the JSON string is a stable key, the serial is private.
}
```

- `year`, `month` and `day` are getters over a private packed serial, not data properties, so a
  JavaScript caller cannot assign to them and leave the three fields disagreeing.
- `yearLength` is the length of the BS year, 364 to 367; it replaces C# `IsLeapYear` (`D-12`).
- `isToday`, `isYesterday` and `isTomorrow` take the zone explicitly. `Today` and `Now` are the same
  date, so there is no separate `now`.
- `equals` returns `false` for anything that is not a `NepaliDate` instead of throwing.
- `MIN` is AD 1844-04-11 and `MAX` is AD 2143-04-15; a valid date is 1901-01-01 to 2199-12-30 BS.

```ts
import { NepaliDate } from "nepdate-core";

const date = NepaliDate.of(2081, 4, 15);
console.log([date.year, date.month, date.day]); // [2081, 4, 15]
console.log(date.weekday, date.dayOfYear, date.monthLength, date.yearLength); // 2 109 32 366
console.log(date.isToday("Asia/Kathmandu")); // false on every day but today
```

## Conversion and serialization

```ts
// "nepdate-core"
import type { GregorianDate } from "nepdate-core";

export class NepaliDate {
  static fromGregorian(date: GregorianDate): NepaliDate;               // incl. Temporal.PlainDate
  static fromJSDate(date: Date, zone: "utc" | "local"): NepaliDate;    // zone is required
  toGregorian(): GregorianDate;                              // pass to Temporal.PlainDate.from(...)
  toJSDate(zone: "utc" | "local"): Date;                     // midnight in that zone

  toJSON(): string;                                          // "YYYY-MM-DD" (D-11)
  static fromJSON(text: string): NepaliDate;                 // the inverse of toJSON
  toYmd(): number;                                           // 20810415, the integer form
  static fromYmd(n: number): NepaliDate;

  static toNepaliDates(dates: Iterable<GregorianDate>): NepaliDate[];   // input order
  static toEnglishDates(strings: Iterable<string>): GregorianDate[];    // input order
  static toEnglishDates(dates: Iterable<NepaliDate>): GregorianDate[];  // input order
}
```

- The canonical text form is `"YYYY-MM-DD"`. `fromJSON` reads JSON text (with the quotes), so
  `fromJSON(JSON.stringify(date))` is the same date; JSON `null` is rejected because an invalid date
  cannot be constructed (`D-01`, `D-11`). The object form, XML and the `TypeConverter` are not ported.
- The `YYYYMMDD` integer form is part of the contract: `toYmd` writes it and `fromYmd` reads
  it, with the same year, month and day checks as `of`.
- Batch conversion is one ordered function each way. The C# `useParallel` and `batchSize` arguments
  do not cross into this API, and the result is in input order. The Gregorian side
  is `GregorianDate`, a structural `{ year, month, day }`, not a `Date`: a `Date` holds an instant
  and needs a zone, so the batch functions never guess one.
- `fromJSDate` and `toJSDate` take the zone explicitly because `new Date("2024-04-13")` is UTC
  midnight while `new Date(2024, 3, 13)` is local midnight.

```ts
import { NepaliDate } from "nepdate-core";

console.log(NepaliDate.of(2081, 4, 15).toJSON()); // "2081-04-15"
console.log(NepaliDate.fromJSON('"2081-04-15"').toYmd()); // 20810415
console.log(NepaliDate.fromYmd(20810415).toGregorian()); // { year: 2024, month: 7, day: 30 }
console.log(NepaliDate.toNepaliDates([{ year: 2024, month: 7, day: 30 }])[0]?.toJSON()); // "2081-04-15"
console.log(NepaliDate.toEnglishDates(["2081-04-15"])); // [{ year: 2024, month: 7, day: 30 }]
```

## Arithmetic

```ts
// "nepdate-core"
export type Overflow = "clamp" | "spill";                    // ALGORITHM §8 (clamp = C# default)

export interface DateDiff {
  readonly negative: boolean;
  readonly years: number;
  readonly months: number;                                   // 0..11
  readonly days: number;                                     // 0..32
  readonly totalDays: number;
}

export class NepaliDate {
  addDays(n: number): NepaliDate;                            // integers only (D-03), throws otherwise
  addMonths(n: number, overflow?: Overflow): NepaliDate;     // whole months only (D-02)
  addYears(n: number, overflow?: Overflow): NepaliDate;      // addMonths(12 * n)
  daysUntil(other: NepaliDate): number;                      // other - this (D-07)
  diff(other: NepaliDate): DateDiff;                         // ALGORITHM §8a
}
```

- `D-07` gives the day difference two names with opposite directions. `daysUntil(other)` is
  `other - this`, the direction of `days_between(a, b)` in `ALGORITHM.md`. C# `Subtract(other)` and
  `operator -` are `this - other`; TypeScript has no operator overload, so write
  `other.daysUntil(this)` for the operator's direction. The two names are not interchangeable.
- `addMonths` clamps to the last day of the target month by default and spills the extra days into
  the following month with `"spill"`. A negative count is the subtraction path, and a fractional
  count throws (`D-02`).
- `addDays` takes an integer and throws for a fraction (`D-03`).

```ts
import { NepaliDate } from "nepdate-core";

const date = NepaliDate.of(2081, 4, 32);
console.log(date.addMonths(2).toJSON()); // "2081-06-30"
console.log(date.addMonths(2, "spill").toJSON()); // "2081-07-02"
console.log(NepaliDate.of(2081, 4, 15).daysUntil(NepaliDate.of(2081, 4, 20))); // 5
console.log(NepaliDate.of(2081, 4, 15).diff(NepaliDate.of(2082, 4, 15))); // { negative: false, years: 1, months: 0, days: 0, totalDays: 366 }
```

## Formatting

```ts
// "nepdate-core"
export type DateOrder = "ymd" | "ydm" | "myd" | "mdy" | "dym" | "dmy";
export type Separator = "/" | "\\" | "." | "_" | "-" | " ";

export class NepaliDate {
  toString(): string;                                        // "YYYY/MM/DD"
  short(opts?: { readonly order?: DateOrder; readonly separator?: Separator; readonly pad?: boolean; readonly lang?: Lang }): string; // defaults: "ymd", "/", true, "en"
  long(opts?: { readonly weekday?: boolean; readonly year?: boolean; readonly pad?: boolean; readonly lang?: Lang }): string;
  format(pattern: string, lang?: Lang): string;              // FORMATTING §5
}

export function monthName(month: number, lang?: Lang): string;          // FORMATTING §1
export function monthShortName(month: number, lang?: Lang): string;     // D-04: Asa / Aso
export function weekdayName(weekday: number, lang?: Lang): string;
export function weekdayShortName(weekday: number, lang?: Lang): string;
export function toNepaliDigits(n: number, minWidth?: number): string;
```

- `short` writes the three fields in `order`, joined by `separator`; `pad` zero-pads the month and
  day, and the year is always four digits. `long` writes `[Weekday, ]Month day[, year]`.
- `format` recognises the standard patterns `""`, `G`, `g`, `d`, `D` and `s` and otherwise scans the
  custom pattern. `yyyy` and longer runs print the year, `y`, `yy` and `yyy` the last two digits,
  `MMMM` the full month name, `MMM` the short name (`Asa` and `Aso`, not C#'s ambiguous `Ash`, D-04),
  `MM` two digits, `M` the number, `dd` two digits, any other `d` run the number, `\x` the literal
  `x` and a trailing `\` a literal `\`, and `'...'` literal text.
- `Lang` is the language selector: `"ne"` gives Devanagari names and digits, `"en"` ASCII. The
  long-form Unicode output is `long({ lang: "ne" })`, not a separate method (`D-15`).

```ts
import { monthName, NepaliDate } from "nepdate-core";

const date = NepaliDate.of(2081, 4, 15);
console.log(date.toString()); // "2081/04/15"
console.log(date.short({ order: "dmy", separator: "-", pad: false })); // "15-4-2081"
console.log(date.long({ weekday: true })); // "Tuesday, Shrawan 15, 2081"
console.log(date.format("yyyy-MM-dd")); // "2081-04-15"
console.log(monthName(4), monthName(4, "ne")); // "Shrawan" "साउन"
```

## Parsing

```ts
// "nepdate-core"
export class NepaliDate {
  static parse(s: string): NepaliDate;                       // strict, PARSING §1
  static tryParse(s: string): NepaliDate | null;
  static parseLenient(s: string): NepaliDate;                // PARSING §2
  static tryParseLenient(s: string): NepaliDate | null;
}
```

- The strict parser takes year, month and day in that order, accepts ASCII and Devanagari digits
  mixed, and allows the separators `- / . _ \ space | ।`. It caps a group at four digits (`D-05`).
- The lenient parser tries the strict parser first, then the closed month-name list of `PARSING.md`.
  There is no fuzzy matching, no guessing and no `autoAdjust` overload (`D-06`); a two-digit year is
  `ambiguous`.
- The throwing forms raise `NepDateError` with a parse `kind`; the `try*` forms return `null`.

```ts
import { NepaliDate } from "nepdate-core";

console.log(NepaliDate.parse("2081-04-15").toJSON()); // "2081-04-15"
console.log(NepaliDate.parseLenient("15 Shrawan 2081").toJSON()); // "2081-04-15"
console.log(NepaliDate.tryParse("2081-13-01")); // null
console.log(NepaliDate.tryParseLenient("not a date")); // null
```

## Ranges

```ts
// "nepdate-core"
export interface RangeFormatOptions {
  readonly order?: DateOrder;
  readonly separator?: Separator;
  readonly lang?: Lang;
}

export class DateRange implements Iterable<NepaliDate> {     // inclusive; never empty (D-01)
  static of(start: NepaliDate, end: NepaliDate): DateRange;  // "out-of-range" if start > end
  static single(date: NepaliDate): DateRange;
  static fromDayCount(start: NepaliDate, days: number): DateRange;
  static month(year: number, month: number): DateRange;
  static year(year: number): DateRange;
  static currentMonth(timeZone?: string): DateRange;
  static currentFiscalYear(timeZone?: string): DateRange;
  static currentCalendarYear(timeZone?: string): DateRange;

  readonly start: NepaliDate;
  readonly end: NepaliDate;
  get length(): number;                                      // at least 1
  contains(date: NepaliDate): boolean;
  containsRange(other: DateRange): boolean;
  overlaps(other: DateRange): boolean;
  isAdjacentTo(other: DateRange): boolean;
  intersect(other: DateRange): DateRange | null;             // null when they do not overlap
  union(other: DateRange): DateRange;
  except(other: DateRange): DateRange[];                     // 0, 1 or 2 ranges
  splitByMonth(): DateRange[];
  splitByFiscalQuarter(): DateRange[];
  datesWithInterval(interval: number): IterableIterator<NepaliDate>;
  workingDays(opts?: { readonly excludeSunday?: boolean }): IterableIterator<NepaliDate>;
  weekendDays(opts?: { readonly includeSunday?: boolean }): IterableIterator<NepaliDate>;
  toString(opts?: RangeFormatOptions): string;
  equals(other: DateRange): boolean;
  [Symbol.iterator](): IterableIterator<NepaliDate>;
}
```

- A range is inclusive and never empty, so `of(start, end)` with `end` before `start` throws instead
  of building the C# empty range (`D-01`). `intersect` returns `null` where C# returns an empty
  range, and `except` returns an empty array when nothing is left.
- `union` is the smallest range that covers both, not a set union: the gap between two disjoint
  ranges is inside the result.
- `splitByMonth` and `splitByFiscalQuarter` clip the first and last piece to the range ends. The
  enumerator, the splits and the day helpers never throw at 2199-12-30 (`D-16`): they return every
  date up to and including it, and `isAdjacentTo` returns `false` when the day after a range end
  does not exist.
- `toString()` is `"start - end"`; `toString({ order, separator, lang })` formats both bounds with
  the same options. `length` counts the days inclusive.

```ts
import { DateRange, NepaliDate } from "nepdate-core";

const month = DateRange.month(2081, 4);
console.log(month.length); // 32
console.log(month.toString()); // "2081/04/01 - 2081/04/32"
console.log(month.splitByMonth().length); // 1
console.log(DateRange.fromDayCount(NepaliDate.of(2081, 4, 15), 5).toString()); // "2081/04/15 - 2081/04/19"
console.log(DateRange.currentMonth("Asia/Kathmandu").contains(NepaliDate.today("Asia/Kathmandu"))); // true
```

## Fiscal year

```ts
// "nepdate-core"
export type Quarter = 1 | 2 | 3 | 4;

export class NepaliDate {
  fiscalYear(): FiscalYear;
  quarter(): Quarter;
}

export class FiscalYear {                                    // FY 2082/83 = new FiscalYear(2082)
  constructor(startYear: number);                           // any integer (else "not-an-integer"); start(), end() and ranges throw "out-of-range" outside BS 1901..2199
  readonly startYear: number;
  static containing(date: NepaliDate): FiscalYear;
  start(): NepaliDate;
  end(): NepaliDate;
  range(): DateRange;
  quarterRange(q: Quarter): DateRange;
  label(lang?: Lang): string;                                // "2082/83" / "२०८२/८३"
}
```

- A fiscal year starts on 1 Shrawan (month 4) and ends on the last day of Ashad (month 3) of the next
  BS year. Q1 is Shrawan to Ashoj, Q2 Kartik to Poush, Q3 Magh to Chaitra and Q4 Baishakh to Ashad.
- The value replaces the C# instance `yearOffset` methods and the static `GetFiscalYear*` helpers
  (`D-08`); the fiscal-year value and its methods cover them.

```ts
import { FiscalYear, NepaliDate } from "nepdate-core";

const fiscal = NepaliDate.of(2082, 5, 1).fiscalYear();
console.log(fiscal.label()); // "2082/83"
console.log(fiscal.range().toString()); // "2082/04/01 - 2083/03/32"
console.log(fiscal.quarterRange(1).toString()); // "2082/04/01 - 2082/06/31"
```

## Errors

```ts
// "nepdate-core"
export type ErrorKind =
  | "out-of-range" | "invalid-month" | "invalid-day" | "invalid-gregorian" | "invalid-zone"
  | "not-an-integer" | "invalid-character" | "wrong-group-count" | "number-too-long" | "ambiguous"
  | "unrecognized";
export class NepDateError extends Error {
  readonly kind: ErrorKind;
  readonly name: "NepDateError";
  constructor(kind: ErrorKind, message: string);
}
```

- One error type covers the whole package: a failed date, a failed parse and an unknown time zone
  (`"invalid-zone"`, wrapped instead of the raw `Intl` `RangeError`). It extends `Error`, not
  `RangeError`, so a caller that catches `RangeError` for an unrelated array index does not catch a
  date failure.

```ts
import { NepDateError, NepaliDate } from "nepdate-core";

try {
  NepaliDate.of(2081, 4, 33);
} catch (error) {
  console.log(error instanceof NepDateError, (error as NepDateError).kind); // true "invalid-day"
}
```

## Shared value types

```ts
// "nepdate-core"
export interface GregorianDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}
```

`GregorianDate` is structural: a `Temporal.PlainDate` satisfies it, so no Temporal dependency is
needed and no `Date` is required for a plain conversion. `DateDiff` and `RangeFormatOptions` are
declared in the arithmetic and ranges groups.

## Patro

```ts
// "nepdate-patro": a separate npm package (hub ADR-0004, ADR-0001 §1).
// peerDependencies: { "nepdate-core": "~X.Y.Z" }, same version as the core.
import type { DateRange, NepaliDate } from "nepdate-core";

export interface Named { readonly np: string; readonly en: string }
export interface CalendarInfo {
  readonly tithi: Named | null;
  readonly isPublicHoliday: boolean;
  readonly events: readonly Named[];                         // frozen, shared; file order
}
export function info(date: NepaliDate): CalendarInfo;        // never throws; empty outside coverage
export function coverage(): DateRange;                       // 2077-01-01..2084-08-20 with current data
export function publicHolidays(): IterableIterator<NepaliDate>; // ascending
```

- `info(date)` returns the same frozen `CalendarInfo` for a day on every call, with a frozen `events`
  array (no allocation per call, ADR-0002 §7).
- The data covers 2077-01-01 to 2084-08-20 BS, not the 2001 to 2089 the C# XML comments claim.
- `nepdate-patro` reads a date's serial as `NepaliDate.MIN.daysUntil(date)` and builds dates with
  `NepaliDate.MIN.addDays(serial)` (ADR-0002 §7). It needs no extra export from the core.

```ts
import { NepaliDate } from "nepdate-core";
import { info } from "nepdate-patro";

console.log(info(NepaliDate.of(2081, 2, 15)).isPublicHoliday); // true
```

## Date picker

```ts
// "nepdate-datepicker": a separate npm package (ADR-0015). Web components plus the DOM-free month grid.
// peerDependencies: { "nepdate-core": "~X.Y.Z" }. `import "nepdate-datepicker/define"` registers both
// elements; `nepdate-datepicker/theme.css` is an optional stylesheet. Neither is part of this surface.
import type { GregorianDate, NepaliDate } from "nepdate-core";
// ElementBase (not exported) is HTMLElement, or an empty class where there is no DOM, so the entry
// imports in Node and during server rendering.

export interface PickerDay {
  readonly date: NepaliDate;
  readonly gregorian: GregorianDate;
  readonly isToday: boolean;
  readonly disabled: boolean;                                // outside min/max or isDateDisallowed
}
export interface GridOptions {
  readonly firstDayOfWeek?: number;                          // 0 = Sunday (default) .. 6
  readonly min?: NepaliDate | null;
  readonly max?: NepaliDate | null;
  readonly isDateDisallowed?: ((date: NepaliDate) => boolean) | null;
  readonly today?: NepaliDate;                               // default NepaliDate.today()
}
export type GridKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End" | "PageUp" | "PageDown" | "Shift+PageUp" | "Shift+PageDown";
export declare const GRID_ROWS = 6;
export declare function isSelectable(date: NepaliDate, options?: GridOptions): boolean;
export declare function weekdayOrder(options?: GridOptions): number[];
export declare function monthGrid(year: number, month: number, options?: GridOptions): (PickerDay | null)[][];
export declare function moveFocus(date: NepaliDate, key: GridKey, options?: GridOptions): NepaliDate;

export declare const CALENDAR_PARTS: readonly string[];
export declare class NepDateCalendarElement extends ElementBase { // <nepdate-calendar>
  static readonly observedAttributes: string[];
  get value(): string;                                       // "YYYY-MM-DD" (BS) or ""
  set value(value: string);
  get date(): NepaliDate | null;
  set date(date: NepaliDate | null);
  get isDateDisallowed(): ((date: NepaliDate) => boolean) | null;
  set isDateDisallowed(fn: ((date: NepaliDate) => boolean) | null);
  get dayParts(): ((date: NepaliDate) => readonly string[]) | null;
  set dayParts(fn: ((date: NepaliDate) => readonly string[]) | null);
  get month(): NepaliDate;                                   // first day of the month on show
  focusDay(): void;
  connectedCallback(): void;
  attributeChangedCallback(name: string, _old: string | null, value: string | null): void;
}

export declare const INPUT_PARTS: readonly string[];
export declare class NepDateInputElement extends ElementBase { // <nepdate-input>, form-associated
  static readonly formAssociated: boolean;
  static readonly observedAttributes: string[];
  constructor();
  get value(): string;
  set value(value: string);
  get date(): NepaliDate | null;
  set date(date: NepaliDate | null);
  get calendar(): NepDateCalendarElement | null;
  get form(): HTMLFormElement | null;
  get name(): string;
  get validity(): ValidityState;
  get validationMessage(): string;
  checkValidity(): boolean;
  reportValidity(): boolean;
  showPicker(): void;
  connectedCallback(): void;
  attributeChangedCallback(name: string): void;
  formResetCallback(): void;
  formDisabledCallback(disabled: boolean): void;
  formStateRestoreCallback(state: string | File | FormData | null): void;
}

export declare function defineElements(): void;             // no-op without customElements
```

## Notes

- Usage: `import { NepaliDate } from "nepdate-core"; import { info } from "nepdate-patro";
  info(NepaliDate.of(2081, 2, 15)).isPublicHoliday === true` (Republic Day).
- `today()` defaults to Nepal time via `Intl.DateTimeFormat` with `timeZone: "Asia/Kathmandu"`, not
  the machine's zone, and an unknown zone is a `NepDateError` of kind `"invalid-zone"`.
- The picker's exports are unchanged; its README lists the elements' attributes and events.
