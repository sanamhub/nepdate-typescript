import { describe, expect, test } from "vitest";
import { DateRange, NepaliDate } from "../src/index.js";
import { base64Value } from "../src/tables.js";

const date = (year: number, month: number, day: number): NepaliDate =>
  NepaliDate.of(year, month, day);
const range = (start: NepaliDate, end: NepaliDate): DateRange => DateRange.of(start, end);

describe("range and date edges after the 0.2 API", () => {
  test("the current year ranges read Nepal time when no zone is given", () => {
    const today = NepaliDate.today();
    expect(DateRange.currentCalendarYear().contains(today)).toBe(true);
    expect(DateRange.currentFiscalYear().contains(today)).toBe(true);
  });

  test("fromDayCount rejects a day count below one", () => {
    expect(() => DateRange.fromDayCount(date(2081, 4, 15), 0)).toThrow("below 1");
  });

  test("containsRange needs both bounds inside", () => {
    const inner = range(date(2081, 4, 6), date(2081, 4, 8));
    expect(range(date(2081, 4, 5), date(2081, 4, 10)).containsRange(inner)).toBe(true);
    expect(range(date(2081, 4, 7), date(2081, 4, 10)).containsRange(inner)).toBe(false);
  });

  test("overlaps counts a shared day at either edge", () => {
    const base = range(date(2081, 4, 5), date(2081, 4, 10));
    expect(base.overlaps(range(date(2081, 4, 10), date(2081, 4, 15)))).toBe(true);
    expect(base.overlaps(range(date(2081, 4, 1), date(2081, 4, 5)))).toBe(true);
    expect(base.overlaps(range(date(2081, 4, 1), date(2081, 4, 4)))).toBe(false);
  });

  test("a single shared day intersects as that day", () => {
    const left = range(date(2081, 4, 5), date(2081, 4, 10));
    const right = range(date(2081, 4, 10), date(2081, 4, 15));
    expect(left.intersect(right)?.start.toJSON()).toBe("2081-04-10");
    expect(left.intersect(right)?.end.toJSON()).toBe("2081-04-10");
  });

  test("except leaves the range alone when the removal is outside it", () => {
    const base = range(date(2081, 4, 5), date(2081, 4, 10));
    expect(base.except(range(date(2081, 3, 1), date(2081, 3, 20)))).toEqual([base]);
  });

  test("except removes a single day at either edge", () => {
    const base = range(date(2081, 4, 5), date(2081, 4, 10));
    const head = base.except(DateRange.single(date(2081, 4, 5)));
    expect(head.map((piece) => [piece.start.toJSON(), piece.end.toJSON()])).toEqual([
      ["2081-04-06", "2081-04-10"],
    ]);
    const tail = base.except(DateRange.single(date(2081, 4, 10)));
    expect(tail.map((piece) => [piece.start.toJSON(), piece.end.toJSON()])).toEqual([
      ["2081-04-05", "2081-04-09"],
    ]);
  });

  test("a one-day range splits into one piece per split", () => {
    const one = DateRange.single(date(2081, 4, 15));
    expect(one.splitByMonth()).toHaveLength(1);
    expect(one.splitByFiscalQuarter()).toHaveLength(1);
  });

  test("equals compares both bounds", () => {
    const base = range(date(2081, 4, 5), date(2081, 4, 10));
    expect(base.equals(range(date(2081, 4, 4), date(2081, 4, 10)))).toBe(false);
  });

  test("tryParse lets a non-parse error through", () => {
    const broken = {
      length: 1,
      charCodeAt: () => {
        throw new TypeError("boom");
      },
    };
    expect(() => NepaliDate.tryParse(broken as unknown as string)).toThrow(TypeError);
  });

  test("base64Value reads the padding code as 63", () => {
    expect(base64Value(61)).toBe(63);
  });
});
