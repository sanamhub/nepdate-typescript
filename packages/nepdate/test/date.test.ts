import { describe, expect, test, vi } from "vitest";
import { type ErrorKind, NepaliDate, NepDateError } from "../src/index.js";

function kindOf(fn: () => unknown): ErrorKind | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof NepDateError) return error.kind;
    throw error;
  }
  return undefined;
}

describe("NepDateError", () => {
  test("is an Error named NepDateError with a kind, not a RangeError", () => {
    let caught: unknown;
    try {
      NepaliDate.of(2081, 4, 33);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(NepDateError);
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RangeError);
    expect((caught as NepDateError).name).toBe("NepDateError");
    expect((caught as NepDateError).kind).toBe("invalid-day");
    expect((caught as NepDateError).message).not.toBe("");
  });
});

describe("NepaliDate.of", () => {
  test("accepts 2081-04-32", () => {
    const d = NepaliDate.of(2081, 4, 32);
    expect([d.year, d.month, d.day]).toEqual([2081, 4, 32]);
  });

  test.each([
    [[2081, 4, 33], "invalid-day"],
    [[2081, 4, 0], "invalid-day"],
    [[2081.5, 1, 1], "not-an-integer"],
    [[2081, 1.5, 1], "not-an-integer"],
    [[2081, 1, Number.NaN], "not-an-integer"],
    [[2081, 1, 2 ** 53], "not-an-integer"],
    [[1900, 13, 40], "out-of-range"],
    [[2200, 1, 1], "out-of-range"],
    [[2 ** 40, 1, 1], "out-of-range"],
    [[2081, 2 ** 40, 1], "invalid-month"],
    [[-0, 1, 1], "out-of-range"],
    [[2081, 13, 1], "invalid-month"],
    [[2081, 0, 40], "invalid-month"],
  ] as const)("of(%j) throws %s", (args, kind) => {
    expect(kindOf(() => NepaliDate.of(args[0], args[1], args[2]))).toBe(kind);
  });

  test("the constructor can't be called from JavaScript", () => {
    const Ctor = NepaliDate as unknown as new (...args: unknown[]) => unknown;
    expect(() => new Ctor(2081, 1, 1)).toThrow(TypeError);
    expect(() => new Ctor(Symbol(), 2081, 1, 1, 0)).toThrow(TypeError);
  });

  test("year, month and day are getters over the packed serial, so a caller cannot change them", () => {
    const d = NepaliDate.of(2081, 4, 15);
    // No own enumerable data properties are left for a JavaScript caller to assign to.
    expect(Object.keys(d)).toEqual([]);
    const writable = d as unknown as Record<string, number>;
    expect(() => {
      writable.year = 2000;
    }).toThrow(TypeError);
    expect(() => {
      writable.month = 1;
    }).toThrow(TypeError);
    expect(() => {
      writable.day = 1;
    }).toThrow(TypeError);
    expect([d.year, d.month, d.day]).toEqual([2081, 4, 15]);
    expect(d.toJSON()).toBe("2081-04-15");
    // Destructuring still reads the three fields.
    const { year, month, day } = d;
    expect([year, month, day]).toEqual([2081, 4, 15]);
  });

  test("weekday, dayOfYear and monthLength", () => {
    const d = NepaliDate.of(2081, 1, 1);
    expect(d.weekday).toBe(6); // Saturday, ALGORITHM §9
    expect(d.dayOfYear).toBe(1);
    expect(d.monthLength).toBe(31);
    expect(NepaliDate.of(1901, 1, 1).weekday).toBe(4);
    expect(NepaliDate.of(2081, 4, 1).monthLength).toBe(32);
    expect(NepaliDate.of(2081, 12, 31).dayOfYear).toBe(366);
  });

  test("yearLength is the sum of the twelve month lengths (D-12)", () => {
    expect(NepaliDate.of(2081, 1, 1).yearLength).toBe(366);
    expect(NepaliDate.of(1901, 1, 1).yearLength).toBe(365);
    expect(NepaliDate.MAX.yearLength).toBe(365);
    // Every month of the year agrees on the year it belongs to.
    for (let month = 1; month <= 12; month++) {
      expect(NepaliDate.of(2081, month, 1).yearLength).toBe(366);
    }
  });

  test("isToday, isYesterday and isTomorrow read the clock in the given zone (O-03)", () => {
    vi.useFakeTimers();
    try {
      // 2024-07-30T18:30Z is already 2081-04-16 in Nepal and still 2081-04-15 in UTC.
      vi.setSystemTime(Date.UTC(2024, 6, 30, 18, 30));
      const todayInNepal = NepaliDate.of(2081, 4, 16);
      const todayInUtc = NepaliDate.of(2081, 4, 15);
      expect(todayInNepal.isToday("Asia/Kathmandu")).toBe(true);
      expect(todayInUtc.isToday("Asia/Kathmandu")).toBe(false);
      expect(todayInUtc.isToday("UTC")).toBe(true);
      expect(todayInNepal.isYesterday("Asia/Kathmandu")).toBe(false);
      expect(todayInNepal.addDays(-1).isYesterday("Asia/Kathmandu")).toBe(true);
      expect(todayInNepal.isTomorrow("Asia/Kathmandu")).toBe(false);
      expect(todayInNepal.addDays(1).isTomorrow("Asia/Kathmandu")).toBe(true);
      expect(todayInNepal.addDays(2).isTomorrow("Asia/Kathmandu")).toBe(false);
      // UTC is still on the previous BS day at this instant.
      expect(todayInUtc.isYesterday("Asia/Kathmandu")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test("an unknown time zone is a NepDateError of kind invalid-zone", () => {
    expect(kindOf(() => NepaliDate.today("Mars/Olympus"))).toBe("invalid-zone");
    expect(kindOf(() => NepaliDate.of(2081, 4, 15).isToday("not a zone"))).toBe("invalid-zone");
  });

  test("firstOfMonth and lastOfMonth", () => {
    const d = NepaliDate.of(2081, 4, 15);
    expect(d.firstOfMonth().equals(NepaliDate.of(2081, 4, 1))).toBe(true);
    expect(d.lastOfMonth().equals(NepaliDate.of(2081, 4, 32))).toBe(true);
    expect(NepaliDate.MAX.lastOfMonth().equals(NepaliDate.MAX)).toBe(true);
  });

  test("MIN and MAX", () => {
    const { MIN, MAX } = NepaliDate;
    expect([MIN.year, MIN.month, MIN.day]).toEqual([1901, 1, 1]);
    expect([MAX.year, MAX.month, MAX.day]).toEqual([2199, 12, 30]);
  });

  test("compare and equals", () => {
    const a = NepaliDate.of(2080, 12, 30);
    const b = NepaliDate.of(2081, 1, 1);
    expect(NepaliDate.compare(a, b)).toBe(-1);
    expect(NepaliDate.compare(b, a)).toBe(1);
    expect(NepaliDate.compare(b, NepaliDate.of(2081, 1, 1))).toBe(0);
    expect(a.equals(b)).toBe(false);
    expect(b.equals(NepaliDate.of(2081, 1, 1))).toBe(true);
    const sorted = [b, NepaliDate.MAX, a, NepaliDate.MIN].sort(NepaliDate.compare);
    expect(sorted.map((d) => d.toJSON())).toEqual([
      NepaliDate.MIN.toJSON(),
      a.toJSON(),
      b.toJSON(),
      NepaliDate.MAX.toJSON(),
    ]);
  });

  test("equals returns false for a foreign value (O-15)", () => {
    const d = NepaliDate.of(2081, 4, 15);
    expect(d.equals({ year: 2081, month: 4, day: 15 } as unknown as NepaliDate)).toBe(false);
    expect(d.equals("2081-04-15" as unknown as NepaliDate)).toBe(false);
    expect(d.equals(null as unknown as NepaliDate)).toBe(false);
    expect(d.equals(undefined as unknown as NepaliDate)).toBe(false);
    expect(d.equals(NepaliDate.of(2081, 4, 15))).toBe(true);
  });

  test("tryParseLenient is the non-throwing lenient parse (NP08)", () => {
    expect(NepaliDate.tryParseLenient("15 Jestha 2081")?.toJSON()).toBe("2081-02-15");
    expect(NepaliDate.tryParseLenient("2081-04-15")?.toJSON()).toBe("2081-04-15");
    expect(NepaliDate.tryParseLenient("not a date")).toBeNull();
    expect(NepaliDate.tryParseLenient("2081-13-01")).toBeNull();
  });

  test("fromJSON reads the string hook's text (NC10)", () => {
    expect(NepaliDate.fromJSON('"2081-04-15"').toJSON()).toBe("2081-04-15");
    expect(kindOf(() => NepaliDate.fromJSON("null"))).toBe("unrecognized");
    expect(kindOf(() => NepaliDate.fromJSON("2081-04-15"))).toBe("unrecognized");
    expect(kindOf(() => NepaliDate.fromJSON('"2081-13-01"'))).toBe("invalid-month");
  });
});
