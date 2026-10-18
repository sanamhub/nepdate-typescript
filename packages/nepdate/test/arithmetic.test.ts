import { describe, expect, test } from "vitest";
import { NepaliDate } from "../src/index.js";
import { bs, kindOf, outcome } from "./helpers.js";
import { readVectors } from "./vectors.js";

describe("addDays and daysUntil (T2-01)", () => {
  const rows = readVectors("csharp-golden/add-days.tsv");

  test("add-days.tsv: all 9162 rows", () => {
    expect(rows).toHaveLength(9162);
    for (const row of rows) {
      const date = bs(row.bs as string);
      const n = Number(row.days);
      expect(
        outcome(() => date.addDays(n)),
        `${row.bs} + ${n}`,
      ).toBe(row.result);
      if (row.result !== "ERR") expect(date.daysUntil(bs(row.result as string))).toBe(n);
    }
  });

  test("the ends of the range", () => {
    expect(kindOf(() => NepaliDate.MAX.addDays(1))).toBe("out-of-range");
    expect(kindOf(() => NepaliDate.MIN.addDays(-1))).toBe("out-of-range");
    expect(NepaliDate.MIN.addDays(109211).equals(NepaliDate.MAX)).toBe(true);
    expect(NepaliDate.MAX.addDays(-109211).equals(NepaliDate.MIN)).toBe(true);
    expect(kindOf(() => NepaliDate.MIN.addDays(2 ** 52))).toBe("out-of-range");
  });

  test("non-integers throw not-an-integer (D-03)", () => {
    const d = NepaliDate.of(2081, 4, 15);
    expect(kindOf(() => d.addDays(1.5))).toBe("not-an-integer");
    expect(kindOf(() => d.addDays(Number.NaN))).toBe("not-an-integer");
    expect(kindOf(() => d.addDays(2 ** 53))).toBe("not-an-integer");
  });

  test("daysUntil is other minus this (D-07)", () => {
    expect(NepaliDate.MIN.daysUntil(NepaliDate.MAX)).toBe(109211);
    expect(NepaliDate.MAX.daysUntil(NepaliDate.MIN)).toBe(-109211);
    expect(NepaliDate.of(2081, 1, 1).daysUntil(NepaliDate.of(2081, 1, 1))).toBe(0);
  });
});

describe("addMonths and addYears (T2-02)", () => {
  const rows = readVectors("csharp-golden/add-months.tsv");

  test("add-months.tsv: all 10180 rows, clamp and spill", () => {
    expect(rows).toHaveLength(10180);
    for (const row of rows) {
      const date = bs(row.bs as string);
      const n = Number(row.months);
      expect(
        outcome(() => date.addMonths(n)),
        `${row.bs} + ${n} default`,
      ).toBe(row.clamp);
      expect(
        outcome(() => date.addMonths(n, "clamp")),
        `${row.bs} + ${n} clamp`,
      ).toBe(row.clamp);
      expect(
        outcome(() => date.addMonths(n, "spill")),
        `${row.bs} + ${n} spill`,
      ).toBe(row.overflow);
    }
    // The year-rollover branch of spill: Chaitra 1914 has 31 days, Baisakh 1915 has 30.
    expect(NepaliDate.of(1914, 12, 31).addMonths(1, "spill").toJSON()).toBe("1915-02-01");
    // The serial must agree with the fields, not only the printed JSON.
    expect(
      NepaliDate.of(2081, 4, 32)
        .addMonths(8, "spill")
        .equals(NepaliDate.of(2082, 1, 1)),
    ).toBe(true);
  });

  test("ALGORITHM §8 examples", () => {
    const d = NepaliDate.of(2081, 4, 32);
    expect(d.addMonths(2).equals(NepaliDate.of(2081, 6, 30))).toBe(true);
    expect(d.addMonths(2, "spill").equals(NepaliDate.of(2081, 7, 2))).toBe(true);
    expect(d.addMonths(5, "clamp").equals(NepaliDate.of(2081, 9, 29))).toBe(true);
    expect(d.addMonths(5, "spill").equals(NepaliDate.of(2081, 10, 3))).toBe(true);
  });

  test("negative amounts", () => {
    const d = NepaliDate.of(2081, 4, 32);
    expect(d.addMonths(-1).equals(NepaliDate.of(2081, 3, 31))).toBe(true);
    expect(d.addMonths(-2).equals(NepaliDate.of(2081, 2, 32))).toBe(true);
    expect(d.addMonths(-3).equals(NepaliDate.of(2081, 1, 31))).toBe(true);
    expect(d.addMonths(-3, "spill").equals(NepaliDate.of(2081, 2, 1))).toBe(true);
    expect(d.addMonths(-12 * 180).equals(NepaliDate.of(1901, 4, 31))).toBe(true);
    expect(
      NepaliDate.of(2081, 1, 15)
        .addYears(-1)
        .equals(NepaliDate.of(2080, 1, 15)),
    ).toBe(true);
    expect(kindOf(() => NepaliDate.MIN.addMonths(-1))).toBe("out-of-range");
    expect(kindOf(() => NepaliDate.MIN.addYears(-1))).toBe("out-of-range");
  });

  test("addYears is addMonths(12 * n)", () => {
    const d = NepaliDate.of(2081, 4, 32);
    expect(d.addYears(1).equals(d.addMonths(12))).toBe(true);
    expect(d.addYears(3, "spill").equals(d.addMonths(36, "spill"))).toBe(true);
    expect(kindOf(() => NepaliDate.MAX.addYears(1))).toBe("out-of-range");
  });

  test("spill past the last month is out of range", () => {
    // 2199-05 has 32 days and 2199-12, the last month, has 30: the 2 extra days have nowhere to go.
    const d = NepaliDate.of(2199, 5, 32);
    expect(d.addMonths(7).equals(NepaliDate.MAX)).toBe(true);
    expect(kindOf(() => d.addMonths(7, "spill"))).toBe("out-of-range");
    expect(() => d.addMonths(7, "spill")).toThrow(
      "2199-5-32 + 7 months is outside BS 1901-01-01..2199-12-30",
    );
    expect(d.addMonths(6, "spill").equals(NepaliDate.of(2199, 12, 2))).toBe(true);
  });

  test("non-integers throw not-an-integer (D-02)", () => {
    const d = NepaliDate.of(2081, 4, 15);
    expect(kindOf(() => d.addMonths(0.5))).toBe("not-an-integer");
    expect(kindOf(() => d.addYears(1.5))).toBe("not-an-integer");
    expect(kindOf(() => d.addMonths(2 ** 60))).toBe("not-an-integer");
    expect(kindOf(() => d.addMonths(2 ** 50))).toBe("out-of-range");
    expect(kindOf(() => d.addYears(2 ** 50))).toBe("out-of-range");
  });
});
