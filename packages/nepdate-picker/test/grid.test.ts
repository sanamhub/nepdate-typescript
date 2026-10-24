import { NepaliDate } from "nepdate-core";
import { describe, expect, test } from "vitest";
import {
  GRID_ROWS,
  type GridKey,
  isSelectable,
  monthGrid,
  moveFocus,
  weekdayOrder,
} from "../src/grid.js";

const d = (y: number, m: number, day: number) => NepaliDate.of(y, m, day);
const iso = (date: NepaliDate | undefined) => date?.toJSON();

describe("monthGrid", () => {
  // Shrawan 2081 has 32 days and starts on a Tuesday (AD 2024-07-16).
  const today = d(2081, 4, 15);

  test("lays the month out from its first weekday, six rows of seven", () => {
    const grid = monthGrid(2081, 4, { today });
    expect(grid).toHaveLength(GRID_ROWS);
    for (const row of grid) expect(row).toHaveLength(7);
    expect(d(2081, 4, 1).weekday).toBe(2);
    expect(grid[0]?.slice(0, 2)).toEqual([null, null]);
    expect(iso(grid[0]?.[2]?.date)).toBe("2081-04-01");
    const days = grid.flat().filter((cell) => cell !== null);
    expect(days.map((cell) => cell.date.day)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(grid.flat().indexOf(days[31] ?? null)).toBe(2 + 31);
  });

  test("gives each day its AD date and marks today", () => {
    const cells = monthGrid(2081, 4, { today }).flat();
    const fifteenth = cells.find((cell) => cell?.date.day === 15);
    expect(fifteenth?.gregorian).toEqual({ year: 2024, month: 7, day: 30 });
    expect(cells.filter((cell) => cell?.isToday).map((cell) => iso(cell?.date))).toEqual([
      "2081-04-15",
    ]);
  });

  test("today defaults to Nepal's date", () => {
    const now = NepaliDate.today();
    const cells = monthGrid(now.year, now.month).flat();
    expect(cells.filter((cell) => cell?.isToday).map((cell) => iso(cell?.date))).toEqual([
      now.toJSON(),
    ]);
  });

  test("starts the week on the given day", () => {
    expect(weekdayOrder()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(weekdayOrder({ firstDayOfWeek: 1 })).toEqual([1, 2, 3, 4, 5, 6, 0]);
    const grid = monthGrid(2081, 4, { today, firstDayOfWeek: 1 });
    expect(grid[0]?.slice(0, 1)).toEqual([null]);
    expect(iso(grid[0]?.[1]?.date)).toBe("2081-04-01");
  });

  test("ignores a first day that is not 0 to 6", () => {
    for (const firstDayOfWeek of [-1, 7, 1.5, Number.NaN]) {
      expect(weekdayOrder({ firstDayOfWeek })).toEqual([0, 1, 2, 3, 4, 5, 6]);
    }
  });

  test("disables days outside min and max and days the callback refuses", () => {
    const cells = monthGrid(2081, 4, {
      today,
      min: d(2081, 4, 5),
      max: d(2081, 4, 25),
      isDateDisallowed: (date) => date.weekday === 6,
    })
      .flat()
      .filter((cell) => cell !== null);
    const disabled = cells.filter((cell) => cell.disabled).map((cell) => cell.date.day);
    const saturdays = cells.filter((cell) => cell.date.weekday === 6).map((cell) => cell.date.day);
    const expected = new Set([
      1,
      2,
      3,
      4,
      26,
      27,
      28,
      29,
      30,
      31,
      32,
      ...saturdays.filter((day) => day >= 5 && day <= 25),
    ]);
    expect(new Set(disabled)).toEqual(expected);
  });

  test("covers the first and last months of the range", () => {
    const first = monthGrid(1901, 1, { today })
      .flat()
      .filter((cell) => cell !== null);
    expect(iso(first[0]?.date)).toBe("1901-01-01");
    const last = monthGrid(2199, 12, { today })
      .flat()
      .filter((cell) => cell !== null);
    expect(iso(last.at(-1)?.date)).toBe("2199-12-30");
  });

  test("throws outside the range", () => {
    expect(() => monthGrid(1900, 12)).toThrow(RangeError);
    expect(() => monthGrid(2200, 1)).toThrow(RangeError);
  });

  test("every month of the range fits in six rows", () => {
    for (let year = 1901; year <= 2199; year++) {
      for (let month = 1; month <= 12; month++) {
        for (const firstDayOfWeek of [0, 1, 6]) {
          const count = monthGrid(year, month, { today, firstDayOfWeek })
            .flat()
            .filter((cell) => cell !== null).length;
          expect(count).toBe(NepaliDate.of(year, month, 1).monthLength);
        }
      }
    }
  });
});

describe("isSelectable", () => {
  test("is inclusive at both limits", () => {
    const options = { min: d(2081, 1, 1), max: d(2081, 12, 30) };
    expect(isSelectable(d(2081, 1, 1), options)).toBe(true);
    expect(isSelectable(d(2081, 12, 30), options)).toBe(true);
    expect(isSelectable(d(2080, 12, 30), options)).toBe(false);
    expect(isSelectable(d(2082, 1, 1), options)).toBe(false);
    expect(isSelectable(d(2081, 6, 1))).toBe(true);
  });
});

describe("moveFocus", () => {
  const start = d(2081, 4, 15); // a Tuesday
  const cases: [GridKey, string][] = [
    ["ArrowLeft", "2081-04-14"],
    ["ArrowRight", "2081-04-16"],
    ["ArrowUp", "2081-04-08"],
    ["ArrowDown", "2081-04-22"],
    ["Home", "2081-04-13"],
    ["End", "2081-04-19"],
    ["PageUp", "2081-03-15"],
    ["PageDown", "2081-05-15"],
    ["Shift+PageUp", "2080-04-15"],
    ["Shift+PageDown", "2082-04-15"],
  ];
  test.each(cases)("%s from 2081-04-15 goes to %s", (key, expected) => {
    expect(moveFocus(start, key).toJSON()).toBe(expected);
  });

  test("Home and End follow the first day of the week", () => {
    expect(moveFocus(start, "Home", { firstDayOfWeek: 1 }).toJSON()).toBe("2081-04-14");
    expect(moveFocus(start, "End", { firstDayOfWeek: 1 }).toJSON()).toBe("2081-04-20");
  });

  test("crosses month ends day by day", () => {
    expect(moveFocus(d(2081, 4, 32), "ArrowRight").toJSON()).toBe("2081-05-01");
    expect(moveFocus(d(2081, 5, 1), "ArrowLeft").toJSON()).toBe("2081-04-32");
  });

  test("clamps the day when the next month is shorter", () => {
    // Bhadra 2081 has 31 days.
    expect(moveFocus(d(2081, 4, 32), "PageDown").toJSON()).toBe("2081-05-31");
  });

  test("stays inside min and max", () => {
    const options = { min: d(2081, 4, 10), max: d(2081, 4, 20) };
    expect(moveFocus(d(2081, 4, 10), "ArrowLeft", options).toJSON()).toBe("2081-04-10");
    expect(moveFocus(d(2081, 4, 18), "ArrowDown", options).toJSON()).toBe("2081-04-20");
    expect(moveFocus(d(2081, 4, 15), "PageUp", options).toJSON()).toBe("2081-04-10");
    expect(moveFocus(d(2081, 4, 15), "Shift+PageDown", options).toJSON()).toBe("2081-04-20");
  });

  test("stays inside BS 1901 to 2199", () => {
    expect(moveFocus(NepaliDate.MIN, "ArrowUp").toJSON()).toBe("1901-01-01");
    expect(moveFocus(NepaliDate.MIN, "PageUp").toJSON()).toBe("1901-01-01");
    expect(moveFocus(d(1901, 6, 1), "Shift+PageUp").toJSON()).toBe("1901-01-01");
    expect(moveFocus(NepaliDate.MAX, "ArrowDown").toJSON()).toBe("2199-12-30");
    expect(moveFocus(NepaliDate.MAX, "PageDown").toJSON()).toBe("2199-12-30");
    expect(moveFocus(d(2199, 6, 1), "Shift+PageDown").toJSON()).toBe("2199-12-30");
    expect(moveFocus(NepaliDate.MIN, "Home").toJSON()).toBe("1901-01-01");
  });

  test("may land on a disallowed day, which the grid shows disabled", () => {
    const options = { isDateDisallowed: (date: NepaliDate) => date.day === 16 };
    expect(moveFocus(start, "ArrowRight", options).toJSON()).toBe("2081-04-16");
  });
});

test("the package entry imports without a DOM and defineElements does nothing there", async () => {
  const entry = await import("../src/index.js");
  expect(typeof entry.NepDateCalendarElement).toBe("function");
  expect(() => entry.defineElements()).not.toThrow();
});
