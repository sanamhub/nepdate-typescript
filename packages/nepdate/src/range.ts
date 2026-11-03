import { fromSerial, MAX_SERIAL, NepaliDate, serialOf, weekdayOfSerial } from "./date.js";
import { NepDateError } from "./errors.js";
import { FiscalYear } from "./fiscal.js";
import { type DateOrder, type Separator, shortDate } from "./format.js";
import type { Lang } from "./lang.js";

const TOKEN: unique symbol = Symbol("DateRange");

/** The options of {@link DateRange#toString}: the same three fields as `NepaliDate#short`. */
export interface RangeFormatOptions {
  readonly order?: DateOrder;
  readonly separator?: Separator;
  readonly lang?: Lang;
}

/**
 * An inclusive range of BS dates, never empty (D-01). Construction, bounds, length, containment,
 * overlap, adjacency, intersection, union, difference, the month and fiscal-quarter splits, the
 * interval and working-day helpers, iteration and the two string forms are all here.
 * @example
 * DateRange.month(2081, 4).length; // => 32
 */
export class DateRange implements Iterable<NepaliDate> {
  /** The first day of the range. */
  readonly start: NepaliDate;
  /** The last day of the range, on or after `start`. */
  readonly end: NepaliDate;

  private constructor(token: symbol, start: NepaliDate, end: NepaliDate) {
    if (token !== TOKEN) throw new TypeError("use DateRange.of, DateRange.month or DateRange.year");
    this.start = start;
    this.end = end;
  }

  /**
   * The days from `start` to `end`, both included.
   * @throws {NepDateError} `"out-of-range"` if `end` is before `start`.
   * @example
   * DateRange.of(NepaliDate.of(2081, 1, 1), NepaliDate.of(2081, 1, 3)).length; // => 3
   */
  static of(start: NepaliDate, end: NepaliDate): DateRange {
    if (serialOf(end) < serialOf(start)) {
      throw new NepDateError("out-of-range", "the range ends before it starts");
    }
    return new DateRange(TOKEN, start, end);
  }

  /**
   * The range of the single day `date`.
   * @example
   * DateRange.single(NepaliDate.of(2081, 4, 15)).length; // => 1
   */
  static single(date: NepaliDate): DateRange {
    return new DateRange(TOKEN, date, date);
  }

  /**
   * The range of `days` days that starts at `start`; `days` must be at least 1.
   * @throws {NepDateError} `"out-of-range"` when `days` is below 1 or the end is past MAX, and
   * `"not-an-integer"` when `days` is not an integer.
   * @example
   * DateRange.fromDayCount(NepaliDate.of(2081, 4, 15), 5).length; // => 5
   */
  static fromDayCount(start: NepaliDate, days: number): DateRange {
    if (days < 1) throw new NepDateError("out-of-range", `days ${days} is below 1`);
    return DateRange.of(start, start.addDays(days - 1));
  }

  /**
   * Every day of BS month `year`-`month`.
   * @throws {NepDateError} as `NepaliDate.of(year, month, 1)`.
   * @example
   * DateRange.month(2081, 1).length; // => 31
   */
  static month(year: number, month: number): DateRange {
    const first = NepaliDate.of(year, month, 1);
    return new DateRange(TOKEN, first, first.lastOfMonth());
  }

  /**
   * Every day of BS year `year`, 1 Baishakh to the end of Chaitra.
   * @throws {NepDateError} as `NepaliDate.of(year, 1, 1)`.
   * @example
   * DateRange.year(2081).length; // => 366
   */
  static year(year: number): DateRange {
    return new DateRange(
      TOKEN,
      NepaliDate.of(year, 1, 1),
      NepaliDate.of(year, 12, 1).lastOfMonth(),
    );
  }

  /**
   * Every day of the BS month that today falls in, in `timeZone`.
   * @throws {NepDateError} as {@link NepaliDate.today}.
   * @example
   * DateRange.currentMonth("Asia/Kathmandu").contains(NepaliDate.today("Asia/Kathmandu")); // => true
   */
  static currentMonth(timeZone: string = "Asia/Kathmandu"): DateRange {
    const today = NepaliDate.today(timeZone);
    return DateRange.month(today.year, today.month);
  }

  /**
   * Every day of the fiscal year that today falls in, in `timeZone`.
   * @throws {NepDateError} as {@link NepaliDate.today} or `FiscalYear#range`.
   * @example
   * DateRange.currentFiscalYear("Asia/Kathmandu").contains(NepaliDate.today("Asia/Kathmandu")); // => true
   */
  static currentFiscalYear(timeZone: string = "Asia/Kathmandu"): DateRange {
    return FiscalYear.containing(NepaliDate.today(timeZone)).range();
  }

  /**
   * Every day of the BS year that today falls in, in `timeZone`.
   * @throws {NepDateError} as {@link NepaliDate.today}.
   * @example
   * DateRange.currentCalendarYear("Asia/Kathmandu").contains(NepaliDate.today("Asia/Kathmandu")); // => true
   */
  static currentCalendarYear(timeZone: string = "Asia/Kathmandu"): DateRange {
    return DateRange.year(NepaliDate.today(timeZone).year);
  }

  /** The number of days in the range, at least 1. */
  get length(): number {
    return serialOf(this.end) - serialOf(this.start) + 1;
  }

  /** True if `date` is on or between `start` and `end`. */
  contains(date: NepaliDate): boolean {
    const serial = serialOf(date);
    return serial >= serialOf(this.start) && serial <= serialOf(this.end);
  }

  /** True if every day of `other` is a day of this range. */
  containsRange(other: DateRange): boolean {
    return (
      serialOf(other.start) >= serialOf(this.start) && serialOf(other.end) <= serialOf(this.end)
    );
  }

  /** True if the two ranges share at least one day. */
  overlaps(other: DateRange): boolean {
    return (
      serialOf(other.start) <= serialOf(this.end) && serialOf(other.end) >= serialOf(this.start)
    );
  }

  /**
   * True if one range starts the day after the other ends. It is false at the data end, where the
   * day after a range end does not exist, rather than an error (D-16).
   */
  isAdjacentTo(other: DateRange): boolean {
    const thisStart = serialOf(this.start);
    const thisEnd = serialOf(this.end);
    const otherStart = serialOf(other.start);
    const otherEnd = serialOf(other.end);
    if (otherStart > thisEnd) return thisEnd < MAX_SERIAL && otherStart === thisEnd + 1;
    if (thisStart > otherEnd) return otherEnd < MAX_SERIAL && thisStart === otherEnd + 1;
    return false;
  }

  /**
   * The days that are in both ranges, or `null` when they do not overlap. `null` is the port's
   * "no range" value, because a range is never empty (D-01, D-16).
   * @example
   * DateRange.month(2081, 4).intersect(DateRange.year(2080)); // => null
   */
  intersect(other: DateRange): DateRange | null {
    const start = Math.max(serialOf(this.start), serialOf(other.start));
    const end = Math.min(serialOf(this.end), serialOf(other.end));
    return start > end ? null : DateRange.of(fromSerial(start), fromSerial(end));
  }

  /**
   * The smallest range that covers both. It is not a set union: a gap between the two ranges is
   * inside the result.
   */
  union(other: DateRange): DateRange {
    const start = Math.min(serialOf(this.start), serialOf(other.start));
    const end = Math.max(serialOf(this.end), serialOf(other.end));
    return DateRange.of(fromSerial(start), fromSerial(end));
  }

  /**
   * This range with every day of `other` removed: no range, one range or two ranges.
   * @example
   * DateRange.month(2081, 4).except(DateRange.month(2081, 4)).length; // => 0
   */
  except(other: DateRange): DateRange[] {
    const from = serialOf(other.start);
    const to = serialOf(other.end);
    const start = serialOf(this.start);
    const end = serialOf(this.end);
    if (to < start || from > end) return [this];
    const out: DateRange[] = [];
    if (from > start) out.push(DateRange.of(this.start, fromSerial(from - 1)));
    if (to < end) out.push(DateRange.of(fromSerial(to + 1), this.end));
    return out;
  }

  /**
   * One range per BS month touched, the first and last clipped to the range ends. A range that
   * reaches the data end returns every piece instead of throwing (D-16).
   */
  splitByMonth(): DateRange[] {
    const out: DateRange[] = [];
    const last = serialOf(this.end);
    let serial = serialOf(this.start);
    while (serial <= last) {
      const first = fromSerial(serial);
      const end = Math.min(serialOf(first.lastOfMonth()), last);
      out.push(DateRange.of(first, fromSerial(end)));
      serial = end + 1;
    }
    return out;
  }

  /**
   * One range per fiscal quarter touched, the first and last clipped to the range ends. A range
   * that reaches the data end returns every piece instead of throwing (D-16).
   */
  splitByFiscalQuarter(): DateRange[] {
    const out: DateRange[] = [];
    const last = serialOf(this.end);
    let serial = serialOf(this.start);
    while (serial <= last) {
      const first = fromSerial(serial);
      const quarter = FiscalYear.containing(first).quarterRange(first.quarter());
      const end = Math.min(serialOf(quarter.end), last);
      out.push(DateRange.of(first, fromSerial(end)));
      serial = end + 1;
    }
    return out;
  }

  /**
   * Every day from `start` in steps of `interval` days. `interval` is checked here rather than on
   * the first step, so a bad argument throws at the call.
   * @throws {NepDateError} `"not-an-integer"` when `interval` is not an integer, `"out-of-range"`
   * when it is below 1.
   * @example
   * [...DateRange.fromDayCount(NepaliDate.of(2081, 4, 10), 5).datesWithInterval(2)].length; // => 3
   */
  datesWithInterval(interval: number): IterableIterator<NepaliDate> {
    if (!Number.isSafeInteger(interval)) {
      throw new NepDateError("not-an-integer", `interval must be a safe integer, got ${interval}`);
    }
    if (interval < 1) throw new NepDateError("out-of-range", `interval ${interval} is below 1`);
    return this.#every(interval);
  }

  /**
   * Every day except Saturday, and except Sunday too when `excludeSunday` is true.
   * @example
   * [...DateRange.fromDayCount(NepaliDate.of(2081, 4, 13), 9).workingDays()].length; // => 8
   */
  workingDays(opts?: { readonly excludeSunday?: boolean }): IterableIterator<NepaliDate> {
    return this.#byWeekend(false, opts?.excludeSunday ?? false);
  }

  /**
   * Every Saturday, and Sunday too when `includeSunday` is true.
   * @example
   * [...DateRange.fromDayCount(NepaliDate.of(2081, 4, 13), 9).weekendDays()].length; // => 3
   */
  weekendDays(opts?: { readonly includeSunday?: boolean }): IterableIterator<NepaliDate> {
    return this.#byWeekend(true, opts?.includeSunday ?? true);
  }

  /**
   * The two dates as `"start - end"`, or with the fields in `opts.order`, `opts.separator` between
   * them and `opts.lang`'s names and digits.
   * @example
   * DateRange.of(NepaliDate.of(2081, 4, 10), NepaliDate.of(2081, 4, 20)).toString(); // => "2081/04/10 - 2081/04/20"
   */
  toString(opts?: RangeFormatOptions): string {
    const order = opts?.order ?? "ymd";
    const separator = opts?.separator ?? "/";
    const lang = opts?.lang ?? "en";
    const start = shortDate(
      this.start.year,
      this.start.month,
      this.start.day,
      order,
      separator,
      true,
      lang,
    );
    const end = shortDate(
      this.end.year,
      this.end.month,
      this.end.day,
      order,
      separator,
      true,
      lang,
    );
    return `${start} - ${end}`;
  }

  /**
   * True if `other` is a `DateRange` with the same two bounds, false for any other value.
   * @example
   * DateRange.month(2081, 4).equals(DateRange.month(2081, 4)); // => true
   */
  equals(other: DateRange): boolean {
    return (
      other instanceof DateRange &&
      serialOf(other.start) === serialOf(this.start) &&
      serialOf(other.end) === serialOf(this.end)
    );
  }

  /** Every day from `start` to `end`, in order. */
  *[Symbol.iterator](): IterableIterator<NepaliDate> {
    // Every serial between two valid dates is valid, so no step is checked again.
    const last = serialOf(this.end);
    for (let serial = serialOf(this.start); serial <= last; serial++) yield fromSerial(serial);
  }

  /** Every `step`th day, from `start` up to and including `end`. */
  *#every(step: number): IterableIterator<NepaliDate> {
    const last = serialOf(this.end);
    for (let serial = serialOf(this.start); serial <= last; serial += step)
      yield fromSerial(serial);
  }

  /** Weekend days when `wantWeekend` is true, working days when it is false. */
  *#byWeekend(wantWeekend: boolean, sunday: boolean): IterableIterator<NepaliDate> {
    const last = serialOf(this.end);
    for (let serial = serialOf(this.start); serial <= last; serial++) {
      const weekday = weekdayOfSerial(serial);
      const isSaturday = weekday === 6;
      const isSunday = weekday === 0;
      const wanted = wantWeekend
        ? isSaturday || (sunday && isSunday)
        : !isSaturday && !(sunday && isSunday);
      if (wanted) yield fromSerial(serial);
    }
  }
}
