import { expect, test } from "vitest";
import { MAX_YEAR, MIN_YEAR } from "../src/calendar.gen.js";
import { catalogRows } from "./catalog.js";
import { readVectors } from "./vectors.js";

test("generated calendar covers BS 1901 to 2199", () => {
  expect([MIN_YEAR, MAX_YEAR]).toEqual([1901, 2199]);
});

test("month-boundaries.csv has 7176 rows", () => {
  const rows = readVectors("month-boundaries.csv");
  expect(rows).toHaveLength(7176);
  expect(rows[0]).toEqual({
    bs: "1901-01-01",
    ad: "1844-04-11",
    weekday: "Thursday",
    month_length: "31",
  });
});

test("the C# catalogue has phase-1 rows", () => {
  expect(catalogRows("1").length).toBeGreaterThan(0);
});
