import { fromSerial, NepaliDate, serialOf } from "./date.js";
import { NepDateError } from "./errors.js";

const TOKEN: unique symbol = Symbol("DateRange");

/**
 * An inclusive range of BS dates, never empty. It has a length, `contains` and iteration only;
 * set operations, splitting and working days are not ported (D-09): iterate and filter instead.
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
   */
  static of(start: NepaliDate, end: NepaliDate): DateRange {
    if (serialOf(end) < serialOf(start)) {
      throw new NepDateError("out-of-range", "the range ends before it starts");
    }
    return new DateRange(TOKEN, start, end);
  }

  /**
   * Every day of BS month `year`-`month`.
   * @throws {NepDateError} as `NepaliDate.of(year, month, 1)`.
   */
  static month(year: number, month: number): DateRange {
    const first = NepaliDate.of(year, month, 1);
    return new DateRange(TOKEN, first, first.lastOfMonth());
  }

  /**
   * Every day of BS year `year`, 1 Baishakh to the end of Chaitra.
   * @throws {NepDateError} as `NepaliDate.of(year, 1, 1)`.
   */
  static year(year: number): DateRange {
    return new DateRange(
      TOKEN,
      NepaliDate.of(year, 1, 1),
      NepaliDate.of(year, 12, 1).lastOfMonth(),
    );
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

  /** Every day from `start` to `end`, in order. */
  *[Symbol.iterator](): IterableIterator<NepaliDate> {
    // Every serial between two valid dates is valid, so no step is checked again.
    const last = serialOf(this.end);
    for (let serial = serialOf(this.start); serial <= last; serial++) yield fromSerial(serial);
  }
}
