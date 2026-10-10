import { describe, expect, test } from "vitest";
import { DateRange, NepaliDate } from "../src/index.js";
import { kindOf } from "./helpers.js";

describe("DateRange (T2-05)", () => {
  test("every year's length is the sum of its month lengths", () => {
    for (let y = 1901; y <= 2199; y++) {
      let sum = 0;
      for (let m = 1; m <= 12; m++) sum += NepaliDate.of(y, m, 1).monthLength;
      expect(DateRange.year(y).length).toBe(sum);
    }
  });

  test("month(2081, 4) has 32 days, in order", () => {
    const days = [...DateRange.month(2081, 4)];
    expect(days).toHaveLength(32);
    days.forEach((d, i) => {
      expect(d.equals(NepaliDate.of(2081, 4, i + 1))).toBe(true);
    });
  });

  test("month and year validate like NepaliDate.of", () => {
    expect(kindOf(() => DateRange.month(2081, 13))).toBe("invalid-month");
    expect(kindOf(() => DateRange.month(2200, 1))).toBe("out-of-range");
    expect(kindOf(() => DateRange.month(2081.5, 1))).toBe("not-an-integer");
    expect(kindOf(() => DateRange.year(1900))).toBe("out-of-range");
  });

  test("of: inclusive, end before start throws", () => {
    const a = NepaliDate.of(2080, 1, 5);
    const b = NepaliDate.of(2080, 1, 20);
    const r = DateRange.of(a, b);
    expect([r.start, r.end]).toEqual([a, b]);
    expect(r.length).toBe(16);
    expect(r.contains(a) && r.contains(b)).toBe(true);
    expect(r.contains(a.addDays(-1)) || r.contains(b.addDays(1))).toBe(false);
    expect(DateRange.of(a, a).length).toBe(1);
    expect([...DateRange.of(a, a)]).toEqual([a]);
    expect(kindOf(() => DateRange.of(b, a))).toBe("out-of-range");
  });

  test("the whole calendar is one range", () => {
    const all = DateRange.of(NepaliDate.MIN, NepaliDate.MAX);
    expect(all.length).toBe(109212);
    let count = 0;
    for (const _ of all) count++;
    expect(count).toBe(109212);
  });

  test("the constructor can't be called from JavaScript", () => {
    const Ctor = DateRange as unknown as new (...args: unknown[]) => unknown;
    expect(() => new Ctor(NepaliDate.MIN, NepaliDate.MAX)).toThrow(TypeError);
  });
});
