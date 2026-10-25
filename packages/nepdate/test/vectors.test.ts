import { describe, expect, test } from "vitest";
import { NepaliDate } from "../src/index.js";
import { type Row, readVectors } from "./vectors.js";

// The vector files name weekdays in English.
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ymd(text: string): [number, number, number] {
  const [y, m, d] = text.split("-").map(Number);
  return [y as number, m as number, d as number];
}

function iso(g: { year: number; month: number; day: number }): string {
  return `${g.year}-${String(g.month).padStart(2, "0")}-${String(g.day).padStart(2, "0")}`;
}

function checkRow(row: Row): void {
  const bs = NepaliDate.of(...ymd(row.bs as string));
  expect(iso(bs.toGregorian())).toBe(row.ad);
  const [year, month, day] = ymd(row.ad as string);
  expect(NepaliDate.fromGregorian({ year, month, day }).equals(bs)).toBe(true);
  expect(WEEKDAYS[bs.weekday]).toBe(row.weekday);
  expect(bs.monthLength).toBe(Number(row.month_length));
  if (row.day_of_year !== undefined) expect(bs.dayOfYear).toBe(Number(row.day_of_year));
}

describe("month-boundaries.csv", () => {
  const rows = readVectors("month-boundaries.csv");
  test("has 7176 rows", () => expect(rows).toHaveLength(7176));
  test("every row: ad, weekday, month_length", () => {
    for (const row of rows) checkRow(row);
  });
});

describe("csharp-golden/dates.tsv", () => {
  const rows = readVectors("csharp-golden/dates.tsv");
  test("has 1018 rows", () => expect(rows).toHaveLength(1018));
  test("every row: ad, weekday, day_of_year, month_length", () => {
    for (const row of rows) checkRow(row);
  });
});
