import fc from "fast-check";
import { expect, test } from "vitest";
import { NepaliDate } from "../src/index.js";
import { lenientParts, strictParts } from "../src/parse.js";

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

// Arithmetic round-trips and the clamp bound. Two serials keep addDays(n) and its inverse
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

// The formatters and parsers round-trip every date.
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

// parseLenient tries strict parse first. Lenient parsing returns the same fields for
// every strict-valid input, so the strict attempt is a fast path only; docs/mutation/equivalent.md
// cites this property for the parseLenient try-block mutant.
test("lenientParts equals strictParts on every strict-valid input", () => {
  const DEVANAGARI_ZERO = 0x0966;
  const group = (value: number, width: number, devanagari: boolean): string => {
    const text = String(value).padStart(width, "0");
    if (!devanagari) return text;
    let out = "";
    for (const ch of text) out += String.fromCharCode(DEVANAGARI_ZERO + ch.charCodeAt(0) - 0x30);
    return out;
  };
  const separator = fc
    .array(fc.constantFrom("-", "/", ".", "_", "\\", " ", "|", "।"), { minLength: 1, maxLength: 3 })
    .map((parts) => parts.join(""));
  const edge = fc.option(separator, { nil: "" });
  const input = fc
    .record({
      year: fc.integer({ min: 1901, max: 2199 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 32 }),
      monthWidth: fc.integer({ min: 1, max: 4 }),
      dayWidth: fc.integer({ min: 1, max: 4 }),
      devanagari: fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }),
      separators: fc.array(separator, { minLength: 2, maxLength: 2 }),
      lead: edge,
      trail: edge,
    })
    .map(
      (r) =>
        r.lead +
        group(r.year, 4, r.devanagari[0] as boolean) +
        r.separators[0] +
        group(r.month, r.monthWidth, r.devanagari[1] as boolean) +
        r.separators[1] +
        group(r.day, r.dayWidth, r.devanagari[2] as boolean) +
        r.trail,
    );
  fc.assert(
    fc.property(input, (s) => {
      expect(lenientParts(s)).toEqual(strictParts(s));
    }),
    { seed: 20261018, numRuns: 10_000 },
  );
});
