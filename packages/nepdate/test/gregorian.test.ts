import { describe, expect, test } from "vitest";
import { NepaliDate, NepDateError } from "../src/index.js";

function kindOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof NepDateError) return error.kind;
    throw error;
  }
  return undefined;
}

describe("BS <-> AD (T1-04)", () => {
  test("MIN and MAX map to AD 1844-04-11 and 2143-04-15", () => {
    expect(NepaliDate.MIN.toGregorian()).toEqual({ year: 1844, month: 4, day: 11 });
    expect(NepaliDate.MAX.toGregorian()).toEqual({ year: 2143, month: 4, day: 15 });
  });

  test("ALGORITHM §9 reference values", () => {
    const cases: [number, number, number, number, number, number][] = [
      [1901, 1, 1, 1844, 4, 11],
      [2081, 1, 1, 2024, 4, 13],
      [2082, 1, 1, 2025, 4, 14],
      [2083, 1, 1, 2026, 4, 14],
      [2199, 12, 30, 2143, 4, 15],
    ];
    for (const [y, m, d, ay, am, ad] of cases) {
      const bs = NepaliDate.of(y, m, d);
      expect(bs.toGregorian()).toEqual({ year: ay, month: am, day: ad });
      expect(NepaliDate.fromGregorian({ year: ay, month: am, day: ad }).equals(bs)).toBe(true);
    }
  });

  test.each([
    [{ year: 2023, month: 2, day: 29 }, "invalid-gregorian"],
    [{ year: 2024, month: 13, day: 1 }, "invalid-gregorian"],
    [{ year: 2024, month: 4, day: 31 }, "invalid-gregorian"],
    [{ year: 1900, month: 2, day: 29 }, "invalid-gregorian"],
    [{ year: 1844, month: 4, day: 10 }, "out-of-range"],
    [{ year: 2143, month: 4, day: 16 }, "out-of-range"],
    [{ year: -5, month: 1, day: 1 }, "out-of-range"],
    [{ year: 9_000_000_000, month: 1, day: 1 }, "out-of-range"],
    [{ year: 2024, month: 1, day: 1.5 }, "not-an-integer"],
  ])("fromGregorian(%j) throws %s", (date, kind) => {
    expect(kindOf(() => NepaliDate.fromGregorian(date))).toBe(kind);
  });

  test("2000-02-29 is a Gregorian date (leap century)", () => {
    expect(NepaliDate.fromGregorian({ year: 2000, month: 2, day: 29 }).toGregorian()).toEqual({
      year: 2000,
      month: 2,
      day: 29,
    });
  });

  test("accepts any object with year, month and day", () => {
    const plainDateLike = { year: 2024, month: 7, day: 30, calendarId: "iso8601" };
    const d = NepaliDate.fromGregorian(plainDateLike);
    expect([d.year, d.month, d.day]).toEqual([2081, 4, 15]);
  });
});
