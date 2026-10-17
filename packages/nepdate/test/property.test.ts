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

// T2-06: arithmetic round-trips and the clamp bound. Two serials keep addDays(n) and its inverse
// inside the range, and addMonths draws n from the month index so the target month exists.
test("addDays(n) then addDays(-n) round-trips, and daysUntil agrees", () => {
  const serial = fc.integer({ min: 0, max: 109211 });
  fc.assert(
    fc.property(serial, serial, (a, b) => {
      const d = NepaliDate.MIN.addDays(a);
      const n = b - a;
      expect(d.addDays(n).addDays(-n).equals(d)).toBe(true);
      expect(d.daysUntil(d.addDays(n))).toBe(n);
    }),
    { seed: 20261012, numRuns: 10_000 },
  );
});

test("addMonths(n, clamp) never moves past the original day", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 109211 }).chain((s) => {
        const d = NepaliDate.MIN.addDays(s);
        const monthIndex = (d.year - 1901) * 12 + d.month - 1;
        return fc.tuple(fc.constant(d), fc.integer({ min: -monthIndex, max: 3587 - monthIndex }));
      }),
      ([d, n]) => {
        expect(d.addMonths(n, "clamp").day).toBeLessThanOrEqual(d.day);
      },
    ),
    { seed: 20261012, numRuns: 10_000 },
  );
});

// T3-06: the formatters and parsers round-trip every date.
test("parse(toString()), parse(short ne) and parseLenient(long()) round-trip", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 109211 }), (serial) => {
      const d = NepaliDate.MIN.addDays(serial);
      expect(NepaliDate.parse(d.toString()).equals(d)).toBe(true);
      expect(NepaliDate.parse(d.short({ lang: "ne" })).equals(d)).toBe(true);
      expect(NepaliDate.parseLenient(d.long()).equals(d)).toBe(true);
    }),
    { seed: 20261014, numRuns: 10_000 },
  );
});
