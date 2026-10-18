import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { EPOCH_UNIX_DAYS, PACKED_MONTH_LENGTHS } from "../src/calendar.gen.js";
import { base64Value, build, MONTH_LENGTHS, MONTH_START, YEAR_START } from "../src/tables.js";

const json = JSON.parse(
  readFileSync(new URL("../../../shared/data/calendar/bs-calendar.json", import.meta.url), "utf8"),
) as { month_lengths: Record<string, number[]> };

test("build() builds the tables in under 1 ms (time reported, not asserted)", () => {
  const start = performance.now();
  build();
  const ms = performance.now() - start;
  console.log(`tables build(): ${ms.toFixed(3)} ms`);
});

test("MONTH_LENGTHS equals bs-calendar.json for every month", () => {
  expect(MONTH_LENGTHS).toHaveLength(3588);
  const expected: number[] = [];
  for (let y = 1901; y <= 2199; y++) expected.push(...(json.month_lengths[String(y)] ?? []));
  expect(Array.from(MONTH_LENGTHS)).toEqual(expected);
});

test("MONTH_START and YEAR_START are prefix sums ending at 109212", () => {
  expect(MONTH_START).toHaveLength(3589);
  expect(YEAR_START).toHaveLength(300);
  expect(MONTH_START[0]).toBe(0);
  expect(MONTH_START[3588]).toBe(109212);
  expect(YEAR_START[299]).toBe(109212);
  for (let i = 0; i < 3588; i++) {
    expect(MONTH_START[i + 1]).toBe((MONTH_START[i] as number) + (MONTH_LENGTHS[i] as number));
  }
  for (let y = 0; y <= 299; y++) expect(YEAR_START[y]).toBe(MONTH_START[y * 12]);
});

test("EPOCH_UNIX_DAYS is days_from_civil(1844, 4, 11)", () => {
  expect(EPOCH_UNIX_DAYS).toBe(-45920);
  expect(Date.UTC(1844, 3, 11) / 86_400_000).toBe(EPOCH_UNIX_DAYS);
});

// T8 review: the packed table uses only part of the alphabet, so the decoder is checked against
// every base64 character here rather than through the table.
test("base64Value maps the whole base64 alphabet", () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let i = 0; i < alphabet.length; i++) {
    expect(base64Value(alphabet.charCodeAt(i))).toBe(i);
  }
});

// docs/mutation/equivalent.md relies on this: the packed string has no padding and ends exactly at
// the last month, so the decoder's loop guards all turn false on the same iteration.
test("the packed month lengths fill the table exactly", () => {
  expect(PACKED_MONTH_LENGTHS.length * 3).toBe(MONTH_LENGTHS.length);
  expect(PACKED_MONTH_LENGTHS).not.toContain("=");
});
