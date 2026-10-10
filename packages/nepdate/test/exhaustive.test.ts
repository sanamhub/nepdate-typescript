import { expect, test } from "vitest";
import { fromSerial, MAX_SERIAL, serialOf } from "../src/date.js";
import { NepaliDate } from "../src/index.js";
import { MONTH_START } from "../src/tables.js";

// Plain binary search: the largest i with MONTH_START[i] <= serial.
function searchMonthIndex(serial: number): number {
  let lo = 0;
  let hi = MONTH_START.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((MONTH_START[mid] as number) <= serial) lo = mid;
    else hi = mid;
  }
  return lo;
}

test("every serial 0..=109211 round-trips BS -> Gregorian -> BS", () => {
  let count = 0;
  for (let serial = 0; serial <= MAX_SERIAL; serial++) {
    const date = fromSerial(serial);
    expect(serialOf(date)).toBe(serial);
    const i = searchMonthIndex(serial);
    if (date.year !== 1901 + Math.floor(i / 12) || date.month !== (i % 12) + 1) {
      throw new Error(`serial ${serial}: O(1) month ${date.year}-${date.month}, search ${i}`);
    }
    if (date.day !== serial - (MONTH_START[i] as number) + 1) {
      throw new Error(`serial ${serial}: day ${date.day}`);
    }
    const back = NepaliDate.fromGregorian(date.toGregorian());
    if (!back.equals(date) || serialOf(NepaliDate.of(date.year, date.month, date.day)) !== serial) {
      throw new Error(`serial ${serial} does not round-trip`);
    }
    count++;
  }
  console.log(`exhaustive: ${count} serials round-tripped`);
  expect(count).toBe(109212);
});
