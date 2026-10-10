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
