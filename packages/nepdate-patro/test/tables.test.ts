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

// The generated tables are base64 strings decoded at load with DataView in the package, so the
// tests decode them the same way: little-endian, independent of the host's byte order.
function decode(text: string): DataView {
  const buffer = Buffer.from(text, "base64");
  return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function bytes(text: string): Uint8Array {
  const view = decode(text);
  const out = new Uint8Array(view.byteLength);
  for (let i = 0; i < out.length; i++) out[i] = view.getUint8(i);
  return out;
}

function uint16(text: string): Uint16Array {
  const view = decode(text);
  const out = new Uint16Array(view.byteLength / 2);
  for (let i = 0; i < out.length; i++) out[i] = view.getUint16(i * 2, true);
  return out;
}

function int32(text: string): Int32Array {
  const view = decode(text);
  const out = new Int32Array(view.byteLength / 4);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt32(i * 4, true);
  return out;
}

function strictlyIncreasing(values: Int32Array): boolean {
  for (let i = 1; i < values.length; i++) {
    if ((values[i] as number) <= (values[i - 1] as number)) return false;
  }
  return true;
}

test("coverage is serial 64285..67077, BS 2077-01-01..2084-08-20 (PATRO §3)", () => {
  expect(COVERAGE_FIRST).toBe(64285);
  expect(COVERAGE_LAST).toBe(67077);
});

test("tithi data is contiguous: 2190 days from serial 64652 (PATRO §3)", () => {
  const ids = bytes(TITHI_IDS);
  expect(TITHI_FIRST).toBe(64652);
  expect(ids).toHaveLength(2190);
  for (const id of ids) expect(id).toBeLessThan(32);
});

test("294 holidays, sorted and in range", () => {
  const holidays = int32(HOLIDAY_DAYS);
  expect(holidays).toHaveLength(294);
  expect(strictlyIncreasing(holidays)).toBe(true);
  expect(holidays[0]).toBe(COVERAGE_FIRST);
  expect(holidays[293]).toBe(67075); // BS 2084-08-18
  for (const serial of holidays) {
    expect(serial).toBeGreaterThanOrEqual(COVERAGE_FIRST);
    expect(serial).toBeLessThanOrEqual(COVERAGE_LAST);
  }
});

test("1671 event days with 3032 events, sorted, ids in range", () => {
  const days = int32(EVENT_DAYS);
  const counts = bytes(EVENT_COUNTS);
  const ids = uint16(EVENT_NAME_IDS);
  expect(days).toHaveLength(1671);
  expect(counts).toHaveLength(1671);
  expect(ids).toHaveLength(3032);
  expect(strictlyIncreasing(days)).toBe(true);
  expect(days[0]).toBe(COVERAGE_FIRST);
  expect(days[1670]).toBe(COVERAGE_LAST);
  let total = 0;
  for (const count of counts) {
    expect(count).toBeGreaterThan(0);
    total += count;
  }
  expect(total).toBe(3032);
  for (const id of ids) expect(id).toBeLessThan(753);
});

test("the deduplicated name pool has 753 distinct (np, en) pairs", () => {
  expect(NAMES_NP).toHaveLength(753);
  expect(NAMES_EN).toHaveLength(753);
  const pairs = new Set<string>();
  for (let i = 0; i < NAMES_NP.length; i++) {
    expect((NAMES_NP[i] as string).length).toBeGreaterThan(0);
    expect((NAMES_EN[i] as string).length).toBeGreaterThan(0);
    pairs.add(`${NAMES_NP[i]}\u0000${NAMES_EN[i]}`);
  }
  expect(pairs.size).toBe(753);
});
