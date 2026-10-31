// The generated tables against the hub's counts in shared/spec/vectors/patro-summary.json
// (ADR-0017). A data change moves the numbers in that file, not in this test.

import { NepaliDate } from "nepdate-core";
import { expect, test } from "vitest";
import {
  COVERAGE_FIRST,
  COVERAGE_LAST,
  EVENT_COUNTS,
  EVENT_DAYS,
  EVENT_NAME_IDS,
  HOLIDAY_DAYS,
  NAMES_EN,
  NAMES_NP,
  TITHI_FIRST,
  TITHI_IDS,
} from "../src/tables.gen.js";
import { decodeBytes, decodeInt32, decodeUint16 } from "./decode.js";
import { SUMMARY } from "./summary.js";

const TITHI = decodeBytes(TITHI_IDS);
const HOLIDAYS = decodeInt32(HOLIDAY_DAYS);
const EVENT_SERIALS = decodeInt32(EVENT_DAYS);
const EVENT_DAY_COUNTS = decodeBytes(EVENT_COUNTS);
const EVENT_IDS = decodeUint16(EVENT_NAME_IDS);

function strictlyIncreasing(values: Int32Array): boolean {
  for (let i = 1; i < values.length; i++) {
    if ((values[i] as number) <= (values[i - 1] as number)) return false;
  }
  return true;
}

function dayOf(serial: number): string {
  return NepaliDate.MIN.addDays(serial).toJSON();
}

function namePair(id: number): string {
  return `${NAMES_NP[id] as string}\u0000${NAMES_EN[id] as string}`;
}

test("coverage is the summary's serial range and day pair (PATRO §3)", () => {
  expect(COVERAGE_FIRST).toBe(SUMMARY.first_serial);
  expect(COVERAGE_LAST).toBe(SUMMARY.last_serial);
  expect(dayOf(COVERAGE_FIRST)).toBe(SUMMARY.first_day);
  expect(dayOf(COVERAGE_LAST)).toBe(SUMMARY.last_day);
  expect(COVERAGE_LAST - COVERAGE_FIRST + 1).toBe(SUMMARY.days);
});

test("tithi data is contiguous from TITHI_FIRST (PATRO §3)", () => {
  expect(TITHI_FIRST).toBe(SUMMARY.tithi_first_serial);
  expect(dayOf(TITHI_FIRST)).toBe(SUMMARY.tithi_first_day);
  expect(TITHI).toHaveLength(SUMMARY.tithi_days);
  expect(dayOf(TITHI_FIRST + TITHI.length - 1)).toBe(SUMMARY.tithi_last_day);
  expect(new Set(TITHI).size).toBe(SUMMARY.tithi_names);
  for (const id of TITHI) expect(id).toBeLessThan(SUMMARY.tithi_names);
});

test("holiday serials are the summary's count, sorted and in range", () => {
  expect(HOLIDAYS).toHaveLength(SUMMARY.holidays);
  expect(strictlyIncreasing(HOLIDAYS)).toBe(true);
  expect(HOLIDAYS[0]).toBe(COVERAGE_FIRST);
  for (const serial of HOLIDAYS) {
    expect(serial).toBeGreaterThanOrEqual(COVERAGE_FIRST);
    expect(serial).toBeLessThanOrEqual(COVERAGE_LAST);
  }
});

test("event tables are the summary's day and event counts, sorted, ids in range", () => {
  expect(EVENT_SERIALS).toHaveLength(SUMMARY.event_days);
  expect(EVENT_DAY_COUNTS).toHaveLength(SUMMARY.event_days);
  expect(EVENT_IDS).toHaveLength(SUMMARY.events);
  expect(strictlyIncreasing(EVENT_SERIALS)).toBe(true);
  expect(EVENT_SERIALS[0]).toBe(COVERAGE_FIRST);
  expect(EVENT_SERIALS[EVENT_SERIALS.length - 1]).toBe(COVERAGE_LAST);
  let total = 0;
  for (const count of EVENT_DAY_COUNTS) {
    expect(count).toBeGreaterThan(0);
    total += count;
  }
  expect(total).toBe(SUMMARY.events);
  for (const id of EVENT_IDS) expect(id).toBeLessThan(SUMMARY.names);
  const eventNames = new Set<string>();
  for (const id of EVENT_IDS) eventNames.add(namePair(id));
  expect(eventNames.size).toBe(SUMMARY.event_names);
});

test("the name pool is the summary's distinct pairs and byte length", () => {
  expect(NAMES_NP).toHaveLength(SUMMARY.names);
  expect(NAMES_EN).toHaveLength(SUMMARY.names);
  const pairs = new Set<string>();
  let bytes = 0;
  for (let i = 0; i < NAMES_NP.length; i++) {
    const np = NAMES_NP[i] as string;
    const en = NAMES_EN[i] as string;
    expect(np.length).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(0);
    pairs.add(`${np}\u0000${en}`);
    bytes += Buffer.byteLength(np, "utf8") + Buffer.byteLength(en, "utf8");
  }
  expect(pairs.size).toBe(SUMMARY.names);
  expect(bytes).toBe(SUMMARY.name_bytes);
});
