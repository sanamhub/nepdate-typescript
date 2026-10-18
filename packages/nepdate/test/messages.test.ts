import { describe, expect, test } from "vitest";
import { DateRange, FiscalYear, NepaliDate, NepDateError } from "../src/index.js";

function messageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw error;
  }
  return "";
}

describe("error messages", () => {
  test.each([
    [() => NepaliDate.of(2081.5, 1, 1), "year must be a safe integer, got 2081.5"],
    [() => NepaliDate.of(2081, 1.5, 1), "month must be a safe integer, got 1.5"],
    [() => NepaliDate.of(2081, 1, Number.NaN), "day must be a safe integer, got NaN"],
    [() => NepaliDate.of(1900, 1, 1), "year 1900 is outside 1901..2199"],
    [() => NepaliDate.of(2081, 13, 1), "month 13 is outside 1..12"],
    [() => NepaliDate.of(2081, 4, 33), "day 33 is outside 1..32 for 2081-4"],
    [
      () => NepaliDate.fromGregorian({ year: 2024, month: 2, day: 30 }),
      "2024-2-30 is not a Gregorian date",
    ],
    [
      () => NepaliDate.fromGregorian({ year: 2024, month: 1, day: 0 }),
      "2024-1-0 is not a Gregorian date",
    ],
    [
      () => NepaliDate.fromGregorian({ year: 2024, month: 0, day: 1 }),
      "2024-0-1 is not a Gregorian date",
    ],
    [
      () => NepaliDate.fromGregorian({ year: 1843, month: 1, day: 1 }),
      "AD 1843-1-1 is outside 1844-04-11..2143-04-15",
    ],
  ])("NepaliDate throws %s", (fn, message) => {
    expect(messageOf(fn)).toBe(message);
  });

  test.each([
    [() => NepaliDate.MAX.addDays(1), "2199-12-30 + 1 days is outside BS 1901-01-01..2199-12-30"],
    [
      () => NepaliDate.MAX.addMonths(1),
      "2199-12-30 + 1 months is outside BS 1901-01-01..2199-12-30",
    ],
    [
      () => NepaliDate.MAX.addMonths(1, "spill"),
      "2199-12-30 + 1 months is outside BS 1901-01-01..2199-12-30",
    ],
    [() => NepaliDate.of(2081, 1, 1).addDays(1.5), "n must be a safe integer, got 1.5"],
    [() => NepaliDate.of(2081, 1, 1).addMonths(1.5), "n must be a safe integer, got 1.5"],
    [() => NepaliDate.of(2081, 1, 1).addYears(1.5), "n must be a safe integer, got 1.5"],
  ])("an operation throws %s", (fn, message) => {
    expect(messageOf(fn)).toBe(message);
  });

  test("the private constructor names its public factories", () => {
    const Ctor = NepaliDate as unknown as new (...args: unknown[]) => unknown;
    expect(messageOf(() => new Ctor(2081, 1, 1))).toBe(
      "use NepaliDate.of or NepaliDate.fromGregorian",
    );
  });

  test("FiscalYear names the start year and the quarter", () => {
    expect(messageOf(() => new FiscalYear(2082.5))).toBe(
      "startYear must be a safe integer, got 2082.5",
    );
    expect(messageOf(() => new FiscalYear(1900).start())).toBe("year 1900 is outside 1901..2199");
    expect(messageOf(() => new FiscalYear(2081).quarterRange(5 as 1))).toBe(
      "quarter 5 is outside 1..4",
    );
  });

  test("DateRange names the backwards range", () => {
    const a = NepaliDate.of(2080, 1, 5);
    const b = NepaliDate.of(2080, 1, 20);
    expect(messageOf(() => DateRange.of(b, a))).toBe("the range ends before it starts");
  });

  test("NepDateError keeps its kind and message", () => {
    try {
      NepaliDate.of(2081, 4, 33);
    } catch (error) {
      expect(error).toBeInstanceOf(NepDateError);
      expect((error as NepDateError).kind).toBe("invalid-day");
    }
  });
});
