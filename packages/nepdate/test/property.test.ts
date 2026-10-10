import fc from "fast-check";
import { expect, test } from "vitest";
import { NepaliDate } from "../src/index.js";

const DAY_MS = 86_400_000;
const FIRST = Date.UTC(1844, 3, 11) / DAY_MS;
const LAST = Date.UTC(2143, 3, 15) / DAY_MS;

// Any Gregorian date in the supported range, built from a day count so every value is real.
const gregorian = fc.integer({ min: FIRST, max: LAST }).map((days) => {
  const d = new Date(days * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
});

test("fromGregorian(g).toGregorian() equals g, and weekday matches Date", () => {
  fc.assert(
    fc.property(gregorian, (g) => {
      const bs = NepaliDate.fromGregorian(g);
      expect(bs.toGregorian()).toEqual(g);
      expect(bs.weekday).toBe(new Date(Date.UTC(g.year, g.month - 1, g.day)).getUTCDay());
    }),
    { seed: 20261010, numRuns: 10_000 },
  );
});
