import { describe, expect, test } from "vitest";
import {
  monthName,
  monthShortName,
  toNepaliDigits,
  weekdayName,
  weekdayShortName,
} from "../src/index.js";

describe("names and digits", () => {
  test("toNepaliDigits maps by char-code offset", () => {
    expect(toNepaliDigits(2081)).toBe("२०८१");
    expect(toNepaliDigits(5, 2)).toBe("०५");
    expect(toNepaliDigits(0)).toBe("०");
    expect(toNepaliDigits(99, 2)).toBe("९९");
    expect(toNepaliDigits(2081, 6)).toBe("००२०८१");
  });

  test("month names, en and ne", () => {
    expect(monthName(1)).toBe("Baishakh");
    expect(monthName(12)).toBe("Chaitra");
    expect(monthName(3, "ne")).toBe("असार");
    expect(monthName(8, "ne")).toBe("मंसिर");
  });

  test("month short names (D-04)", () => {
    expect(monthShortName(3)).toBe("Asa");
    expect(monthShortName(6)).toBe("Aso");
    expect(monthShortName(1)).toBe("Bai");
    expect(monthShortName(4)).toBe("Shr");
    // Nepali has no customary abbreviation: the short form is the full name.
    expect(monthShortName(3, "ne")).toBe("असार");
    expect(monthShortName(6, "ne")).toBe("असोज");
  });

  test("weekday names, en and ne", () => {
    expect(weekdayName(0)).toBe("Sunday");
    expect(weekdayName(4)).toBe("Thursday");
    expect(weekdayName(0, "ne")).toBe("आइतवार");
    expect(weekdayName(4, "ne")).toBe("बिहिवार");
    expect(weekdayShortName(0)).toBe("Sun");
    expect(weekdayShortName(0, "ne")).toBe("आइत");
    expect(weekdayShortName(6, "ne")).toBe("शनि");
  });
});
