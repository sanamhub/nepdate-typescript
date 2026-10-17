import { afterEach, expect, test, vi } from "vitest";
import { NepaliDate, NepDateError } from "../src/index.js";

const of = NepaliDate.of;

afterEach(() => {
  vi.useRealTimers();
});

test("fromJSDate with utc reads the UTC date", () => {
  const jsDate = new Date(Date.UTC(2024, 6, 30, 18, 30));
  expect(NepaliDate.fromJSDate(jsDate, "utc").toJSON()).toBe("2081-04-15");
  // The same instant is already 2081-04-16 in Nepal, but the "utc" zone must not use that.
  expect(NepaliDate.fromJSDate(jsDate, "utc").toJSON()).not.toBe("2081-04-16");
});

test("fromJSDate with local reads the local calendar fields", () => {
  const jsDate = new Date(Date.UTC(2024, 6, 30, 18, 30));
  const local = {
    year: jsDate.getFullYear(),
    month: jsDate.getMonth() + 1,
    day: jsDate.getDate(),
  };
  expect(NepaliDate.fromJSDate(jsDate, "local").toJSON()).toBe(
    NepaliDate.fromGregorian(local).toJSON(),
  );
});

test("today() defaults to Nepal time (UTC+05:45)", () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2024, 6, 30, 18, 30));
  expect(NepaliDate.today().toJSON()).toBe("2081-04-16");
  expect(NepaliDate.today("UTC").toJSON()).toBe("2081-04-15");
  expect(NepaliDate.today("Asia/Kathmandu").toJSON()).toBe("2081-04-16");
});

test("toJSDate('utc') is midnight UTC of the Gregorian date", () => {
  expect(of(2081, 4, 15).toJSDate("utc").getTime()).toBe(Date.UTC(2024, 6, 30));
  expect(of(2081, 4, 15).toJSDate("utc").toISOString()).toBe("2024-07-30T00:00:00.000Z");
});

test("fromJSDate and toJSDate round-trip in both zones", () => {
  const date = of(2081, 4, 15);
  expect(NepaliDate.fromJSDate(date.toJSDate("utc"), "utc").toJSON()).toBe("2081-04-15");
  expect(NepaliDate.fromJSDate(date.toJSDate("local"), "local").toJSON()).toBe("2081-04-15");
});

test("today() rejects a clock outside the supported range", () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(3000, 0, 1));
  let caught: unknown;
  try {
    NepaliDate.today();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(NepDateError);
  expect((caught as NepDateError).kind).toBe("out-of-range");

  vi.setSystemTime(Date.UTC(1000, 0, 1));
  expect(() => NepaliDate.today("UTC")).toThrow(NepDateError);
});

test("fromJSDate rejects an invalid Date", () => {
  let caught: unknown;
  try {
    NepaliDate.fromJSDate(new Date(Number.NaN), "utc");
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(NepDateError);
  expect((caught as NepDateError).kind).toBe("not-an-integer");
});
