import { describe, expect, test } from "vitest";
import { FiscalYear, NepaliDate } from "../src/index.js";
import { bs, iso, kindOf, outcome } from "./helpers.js";
import { readVectors } from "./vectors.js";

describe("FiscalYear and quarter (T2-04)", () => {
  test("dates.tsv: fy_start, fy_end, quarter_start, quarter_end (1018 rows)", () => {
    const rows = readVectors("csharp-golden/dates.tsv");
    expect(rows).toHaveLength(1018);
    for (const row of rows) {
      const date = bs(row.bs as string);
      const fy = date.fiscalYear();
      expect(
        outcome(() => fy.start()),
        `${row.bs} fy_start`,
      ).toBe(row.fy_start);
      expect(
        outcome(() => fy.end()),
        `${row.bs} fy_end`,
      ).toBe(row.fy_end);
      expect(
        outcome(() => fy.quarterRange(date.quarter()).start),
        `${row.bs} q start`,
      ).toBe(row.quarter_start);
      expect(
        outcome(() => fy.quarterRange(date.quarter()).end),
        `${row.bs} q end`,
      ).toBe(row.quarter_end);
    }
  });

  test("labels", () => {
    expect(new FiscalYear(2082).label()).toBe("2082/83");
    expect(new FiscalYear(2082).label("ne")).toBe("२०८२/८३");
    expect(new FiscalYear(2099).label()).toBe("2099/00");
    expect(new FiscalYear(2099).label("ne")).toBe("२०९९/००");
    expect(new FiscalYear(2100).label()).toBe("2100/01");
  });

  test("containing, quarter and range", () => {
    expect(FiscalYear.containing(NepaliDate.of(2081, 4, 1)).startYear).toBe(2081);
    expect(FiscalYear.containing(NepaliDate.of(2081, 3, 31)).startYear).toBe(2080);
    const quarters = [4, 4, 4, 1, 1, 1, 2, 2, 2, 3, 3, 3];
    for (let m = 1; m <= 12; m++) expect(NepaliDate.of(2081, m, 1).quarter()).toBe(quarters[m - 1]);
    const r = new FiscalYear(2081).range();
    expect([iso(r.start), iso(r.end)]).toEqual([
      "2081-04-01",
      iso(NepaliDate.of(2082, 3, 1).lastOfMonth()),
    ]);
    expect(r.contains(NepaliDate.of(2082, 1, 1))).toBe(true);
  });

  test("errors", () => {
    expect(kindOf(() => new FiscalYear(2082.5))).toBe("not-an-integer");
    expect(kindOf(() => new FiscalYear(1900).start())).toBe("out-of-range");
    expect(kindOf(() => new FiscalYear(2199).end())).toBe("out-of-range");
    expect(kindOf(() => new FiscalYear(2199).range())).toBe("out-of-range");
    expect(kindOf(() => new FiscalYear(Number.MAX_SAFE_INTEGER).end())).toBe("out-of-range");
    expect(kindOf(() => new FiscalYear(1900).quarterRange(4))).toBeUndefined();
    for (const q of [0, 5, 1.5, Number.NaN]) {
      expect(kindOf(() => new FiscalYear(2081).quarterRange(q as 1))).toBe("out-of-range");
    }
  });
});
