import { describe, expect, test } from "vitest";
import { NepaliDate, NepDateError } from "../src/index.js";
import { bs, iso, kindOf } from "./helpers.js";
import { readVectors } from "./vectors.js";

function gregorian(text: string): { year: number; month: number; day: number } {
  const [year, month, day] = text.split("-").map(Number);
  return { year: year as number, month: month as number, day: day as number };
}

const list = (text: string): string[] => text.split(";");

function text(dates: readonly { year: number; month: number; day: number }[]): string {
  return dates.map((date) => iso(date)).join(";");
}

describe("bulk.tsv", () => {
  const rows = readVectors("csharp-golden/bulk.tsv");

  test("6 rows", () => expect(rows).toHaveLength(6));

  test("every row keeps the input order (NC04 to NC08)", () => {
    for (const row of rows) {
      const input = list(row.input as string);
      const operation = row.operation as string;
      let actual: string;
      if (operation === "to_nepali_dates" || operation === "batch_to_nepali_dates") {
        actual = text(NepaliDate.toNepaliDates(input.map(gregorian)));
      } else if (
        operation === "to_english_dates_from_strings" ||
        operation === "batch_to_english_dates"
      ) {
        try {
          actual = text(NepaliDate.toEnglishDates(input));
        } catch (error) {
          if (error instanceof NepDateError) actual = "ERR";
          else throw error;
        }
      } else {
        actual = text(NepaliDate.toEnglishDates(input.map(bs)));
      }
      expect(actual, `${operation} ${row.input}`).toBe(row.output);
    }
  });

  test("a batch is all or nothing: one bad string fails the whole call", () => {
    expect(kindOf(() => NepaliDate.toEnglishDates(["2081-04-15", "2081-01-32"]))).toBe(
      "invalid-day",
    );
    expect(
      kindOf(() =>
        NepaliDate.toNepaliDates([
          { year: 1844, month: 4, day: 11 },
          { year: 3, month: 1, day: 1 },
        ]),
      ),
    ).toBe("out-of-range");
  });

  test("a batch returns a plain array, an empty input an empty array", () => {
    expect(NepaliDate.toNepaliDates([])).toEqual([]);
    expect(NepaliDate.toEnglishDates([])).toEqual([]);
    const dates = NepaliDate.toNepaliDates([
      { year: 2024, month: 7, day: 30 },
      { year: 1844, month: 4, day: 11 },
      { year: 2024, month: 7, day: 31 },
    ]);
    expect(Array.isArray(dates)).toBe(true);
    expect(dates.map((date) => date.toJSON())).toEqual(["2081-04-15", "1901-01-01", "2081-04-16"]);
    expect(NepaliDate.toEnglishDates(dates)).toEqual([
      { year: 2024, month: 7, day: 30 },
      { year: 1844, month: 4, day: 11 },
      { year: 2024, month: 7, day: 31 },
    ]);
  });

  test("the result is a GregorianDate, not a Date: no zone is guessed", () => {
    const [first] = NepaliDate.toEnglishDates(["2081-04-15"]);
    expect(first).not.toBeInstanceOf(Date);
    expect(first).toEqual({ year: 2024, month: 7, day: 30 });
  });
});
