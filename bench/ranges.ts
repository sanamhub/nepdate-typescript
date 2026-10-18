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
    id: "bikram-sambat-js@1.0.3",
    bs: {
      from: day(1970, 1, 1),
      to: day(2100, 12, 30),
      basis: "documented",
      source: "dist/index.js:6-7 (minBSYear 1970, maxBSYear 2100)",
    },
    ad: {
      from: day(1913, 1, 1),
      to: day(2043, 12, 31),
      basis: "documented",
      source: "dist/index.js:598-601 (AD years are minBSYear - 57 to maxBSYear - 57)",
    },
  },
  {
    id: "@remotemerge/nepali-date-converter@1.2.1",
    bs: {
      from: day(1975, 1, 1),
      to: day(2099, 12, 30),
      basis: "documented",
      source: "README.md:12,21 (1975 BS to 2099 BS)",
    },
    ad: {
      from: day(1918, 4, 13),
      to: day(2043, 4, 13),
      basis: "documented",
      source: "README.md:21 (April 13, 1918 to April 13, 2043)",
    },
  },
  {
    id: "nepali-datetime@2.0.0",
    bs: {
      from: day(2000, 1, 1),
      to: day(2099, 12, 30),
      basis: "documented",
      source:
        "dist/shared/nepali-datetime.CRHMYMLW.mjs:1 (H = 2000 and the 100-year table N, 2000..2099)",
    },
    ad: {
      from: day(1943, 4, 14),
      to: day(2043, 4, 13),
      basis: "derived",
      source: "dist/shared/nepali-datetime.CRHMYMLW.mjs:1 (E = [1943, 4, 14]); end derived",
    },
  },
  {
    id: "@sbmdkl/nepali-date-converter@2.0.5",
    bs: {
      from: day(1978, 1, 1),
      to: day(2099, 12, 30),
      basis: "documented",
      source: "README.md:53 and dist/@sbmdkl/nepali-date-converter.es.js:136-137",
    },
    ad: {
      from: day(1921, 1, 1),
      to: day(2040, 12, 31),
      basis: "documented",
      source: "README.md:51 (1921 AD to 2040 AD, at year granularity)",
    },
  },
  {
    id: "nepali-date-library@1.1.16",
    bs: {
      from: day(1976, 1, 1),
      to: day(2100, 12, 30),
      basis: "documented",
      source: "dist/index.mjs:1 (NEPALI_DATE_MAP, first year 1976, last year 2100)",
    },
    ad: {
      from: day(1919, 4, 13),
      to: day(2044, 4, 12),
      basis: "derived",
      source: "BS 1976-01-01 to 2100-12-30 converted through shared/data",
    },
  },
  {
    id: "@inicrea/bikram-sambat-core@0.1.3",
    bs: {
      from: day(1975, 1, 1),
      to: day(2100, 12, 30),
      basis: "documented",
      source: "README.md:23-28 (BS 1975-01-01 to 2100-12-30)",
    },
    ad: {
      from: day(1918, 4, 13),
      to: day(2044, 4, 12),
      basis: "documented",
      source: "README.md:23-28 (AD 1918-04-13 to 2044-04-12)",
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
