import { describe, expect, test } from "vitest";
import { NepaliDate } from "../src/index.js";

describe("Gregorian month lengths", () => {
  test.each([4, 6, 9, 11])("month %i has 30 days", (month) => {
    expect(() => NepaliDate.fromGregorian({ year: 2024, month, day: 30 })).not.toThrow();
    expect(() => NepaliDate.fromGregorian({ year: 2024, month, day: 31 })).toThrow(
      /not a Gregorian date/,
    );
  });

  test("February has 29 days in 2024 and 28 in 2023", () => {
    expect(NepaliDate.fromGregorian({ year: 2024, month: 2, day: 29 }).toJSON()).toBe("2080-11-17");
    expect(() => NepaliDate.fromGregorian({ year: 2023, month: 2, day: 29 })).toThrow(
      /not a Gregorian date/,
    );
  });

  test("month zero and thirteen are rejected before the day check", () => {
    expect(() => NepaliDate.fromGregorian({ year: 2024, month: 0, day: 1 })).toThrow(
      /not a Gregorian date/,
    );
    expect(() => NepaliDate.fromGregorian({ year: 2024, month: 13, day: 1 })).toThrow(
      /not a Gregorian date/,
    );
  });
});

describe("date edges", () => {
  test("addMonths spill rolls into the next BS year", () => {
    // Chaitra 2080 ends on day 30; Baisakh 2081 has 31 days, so force a spill from a 32-day
    // month instead: Shrawan 2081 has 32 days, Bhadra has 31.
    const date = NepaliDate.of(2081, 4, 32);
    expect(date.addMonths(1, "spill").toJSON()).toBe("2081-06-01");
    expect(date.addMonths(1, "clamp").toJSON()).toBe("2081-05-31");
  });

  test("addMonths spill rolls from month 12 into the next BS year", () => {
    const date = NepaliDate.of(1914, 12, 31);
    expect(date.addMonths(1, "clamp").toJSON()).toBe("1915-01-30");
    expect(date.addMonths(1, "spill").toJSON()).toBe("1915-02-01");
  });

  test("fromJSDate reads the local fields and the UTC fields", () => {
    // On a UTC host the local and UTC days never differ, so the check would pass without testing
    // anything. Node applies a TZ change at runtime; Kathmandu (+05:45) puts 00:30 local on the
    // previous UTC day.
    const saved = process.env.TZ;
    process.env.TZ = "Asia/Kathmandu";
    try {
      const instant = new Date(2024, 4, 28, 0, 30);
      expect(instant.toISOString()).toBe("2024-05-27T18:45:00.000Z");
      expect(NepaliDate.fromJSDate(instant, "local").toJSON()).toBe(
        NepaliDate.fromGregorian({ year: 2024, month: 5, day: 28 }).toJSON(),
      );
      expect(NepaliDate.fromJSDate(instant, "utc").toJSON()).toBe(
        NepaliDate.fromGregorian({ year: 2024, month: 5, day: 27 }).toJSON(),
      );
    } finally {
      if (saved === undefined) delete process.env.TZ;
      else process.env.TZ = saved;
    }
  });

  test("tryParse returns null for a date error and rethrows a type error", () => {
    expect(NepaliDate.tryParse("not a date")).toBeNull();
    const bad = { length: 1 } as unknown as string;
    expect(() => NepaliDate.tryParse(bad)).toThrow(TypeError);
  });

  test("toNepaliDigits keeps the sign and pads negative values", () => {
    expect(NepaliDate.of(2081, 1, 1).toString()).toBe("2081/01/01");
    expect(NepaliDate.MIN.toString()).toBe("1901/01/01");
  });
});
