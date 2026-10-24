# `nepdate-core`, `nepdate-patro` and `nepdate-picker` (TypeScript): exported API contract (v0.1)

The complete exported surface of both packages for v0.1. Implement exactly this; a new export
needs this file changed in the same PR, approved by the human. Behaviour: `shared/spec/`.
Conventions: ADR-0003. Months are **1-based** everywhere (unlike JS `Date`). Every optional `lang`
defaults to `"en"`. `nepdate-core` never imports `nepdate-patro` (ADR-0001 §2).

```ts
// "nepdate-core"
export type Lang = "en" | "ne";
export type Overflow = "clamp" | "spill";                    // ALGORITHM §8 (clamp = C# default)
export type DateOrder = "ymd" | "ydm" | "myd" | "mdy" | "dym" | "dmy";
export type Separator = "/" | "\\" | "." | "_" | "-" | " ";
export interface GregorianDate { readonly year: number; readonly month: number; readonly day: number }
// Structural: a Temporal.PlainDate satisfies GregorianDate, so no Temporal dependency is needed.

export class NepaliDate {
  static readonly MIN: NepaliDate;                           // 1901-01-01
  static readonly MAX: NepaliDate;                           // 2199-12-30
  static of(year: number, month: number, day: number): NepaliDate;     // throws NepDateError
  static fromGregorian(date: GregorianDate): NepaliDate;               // incl. Temporal.PlainDate
  static fromJSDate(date: Date, zone: "utc" | "local"): NepaliDate;    // zone is required
  static today(timeZone?: string): NepaliDate;                         // default "Asia/Kathmandu"
  static parse(s: string): NepaliDate;                                  // strict, PARSING §1
  static tryParse(s: string): NepaliDate | null;
  static parseLenient(s: string): NepaliDate;                           // PARSING §2
  static compare(a: NepaliDate, b: NepaliDate): -1 | 0 | 1;             // for Array.prototype.sort

  readonly year: number;
  readonly month: number;                                    // 1..12
  readonly day: number;
  get weekday(): number;                                     // 0 = Sunday (same as Date#getDay)
  get dayOfYear(): number;
  get monthLength(): number;
  firstOfMonth(): NepaliDate;
  lastOfMonth(): NepaliDate;
  toGregorian(): GregorianDate;                              // pass to Temporal.PlainDate.from(...)
  toJSDate(zone: "utc" | "local"): Date;                     // midnight in that zone

  addDays(n: number): NepaliDate;                            // integers only (D-03), throws otherwise
  addMonths(n: number, overflow?: Overflow): NepaliDate;
  addYears(n: number, overflow?: Overflow): NepaliDate;
  daysUntil(other: NepaliDate): number;                      // other - this (D-07)
  diff(other: NepaliDate): DateDiff;                         // ALGORITHM §8a
  equals(other: NepaliDate): boolean;
  fiscalYear(): FiscalYear;
  quarter(): Quarter;

  toString(): string;                                        // "YYYY/MM/DD"
  toJSON(): string;                                          // "YYYY-MM-DD" (D-11)
  short(opts?: { readonly order?: DateOrder; readonly separator?: Separator; readonly pad?: boolean; readonly lang?: Lang }): string; // defaults: "ymd", "/", true, "en"
  long(opts?: { readonly weekday?: boolean; readonly year?: boolean; readonly pad?: boolean; readonly lang?: Lang }): string;
  format(pattern: string, lang?: Lang): string;              // FORMATTING §5
  // No valueOf: `a < b` would silently compare strings. Use compare() or daysUntil().
}

export function monthName(month: number, lang?: Lang): string;          // FORMATTING §1
export function monthShortName(month: number, lang?: Lang): string;     // D-04: Asa / Aso
export function weekdayName(weekday: number, lang?: Lang): string;
export function weekdayShortName(weekday: number, lang?: Lang): string;
export function toNepaliDigits(n: number, minWidth?: number): string;

export type ErrorKind =
  | "out-of-range" | "invalid-month" | "invalid-day" | "invalid-gregorian" | "not-an-integer"
  | "invalid-character" | "wrong-group-count" | "number-too-long" | "ambiguous" | "unrecognized";
export class NepDateError extends RangeError {
  readonly kind: ErrorKind;
  readonly name: "NepDateError";
  constructor(kind: ErrorKind, message: string);
}

export interface DateDiff { readonly negative: boolean; readonly years: number; readonly months: number; readonly days: number; readonly totalDays: number }

export type Quarter = 1 | 2 | 3 | 4;
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

export class DateRange implements Iterable<NepaliDate> {     // inclusive; D-09: no set operations
  static of(start: NepaliDate, end: NepaliDate): DateRange;  // "out-of-range" if start > end
  static month(year: number, month: number): DateRange;
  static year(year: number): DateRange;
  readonly start: NepaliDate;
  readonly end: NepaliDate;
  get length(): number;
  contains(date: NepaliDate): boolean;
  [Symbol.iterator](): IterableIterator<NepaliDate>;
}
```

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

```ts
// "nepdate-picker": a separate npm package (ADR-0015). Web components plus the DOM-free month grid.
// peerDependencies: { "nepdate-core": "~X.Y.Z" }. `import "nepdate-picker/define"` registers both
// elements; `nepdate-picker/theme.css` is an optional stylesheet. Neither is part of this surface.
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

Notes:
- `fromJSDate` and `toJSDate` take the zone explicitly because `new Date("2024-04-13")` is UTC midnight
  while `new Date(2024, 3, 13)` is local midnight: guessing is how other packages get dates off by one.
- `today()` defaults to Nepal time via `Intl.DateTimeFormat` with `timeZone: "Asia/Kathmandu"`, not the
  machine's zone.
- `info(date)` returns the same frozen `CalendarInfo` for a day on every call, with a frozen `events` array (no allocation per call, ADR-0002 §7).
- `nepdate-patro` reads a date's serial as `NepaliDate.MIN.daysUntil(date)` and builds dates with
  `NepaliDate.MIN.addDays(serial)` (ADR-0002 §7). It needs no extra export from the core.
- Usage: `import { NepaliDate } from "nepdate-core"; import { info } from "nepdate-patro";
  info(NepaliDate.of(2081, 2, 15)).isPublicHoliday === true` (Republic Day).
