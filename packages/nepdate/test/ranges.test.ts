import { describe, expect, test } from "vitest";
import {
  type DateOrder,
  DateRange,
  FiscalYear,
  type Lang,
  NepaliDate,
  NepDateError,
  type Separator,
} from "../src/index.js";
import { bs, kindOf } from "./helpers.js";
import { readVectors } from "./vectors.js";

const ORDER: Record<string, DateOrder> = {
  Ymd: "ymd",
  Ydm: "ydm",
  Myd: "myd",
  Mdy: "mdy",
  Dym: "dym",
  Dmy: "dmy",
};

const SEPARATOR: Record<string, Separator> = {
  Slash: "/",
  Backslash: "\\",
  Dot: ".",
  Underscore: "_",
  Dash: "-",
  Space: " ",
};

// A typo in the table must fail the run, not quietly produce a default.
function orderOf(text: string): DateOrder {
  const order = ORDER[text];
  if (order === undefined) throw new Error(`unknown order ${text}`);
  return order;
}

function separatorOf(text: string): Separator {
  const separator = SEPARATOR[text];
  if (separator === undefined) throw new Error(`unknown separator ${text}`);
  return separator;
}

/** A range cell is `start..end`; `none` is a null result and `ERR` a refused call. */
function range(cell: string): DateRange {
  const [start, end] = cell.split("..");
  return DateRange.of(bs(start as string), bs(end as string));
}

/** Renders a result the way the range vectors write it. */
function text(value: unknown): string {
  if (value === null) return "none";
  if (Array.isArray(value)) {
    return value.length === 0 ? "none" : value.map((item) => text(item)).join(";");
  }
  if (value instanceof DateRange) return `${value.start.toJSON()}..${value.end.toJSON()}`;
  if (value instanceof NepaliDate) return value.toJSON();
  return String(value);
}

/** The vector cell of `fn`: its rendering, or `ERR` for any refusal. */
function cellOf(fn: () => unknown): string {
  try {
    return text(fn());
  } catch (error) {
    if (error instanceof NepDateError) return "ERR";
    throw error;
  }
}

/** `a,b` split without trimming, so a bad cell stays bad. */
function pair(cell: string): [string, string] {
  const [first, second] = cell.split(",");
  return [first as string, second as string];
}

describe("ranges.tsv", () => {
  const rows = readVectors("csharp-golden/ranges.tsv");

  test("54 rows", () => expect(rows).toHaveLength(54));

  test("every row: construction, length, containment, set operations and both strings", () => {
    for (const row of rows) {
      const start = row.start as string;
      const end = row.end as string;
      const argument = row.argument as string;
      const operation = row.operation as string;
      const actual = cellOf(() => {
        const subject = range(`${start}..${end}`);
        switch (operation) {
          case "construct":
            return subject;
          case "length":
            return subject.length;
          case "contains_date":
            return subject.contains(bs(argument));
          case "contains_range":
            return subject.containsRange(range(argument));
          case "overlaps":
            return subject.overlaps(range(argument));
          case "is_adjacent_to":
            return subject.isAdjacentTo(range(argument));
          case "intersect":
            return subject.intersect(range(argument));
          case "union":
            return subject.union(range(argument));
          case "except":
            return subject.except(range(argument));
          case "equals":
            return subject.equals(range(argument));
          case "to_string":
            return subject.toString();
          case "enumerate":
            return [...subject];
          default:
            throw new Error(`unknown operation ${operation}`);
        }
      });
      expect(actual, `${start}..${end} ${operation} ${argument}`).toBe(row.result);
    }
  });

  test("an empty result is an empty list, never a throw (D-01, D-16)", () => {
    const range2081 = DateRange.of(NepaliDate.of(2081, 4, 10), NepaliDate.of(2081, 4, 20));
    const whole = DateRange.of(NepaliDate.of(2081, 4, 1), NepaliDate.of(2081, 4, 30));
    expect(range2081.except(whole)).toEqual([]);
    expect(range2081.intersect(DateRange.month(2081, 5))).toBeNull();
  });

  test("equals returns false for a foreign value (O-15)", () => {
    const range2081 = DateRange.month(2081, 4);
    expect(
      range2081.equals({ start: range2081.start, end: range2081.end } as unknown as DateRange),
    ).toBe(false);
    expect(range2081.equals("2081-04-01..2081-04-32" as unknown as DateRange)).toBe(false);
  });
});

describe("range-factories.tsv", () => {
  const rows = readVectors("csharp-golden/range-factories.tsv");

  test("27 rows", () => expect(rows).toHaveLength(27));

  test("every row: single, day count, month, year, fiscal year and construction", () => {
    for (const row of rows) {
      const factory = row.factory as string;
      const argument = row.argument as string;
      const actual = cellOf(() => {
        switch (factory) {
          case "single_day":
            return DateRange.single(bs(argument));
          case "from_day_count": {
            const [start, days] = pair(argument);
            return DateRange.fromDayCount(bs(start), Number(days));
          }
          case "for_month": {
            const [year, month] = pair(argument);
            return DateRange.month(Number(year), Number(month));
          }
          case "for_calendar_year":
            return DateRange.year(Number(argument));
          case "for_fiscal_year":
            return new FiscalYear(Number(argument)).range();
          case "construct": {
            const [start, end] = pair(argument);
            return DateRange.of(bs(start), bs(end));
          }
          default:
            throw new Error(`unknown factory ${factory}`);
        }
      });
      expect(actual, `${factory} ${argument}`).toBe(row.result);
    }
  });

  test("fromDayCount refuses a non-integer count separately from a zero count", () => {
    const start = NepaliDate.of(2081, 4, 15);
    expect(kindOf(() => DateRange.fromDayCount(start, 0))).toBe("out-of-range");
    expect(kindOf(() => DateRange.fromDayCount(start, 1.5))).toBe("not-an-integer");
  });

  test("single is the same object shape as of(date, date)", () => {
    const date = NepaliDate.of(2081, 4, 15);
    expect(DateRange.single(date).equals(DateRange.of(date, date))).toBe(true);
  });
});

describe("range-splits.tsv", () => {
  const rows = readVectors("csharp-golden/range-splits.tsv");

  test("9 rows", () => expect(rows).toHaveLength(9));

  test("every row: month and fiscal-quarter pieces, including the data end (D-16)", () => {
    for (const row of rows) {
      const operation = row.operation as string;
      const actual = cellOf(() => {
        const subject = range(`${row.start}..${row.end}`);
        if (operation === "split_by_month") return subject.splitByMonth();
        if (operation === "split_by_fiscal_quarter") return subject.splitByFiscalQuarter();
        throw new Error(`unknown operation ${operation}`);
      });
      expect(actual, `${row.start}..${row.end} ${operation}`).toBe(row.result);
    }
  });

  test("the piece count of a full year's split is 12 months", () => {
    expect(DateRange.year(2081).splitByMonth()).toHaveLength(12);
    expect(DateRange.year(2081).splitByFiscalQuarter()).toHaveLength(4);
  });
});

describe("range-days.tsv", () => {
  const rows = readVectors("csharp-golden/range-days.tsv");

  test("18 rows", () => expect(rows).toHaveLength(18));

  test("every row: interval, working and weekend days, and iteration (D-16)", () => {
    for (const row of rows) {
      const operation = row.operation as string;
      const argument = row.argument as string;
      const actual = cellOf(() => {
        const subject = range(`${row.start}..${row.end}`);
        switch (operation) {
          case "dates_with_interval":
            return [...subject.datesWithInterval(Number(argument))];
          case "working_days":
            return [...subject.workingDays({ excludeSunday: argument === "true" })];
          case "weekend_days":
            return [...subject.weekendDays({ includeSunday: argument === "true" })];
          case "enumerate":
            return [...subject];
          default:
            throw new Error(`unknown operation ${operation}`);
        }
      });
      expect(actual, `${row.start}..${row.end} ${operation} ${argument}`).toBe(row.result);
    }
  });

  test("an interval is checked at the call, not on the first step", () => {
    const range2081 = DateRange.month(2081, 4);
    expect(kindOf(() => range2081.datesWithInterval(0))).toBe("out-of-range");
    expect(kindOf(() => range2081.datesWithInterval(-1))).toBe("out-of-range");
    expect(kindOf(() => range2081.datesWithInterval(1.5))).toBe("not-an-integer");
  });

  test("the defaults are working days without Sunday and weekend days with Sunday", () => {
    const week = DateRange.fromDayCount(NepaliDate.of(2081, 4, 13), 9);
    expect([...week.workingDays()].map((date) => date.toJSON())).toEqual(
      [...week.workingDays({ excludeSunday: false })].map((date) => date.toJSON()),
    );
    expect([...week.weekendDays()].map((date) => date.toJSON())).toEqual(
      [...week.weekendDays({ includeSunday: true })].map((date) => date.toJSON()),
    );
  });
});

describe("range-format.tsv", () => {
  const rows = readVectors("csharp-golden/range-format.tsv");

  test("18 rows", () => expect(rows).toHaveLength(18));

  test("every row: the default and the formatted string (NR28, NR29, D-15)", () => {
    for (const row of rows) {
      const actual = cellOf(() => {
        const subject = range(`${row.start}..${row.end}`);
        if (row.kind === "default") return subject.toString();
        return subject.toString({
          order: orderOf(row.order as string),
          separator: separatorOf(row.separator as string),
          lang: row.lang as Lang,
        });
      });
      expect(actual, `${row.start}..${row.end} ${row.kind}`).toBe(row.result);
    }
  });

  test("String(range) is the default form", () => {
    const subject = DateRange.month(2081, 4);
    expect(String(subject)).toBe(`2081/04/01 - 2081/04/32`);
    expect(`${subject}`).toBe("2081/04/01 - 2081/04/32");
  });
});
