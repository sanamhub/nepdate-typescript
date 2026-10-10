import fc from "fast-check";
import { expect, test } from "vitest";
import { NepaliDate } from "../src/index.js";
import { bs } from "./helpers.js";

// T2 plan table (from ALGORITHM §8a) plus the §8a examples.
test.each([
  ["2081-04-32", "2081-06-30", false, 0, 2, 0, 61],
  ["2081-04-32", "2082-04-01", false, 0, 11, 1, 335],
  ["2080-01-01", "2081-04-15", false, 1, 3, 14, 473],
  ["2081-04-15", "2080-01-01", true, 1, 3, 14, -473],
  ["2081-01-01", "2081-01-01", false, 0, 0, 0, 0],
  ["2081-04-32", "2081-05-31", false, 0, 1, 0, 31],
  ["2081-04-32", "2081-06-01", false, 0, 1, 1, 32],
  ["2081-01-31", "2081-02-30", false, 0, 0, 30, 30],
] as const)("%s diff %s", (a, b, negative, years, months, days, totalDays) => {
  expect(bs(a).diff(bs(b))).toEqual({ negative, years, months, days, totalDays });
});

test("totalDays and negative agree with daysUntil for 1000 seeded pairs", () => {
  const serial = fc.integer({ min: 0, max: 109211 });
  fc.assert(
    fc.property(serial, serial, (i, j) => {
      const a = NepaliDate.MIN.addDays(i);
      const b = NepaliDate.MIN.addDays(j);
      const d = a.diff(b);
      expect(d.totalDays).toBe(a.daysUntil(b));
      expect(d.negative).toBe(a.daysUntil(b) < 0);
      expect(d.days >= 0 && d.days < 33 && d.months >= 0 && d.months < 12).toBe(true);
      // Going back: the months part lands on or before the later date, the days part closes it.
      const [from, to] = d.negative ? [b, a] : [a, b];
      const mid = from.addMonths(d.years * 12 + d.months);
      expect(mid.daysUntil(to)).toBe(d.days);
    }),
    { seed: 20261011, numRuns: 1000 },
  );
});
