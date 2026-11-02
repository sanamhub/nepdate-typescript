// Documented support ranges of the packages in docs/competitors.md. "Agrees" in the benchmark means
// agreement on the dates inside these ranges only. A README line or a code line is cited for every
// range. When a package documents only its BS range, the AD range is the Gregorian equivalent of the
// BS endpoints computed from shared/data, and `basis` is "derived"; that is a fact about the data,
// not a claim by the package.

export interface Day {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface Range {
  readonly from: Day;
  readonly to: Day;
  readonly basis: "documented" | "derived";
  readonly source: string;
}

export interface CompetitorRange {
  readonly id: string;
  readonly bs: Range;
  readonly ad: Range;
}

const day = (year: number, month: number, dayOfMonth: number): Day => ({
  year,
  month,
  day: dayOfMonth,
});

export function compareDay(a: Day, b: Day): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function inRange(date: Day, range: Range): boolean {
  return compareDay(date, range.from) >= 0 && compareDay(date, range.to) <= 0;
}

export function isoDay(date: Day): string {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(
    date.day,
  ).padStart(2, "0")}`;
}

export const COMPETITOR_RANGES: readonly CompetitorRange[] = [
  {
    id: "nepali-date-converter@3.4.0",
    bs: {
      from: day(2000, 1, 1),
      to: day(2090, 12, 30),
      basis: "documented",
      source: 'dist/lib/nepali-date-helper.js:189 ("2000/01/01 - 2090/12/30")',
    },
    ad: {
      from: day(1943, 4, 14),
      to: day(2034, 4, 13),
      basis: "derived",
      source: "BS 2000-01-01 to 2090-12-30 converted through shared/data",
    },
  },
  {
    id: "bikram-sambat@1.8.1",
    bs: {
      from: day(1970, 1, 1),
      to: day(2090, 12, 30),
      basis: "documented",
      source:
        "src/index.js:6-18 (BS_YEAR_ZERO 1970 and ENCODED_MONTH_LENGTHS, 121 years, 1970..2090)",
    },
    ad: {
      from: day(1913, 4, 13),
      to: day(2034, 4, 13),
      basis: "derived",
      source: "src/index.js:6 (epoch 1913-4-13); end derived from the BS table",
    },
  },
  {
    id: "world-calendars@1.0.4",
    bs: {
      from: day(1970, 1, 1),
      to: day(2100, 12, 30),
      basis: "documented",
      source:
        "dist/calendars/nepali.js:283,415 (table years 1970..2100); :45 is the fallback month pattern",
    },
    ad: {
      from: day(1913, 4, 13),
      to: day(2044, 4, 12),
      basis: "derived",
      source: "BS 1970-01-01 to 2100-12-30 converted through shared/data",
    },
  },
];
