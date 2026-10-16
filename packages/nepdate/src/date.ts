import { EPOCH_UNIX_DAYS, MAX_YEAR, MIN_YEAR } from "./calendar.gen.js";
import { NepDateError } from "./errors.js";
import { FiscalYear, type Quarter } from "./fiscal.js";
import { type DateOrder, formatDate, longDate, type Separator, shortDate } from "./format.js";
import {
  civilFromDays,
  daysFromCivil,
  type GregorianDate,
  gregorianMonthLength,
} from "./gregorian.js";
import type { Lang } from "./lang.js";
import { strictParts } from "./parse.js";
import { MONTH_START, MONTHS, YEAR_START } from "./tables.js";

/** What `addMonths` does when the day doesn't exist in the target month (ALGORITHM §8). */
export type Overflow = "clamp" | "spill";

/** Serial of BS 2199-12-30, the last supported day (ALGORITHM §2). */
export const MAX_SERIAL = 109211;
/** Weekday of serial 0 (BS 1901-01-01 was a Thursday), 0 = Sunday. */
const EPOCH_WEEKDAY = 4;
const MIN_AD_YEAR = 1844;
const MAX_AD_YEAR = 2143;

// Only code in this module can pass this, so JavaScript callers can't skip the checks in `of`.
const TOKEN: unique symbol = Symbol("NepaliDate");

// `(x | 0) === x` is the fast path for the usual small integers. Values that fail it are checked
// with Number.isSafeInteger, so a large safe integer reaches the range checks instead.
function checkIntegers(year: number, month: number, day: number): void {
  if ((year | 0) === year && (month | 0) === month && (day | 0) === day) return;
  for (const [name, value] of [
    ["year", year],
    ["month", month],
    ["day", day],
  ] as const) {
    if (!Number.isSafeInteger(value)) {
      throw new NepDateError("not-an-integer", `${name} must be a safe integer, got ${value}`);
    }
  }
}

function checkInteger(name: string, value: number): void {
  if ((value | 0) !== value && !Number.isSafeInteger(value)) {
    throw new NepDateError("not-an-integer", `${name} must be a safe integer, got ${value}`);
  }
}

function outOfRange(what: string): NepDateError {
  return new NepDateError("out-of-range", `${what} is outside BS 1901-01-01..2199-12-30`);
}

/** The month index `(year - MIN_YEAR) * 12 + month - 1` of the month containing `serial`. */
function monthIndexOf(serial: number): number {
  // The estimate is never more than one month off for any serial (ADR-0002 §6), so one step in
  // either direction fixes it. serial * MONTHS stays below 2^31.
  let i = ((serial * MONTHS) / (MAX_SERIAL + 1)) | 0;
  if ((MONTH_START[i] as number) > serial) i--;
  else if ((MONTH_START[i + 1] as number) <= serial) i++;
  return i;
}

/** Internal: the serial of a date (ALGORITHM §4). Set by the static block of `NepaliDate`. */
export let serialOf: (date: NepaliDate) => number;
// Internal: builds a date from fields and serial that the caller has already checked.
let create: (year: number, month: number, day: number, serial: number) => NepaliDate;

/** The calendar breakdown between two dates (ALGORITHM §8a). */
export interface DateDiff {
  /** True when the other date is before this one. */
  readonly negative: boolean;
  readonly years: number;
  /** 0 to 11. */
  readonly months: number;
  /** 0 to 32. */
  readonly days: number;
  /** The signed day difference, the same as `daysUntil`. */
  readonly totalDays: number;
}

/** Serial of `date` moved by `n` months with clamp; the caller knows the target is in range. */
function clampedMonthSerial(date: NepaliDate, n: number): number {
  const t = (date.year - MIN_YEAR) * 12 + date.month - 1 + n;
  const start = MONTH_START[t] as number;
  const length = (MONTH_START[t + 1] as number) - start;
  return start + (date.day <= length ? date.day : length) - 1;
}

/**
 * `date` moved by `n` whole months (ALGORITHM §8). The target month index is range-checked before
 * it is split, so the divisions see a non-negative value, and no intermediate date is built.
 */
function shiftMonths(date: NepaliDate, n: number, overflow: Overflow): NepaliDate {
  const t = (date.year - MIN_YEAR) * 12 + date.month - 1 + n;
  if (!(t >= 0 && t < MONTHS)) {
    throw outOfRange(`${date.year}-${date.month}-${date.day} + ${n} months`);
  }
  const start = MONTH_START[t] as number;
  const length = (MONTH_START[t + 1] as number) - start;
  const year = MIN_YEAR + ((t / 12) | 0);
  const month = (t % 12) + 1;
  const day = date.day;
  if (day <= length) return create(year, month, day, start + day - 1);
  if (overflow !== "spill") return create(year, month, length, start + length - 1);
  // Spill: the days past the month's end go into the next month (at most 3 of them).
  if (t + 1 >= MONTHS) throw outOfRange(`${date.year}-${date.month}-${date.day} + ${n} months`);
  return month === 12
    ? create(year + 1, 1, day - length, start + day - 1)
    : create(year, month + 1, day - length, start + day - 1);
}

/** Internal: the date at `serial`, which the caller has checked is in `0..MAX_SERIAL`. */
export function fromSerial(serial: number): NepaliDate {
  const i = monthIndexOf(serial);
  return create(
    MIN_YEAR + ((i / 12) | 0),
    (i % 12) + 1,
    serial - (MONTH_START[i] as number) + 1,
    serial,
  );
}

/**
 * A date of the Bikram Sambat calendar, BS 1901-01-01 to 2199-12-30. Immutable; build one with
 * {@link NepaliDate.of} or {@link NepaliDate.fromGregorian}. Months are 1-based.
 */
export class NepaliDate {
  // Runs before MIN and MAX below, which need `create`.
  static {
    serialOf = (date) => date.#serial;
    create = (year, month, day, serial) => new NepaliDate(TOKEN, year, month, day, serial);
  }

  /** The first supported date, BS 1901-01-01 (AD 1844-04-11). */
  static readonly MIN: NepaliDate = fromSerial(0);
  /** The last supported date, BS 2199-12-30 (AD 2143-04-15). */
  static readonly MAX: NepaliDate = fromSerial(MAX_SERIAL);

  /** The BS year, 1901 to 2199. */
  readonly year: number;
  /** The month, 1 (Baishakh) to 12 (Chaitra). */
  readonly month: number;
  /** The day of the month, 1 to 32. */
  readonly day: number;
  #serial: number;

  private constructor(token: symbol, year: number, month: number, day: number, serial: number) {
    if (token !== TOKEN) throw new TypeError("use NepaliDate.of or NepaliDate.fromGregorian");
    this.year = year;
    this.month = month;
    this.day = day;
    this.#serial = serial;
  }

  /**
   * The BS date `year`-`month`-`day`.
   * @throws {NepDateError} `"not-an-integer"` if an argument is not a safe integer, else the first
   * failing check: `"out-of-range"` (year outside 1901..2199), `"invalid-month"`, `"invalid-day"`.
   */
  static of(year: number, month: number, day: number): NepaliDate {
    checkIntegers(year, month, day);
    if (year < MIN_YEAR || year > MAX_YEAR) {
      throw new NepDateError("out-of-range", `year ${year} is outside ${MIN_YEAR}..${MAX_YEAR}`);
    }
    if (month < 1 || month > 12) {
      throw new NepDateError("invalid-month", `month ${month} is outside 1..12`);
    }
    const i = (year - MIN_YEAR) * 12 + month - 1;
    const start = MONTH_START[i] as number;
    const length = (MONTH_START[i + 1] as number) - start;
    if (day < 1 || day > length) {
      throw new NepDateError(
        "invalid-day",
        `day ${day} is outside 1..${length} for ${year}-${month}`,
      );
    }
    return new NepaliDate(TOKEN, year, month, day, start + day - 1);
  }

  /**
   * The BS date of a Gregorian date. Accepts any `{ year, month, day }`, such as a
   * `Temporal.PlainDate`.
   * @throws {NepDateError} `"not-an-integer"`, `"invalid-gregorian"` (no such Gregorian date) or
   * `"out-of-range"` (outside AD 1844-04-11..2143-04-15), checked in that order.
   */
  static fromGregorian(date: GregorianDate): NepaliDate {
    const { year, month, day } = date;
    checkIntegers(year, month, day);
    if (month < 1 || month > 12 || day < 1 || day > gregorianMonthLength(year, month)) {
      throw new NepDateError(
        "invalid-gregorian",
        `${year}-${month}-${day} is not a Gregorian date`,
      );
    }
    // The year check keeps daysFromCivil inside its integer range; the serial check is exact.
    const serial =
      year < MIN_AD_YEAR || year > MAX_AD_YEAR
        ? -1
        : daysFromCivil(year, month, day) - EPOCH_UNIX_DAYS;
    if (serial < 0 || serial > MAX_SERIAL) {
      throw new NepDateError(
        "out-of-range",
        `AD ${year}-${month}-${day} is outside 1844-04-11..2143-04-15`,
      );
    }
    return fromSerial(serial);
  }

  /**
   * The BS date parsed strictly from `year month day`, in that order (PARSING §1). Accepts ASCII
   * and Devanagari digits, mixed, and the separators `- / . _ \ space । |`.
   * @throws {NepDateError} a parse kind, or `"out-of-range"`, `"invalid-month"`, `"invalid-day"`.
   */
  static parse(s: string): NepaliDate {
    const [year, month, day] = strictParts(s);
    return NepaliDate.of(year, month, day);
  }

  /** `parse`, or `null` instead of throwing. */
  static tryParse(s: string): NepaliDate | null {
    try {
      return NepaliDate.parse(s);
    } catch (error) {
      if (error instanceof NepDateError) return null;
      throw error;
    }
  }

  /** -1 if `a` is before `b`, 1 if after, 0 if the same day. Pass it to `Array.prototype.sort`. */
  static compare(a: NepaliDate, b: NepaliDate): -1 | 0 | 1 {
    return a.#serial < b.#serial ? -1 : a.#serial > b.#serial ? 1 : 0;
  }

  /** The day of the week, 0 = Sunday to 6 = Saturday (as `Date#getDay`). */
  get weekday(): number {
    return (this.#serial + EPOCH_WEEKDAY) % 7;
  }

  /** The day of the BS year, 1 to 367. */
  get dayOfYear(): number {
    return this.#serial - (YEAR_START[this.year - MIN_YEAR] as number) + 1;
  }

  /** The number of days in this date's month, 29 to 32. */
  get monthLength(): number {
    const i = (this.year - MIN_YEAR) * 12 + this.month - 1;
    return (MONTH_START[i + 1] as number) - (MONTH_START[i] as number);
  }

  /** The first day of this date's month. */
  firstOfMonth(): NepaliDate {
    return new NepaliDate(TOKEN, this.year, this.month, 1, this.#serial - this.day + 1);
  }

  /** The last day of this date's month. */
  lastOfMonth(): NepaliDate {
    const length = this.monthLength;
    return new NepaliDate(TOKEN, this.year, this.month, length, this.#serial - this.day + length);
  }

  /** The Gregorian date, a plain object you can pass to `Temporal.PlainDate.from`. */
  toGregorian(): GregorianDate {
    return civilFromDays(this.#serial + EPOCH_UNIX_DAYS);
  }

  /**
   * The date `n` days later (earlier if `n` is negative).
   * @throws {NepDateError} `"not-an-integer"` (D-03), or `"out-of-range"` past MIN or MAX.
   */
  addDays(n: number): NepaliDate {
    checkInteger("n", n);
    const serial = this.#serial + n;
    if (serial < 0 || serial > MAX_SERIAL)
      throw outOfRange(`${this.year}-${this.month}-${this.day} + ${n} days`);
    return fromSerial(serial);
  }

  /** The signed number of days from this date to `other` (`other - this`, D-07). */
  daysUntil(other: NepaliDate): number {
    return other.#serial - this.#serial;
  }

  /**
   * The date `n` months later (earlier if `n` is negative), same day of the month. When that
   * month is shorter, `"clamp"` (the default, as C#) gives its last day and `"spill"` carries the
   * extra days into the next month (ALGORITHM §8).
   * @throws {NepDateError} `"not-an-integer"` (D-02), or `"out-of-range"`.
   */
  addMonths(n: number, overflow: Overflow = "clamp"): NepaliDate {
    checkInteger("n", n);
    return shiftMonths(this, n, overflow);
  }

  /**
   * The date `n` years later (earlier if `n` is negative); the same as `addMonths(12 * n)`.
   * @throws {NepDateError} `"not-an-integer"`, or `"out-of-range"`.
   */
  addYears(n: number, overflow: Overflow = "clamp"): NepaliDate {
    checkInteger("n", n);
    return shiftMonths(this, 12 * n, overflow);
  }

  /**
   * Years, months and days from this date to `other`, counted from the earlier of the two
   * (ALGORITHM §8a). `negative` is true when `other` is earlier.
   */
  diff(other: NepaliDate): DateDiff {
    const totalDays = other.#serial - this.#serial;
    const negative = totalDays < 0;
    const from = negative ? other : this;
    const to = negative ? this : other;
    // The month count from the fields is right or one too many (§8a), never too few.
    let n = (to.year - from.year) * 12 + to.month - from.month;
    let mid = clampedMonthSerial(from, n);
    if (mid > to.#serial) mid = clampedMonthSerial(from, --n);
    return { negative, years: (n / 12) | 0, months: n % 12, days: to.#serial - mid, totalDays };
  }

  /** The fiscal year that contains this date (ALGORITHM §8b). */
  fiscalYear(): FiscalYear {
    return FiscalYear.containing(this);
  }

  /** The fiscal quarter of this date: 1 for Shrawan to Ashoj, ..., 4 for Baishakh to Ashad. */
  quarter(): Quarter {
    // Months 4..12 map to 1..3 three at a time; months 1..3 wrap round to 4.
    return (((((this.month + 8) / 3) | 0) % 4) + 1) as Quarter;
  }

  /** The default display form, `YYYY/MM/DD` with zero-padded ASCII digits (FORMATTING §2). */
  toString(): string {
    return shortDate(this.year, this.month, this.day, "ymd", "/", true, "en");
  }

  /** The interchange form, `YYYY-MM-DD` (D-11). */
  toJSON(): string {
    return shortDate(this.year, this.month, this.day, "ymd", "-", true, "en");
  }

  /**
   * The three fields in `order`, joined by `separator` (FORMATTING §3). Defaults: `"ymd"`, `"/"`,
   * padded, `"en"`.
   */
  short(opts?: {
    readonly order?: DateOrder;
    readonly separator?: Separator;
    readonly pad?: boolean;
    readonly lang?: Lang;
  }): string {
    return shortDate(
      this.year,
      this.month,
      this.day,
      opts?.order ?? "ymd",
      opts?.separator ?? "/",
      opts?.pad ?? true,
      opts?.lang ?? "en",
    );
  }

  /**
   * `[weekday, ]month day[, year]` (FORMATTING §4). Defaults: no weekday, with year, padded,
   * `"en"`.
   */
  long(opts?: {
    readonly weekday?: boolean;
    readonly year?: boolean;
    readonly pad?: boolean;
    readonly lang?: Lang;
  }): string {
    return longDate(
      this.year,
      this.month,
      this.day,
      this.weekday,
      opts?.weekday ?? false,
      opts?.year ?? true,
      opts?.pad ?? true,
      opts?.lang ?? "en",
    );
  }

  /** The pattern form of FORMATTING §5. */
  format(pattern: string, lang: Lang = "en"): string {
    return formatDate(this.year, this.month, this.day, this.weekday, pattern, lang);
  }

  /** True if `other` is the same day. */
  equals(other: NepaliDate): boolean {
    return this.#serial === other.#serial;
  }
}
