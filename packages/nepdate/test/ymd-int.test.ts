import { describe, expect, test } from "vitest";
import { NepaliDate, NepDateError } from "../src/index.js";
import { bs, iso, kindOf } from "./helpers.js";
import { readVectors } from "./vectors.js";

function resultOf(fn: () => { year: number; month: number; day: number }): string {
  try {
    return iso(fn());
  } catch (error) {
    if (error instanceof NepDateError) return "ERR";
    throw error;
  }
}

describe("ymd-int.tsv", () => {
  const rows = readVectors("csharp-golden/ymd-int.tsv");

  test("14 rows", () => expect(rows).toHaveLength(14));

  test("date rows: toYmd writes the integer and fromYmd reads it back (NC09)", () => {
    for (const row of rows.filter((r) => r.kind === "date")) {
      const date = bs(row.input as string);
      expect(date.toYmd(), row.input).toBe(Number(row.ymd));
      expect(NepaliDate.fromYmd(Number(row.ymd)).toJSON(), row.ymd).toBe(row.result);
    }
  });

  test("int rows: an invalid integer is refused (NC09)", () => {
    for (const row of rows.filter((r) => r.kind === "int")) {
      expect(
        resultOf(() => NepaliDate.fromYmd(Number(row.ymd))),
        row.ymd,
      ).toBe(row.result);
    }
  });

  test("errors name the check that failed", () => {
    expect(kindOf(() => NepaliDate.fromYmd(20810433))).toBe("invalid-day");
    expect(kindOf(() => NepaliDate.fromYmd(20810400))).toBe("invalid-day");
    expect(kindOf(() => NepaliDate.fromYmd(20810015))).toBe("invalid-month");
    expect(kindOf(() => NepaliDate.fromYmd(0))).toBe("out-of-range");
    expect(kindOf(() => NepaliDate.fromYmd(-1))).toBe("out-of-range");
    expect(kindOf(() => NepaliDate.fromYmd(2081.5))).toBe("not-an-integer");
    expect(kindOf(() => NepaliDate.fromYmd(2081))).toBe("out-of-range");
  });

  test("the integer is not the interchange form; toJSON keeps the dashes", () => {
    const date = NepaliDate.of(2081, 4, 15);
    expect(date.toYmd()).toBe(20810415);
    expect(date.toJSON()).toBe("2081-04-15");
  });
});
