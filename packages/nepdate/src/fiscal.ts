import { MAX_YEAR, MIN_YEAR } from "./calendar.gen.js";
import { NepaliDate } from "./date.js";
import { toNepaliDigits } from "./digits.js";
import { NepDateError } from "./errors.js";
import type { Lang } from "./lang.js";
import { DateRange } from "./range.js";

/** A quarter of the fiscal year: Q1 is Shrawan to Ashoj, Q4 is Baishakh to Ashad. */
export type Quarter = 1 | 2 | 3 | 4;

/** Day 1 of BS month `year`-`month`, or "out-of-range" for a year outside 1901..2199. */
function first(year: number, month: number): NepaliDate {
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new NepDateError("out-of-range", `year ${year} is outside ${MIN_YEAR}..${MAX_YEAR}`);
  }
  return NepaliDate.of(year, month, 1);
}

/**
 * A Nepali fiscal year, 1 Shrawan to the end of Ashad of the next BS year (ALGORITHM §8b).
 * FY 2082/83 is `new FiscalYear(2082)`.
 */
export class FiscalYear {
  /** The BS year in which the fiscal year starts. */
  readonly startYear: number;

  /**
   * The fiscal year that starts on 1 Shrawan of `startYear`. Any integer is accepted; the methods
   * that return dates throw "out-of-range" when the date is outside BS 1901..2199.
   * @throws {NepDateError} `"not-an-integer"` if `startYear` is not a safe integer.
   */
  constructor(startYear: number) {
    if (!Number.isSafeInteger(startYear)) {
      throw new NepDateError(
        "not-an-integer",
        `startYear must be a safe integer, got ${startYear}`,
      );
    }
    this.startYear = startYear;
  }

  /** The fiscal year that contains `date`. */
  static containing(date: NepaliDate): FiscalYear {
    return new FiscalYear(date.month >= 4 ? date.year : date.year - 1);
  }

  /**
   * 1 Shrawan of `startYear`.
   * @throws {NepDateError} `"out-of-range"`.
   */
  start(): NepaliDate {
    return first(this.startYear, 4);
  }

  /**
   * The last day of Ashad of `startYear + 1`.
   * @throws {NepDateError} `"out-of-range"`.
   */
  end(): NepaliDate {
    return first(this.startYear + 1, 3).lastOfMonth();
  }

  /**
   * Every day of the fiscal year.
   * @throws {NepDateError} `"out-of-range"`.
   */
  range(): DateRange {
    return DateRange.of(this.start(), this.end());
  }

  /**
   * Every day of quarter `q`: Q1 Shrawan to Ashoj, Q2 Kartik to Poush, Q3 Magh to Chaitra, Q4
   * Baishakh to Ashad of the next BS year.
   * @throws {NepDateError} `"out-of-range"` if `q` is not 1..4 or the quarter is outside the range.
   */
  quarterRange(q: Quarter): DateRange {
    if (q !== 1 && q !== 2 && q !== 3 && q !== 4) {
      throw new NepDateError("out-of-range", `quarter ${q} is outside 1..4`);
    }
    const year = q === 4 ? this.startYear + 1 : this.startYear;
    const month = q === 4 ? 1 : q * 3 + 1;
    return DateRange.of(first(year, month), first(year, month + 2).lastOfMonth());
  }

  /** `"2082/83"`, or `"२०८२/८३"` with `lang` `"ne"`. */
  label(lang: Lang = "en"): string {
    const next = (((this.startYear + 1) % 100) + 100) % 100;
    if (lang === "ne") return `${toNepaliDigits(this.startYear)}/${toNepaliDigits(next, 2)}`;
    return `${this.startYear}/${next < 10 ? "0" : ""}${next}`;
  }
}
