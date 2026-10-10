import { describe, expect, test } from "vitest";
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

describe("NepDateError (T1-02)", () => {
  test("is a RangeError named NepDateError with a kind", () => {
    let caught: unknown;
    try {
      NepaliDate.of(2081, 4, 33);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(NepDateError);
    expect(caught).toBeInstanceOf(RangeError);
    expect((caught as NepDateError).name).toBe("NepDateError");
    expect((caught as NepDateError).kind).toBe("invalid-day");
    expect((caught as NepDateError).message).not.toBe("");
  });
});

describe("NepaliDate.of (T1-03)", () => {
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

  test("instances have exactly the fields year, month, day, in that order", () => {
    expect(Object.keys(NepaliDate.of(2081, 4, 15))).toEqual(["year", "month", "day"]);
    expect(Object.isFrozen(NepaliDate.of(2081, 4, 15))).toBe(false);
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
    expect(sorted).toEqual([NepaliDate.MIN, a, b, NepaliDate.MAX]);
  });
});
