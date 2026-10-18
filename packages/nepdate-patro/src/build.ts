// Builds the patro value objects once at module load (ADR-0002 §7). Nothing here is exported from
// the package entry point; tests import `build` to time it.

import { DateRange, NepaliDate } from "nepdate";
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
} from "./tables.gen.js";

/**
 * A tithi or event name in both languages. Frozen and shared.
 * @example
 * info(NepaliDate.of(2081, 2, 15)).events[0]?.en; // => "Republic Day"
 */
export interface Named {
  /** Nepali (Devanagari) form. */
  readonly np: string;
  /** English form. */
  readonly en: string;
}

/**
 * What the patro knows about one BS day (PATRO §2). Frozen and shared.
 * @example
 * info(NepaliDate.of(2081, 2, 15)).isPublicHoliday; // => true
 */
export interface CalendarInfo {
  /** The tithi of the day, or `null` when the day has no tithi data. */
  readonly tithi: Named | null;
  /** True when the day is a gazetted public holiday. */
  readonly isPublicHoliday: boolean;
  /** The events of the day in display order; frozen and empty when there are none. */
  readonly events: readonly Named[];
}

/** Everything the queries need, built once. */
export interface PatroData {
  /** One entry per day from `COVERAGE_FIRST`, or the shared empty info. */
  readonly info: readonly CalendarInfo[];
  /** The shared value object for days without data and outside coverage. */
  readonly empty: CalendarInfo;
  /** The covered range. */
  readonly coverage: DateRange;
  /** Holiday dates in ascending order. */
  readonly holidays: readonly NepaliDate[];
}

const EMPTY_EVENTS: readonly Named[] = Object.freeze([]);
const EMPTY_INFO: CalendarInfo = Object.freeze({
  tithi: null,
  isPublicHoliday: false,
  events: EMPTY_EVENTS,
});

// Base64 by hand, as in the core tables: `atob` and `Buffer` are not in every runtime's type
// library. The bytes are little-endian (the generator writes DataView littleEndian), so a host
// with the other byte order still reads the same values.
function base64Value(code: number): number {
  if (code >= 65 && code <= 90) return code - 65; // A-Z
  if (code >= 97 && code <= 122) return code - 71; // a-z
  if (code >= 48 && code <= 57) return code + 4; // 0-9
  return code === 43 ? 62 : 63; // + or /
}

/** Internal: the bytes of a padded base64 string. Exported for the decoder test. */
export function decodeBase64(text: string): Uint8Array {
  const clean = text.endsWith("==")
    ? text.slice(0, -2)
    : text.endsWith("=")
      ? text.slice(0, -1)
      : text;
  const bytes = new Uint8Array(((clean.length * 3) / 4) | 0);
  let out = 0;
  for (let c = 0; c < clean.length; c += 4) {
    const bits =
      (base64Value(clean.charCodeAt(c)) << 18) |
      (base64Value(clean.charCodeAt(c + 1)) << 12) |
      (base64Value(c + 2 < clean.length ? clean.charCodeAt(c + 2) : 61) << 6) |
      base64Value(c + 3 < clean.length ? clean.charCodeAt(c + 3) : 61);
    if (out < bytes.length) bytes[out++] = (bits >> 16) & 0xff;
    if (out < bytes.length) bytes[out++] = (bits >> 8) & 0xff;
    if (out < bytes.length) bytes[out++] = bits & 0xff;
  }
  return bytes;
}

function bytes(text: string): Uint8Array {
  return decodeBase64(text);
}

function int32(text: string): Int32Array {
  const view = new DataView(bytes(text).buffer);
  const out = new Int32Array(view.byteLength / 4);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt32(i * 4, true);
  return out;
}

function uint16(text: string): Uint16Array {
  const view = new DataView(bytes(text).buffer);
  const out = new Uint16Array(view.byteLength / 2);
  for (let i = 0; i < out.length; i++) out[i] = view.getUint16(i * 2, true);
  return out;
}

/**
 * Builds the frozen `Named` pool, one frozen events array per event day and one frozen
 * `CalendarInfo` per day of the coverage. `info(date)` is then a range check and one array read.
 */
export function build(): PatroData {
  const tithiIds = bytes(TITHI_IDS);
  const holidaySerials = int32(HOLIDAY_DAYS);
  const eventSerials = int32(EVENT_DAYS);
  const eventCounts = bytes(EVENT_COUNTS);
  const eventNameIds = uint16(EVENT_NAME_IDS);

  const pool: Named[] = NAMES_NP.map((np, i) => Object.freeze({ np, en: NAMES_EN[i] as string }));

  const span = COVERAGE_LAST - COVERAGE_FIRST + 1;
  const holidayFlags = new Uint8Array(span);
  for (const serial of holidaySerials) holidayFlags[serial - COVERAGE_FIRST] = 1;

  const eventsByDay: (readonly Named[])[] = new Array<readonly Named[]>(span).fill(EMPTY_EVENTS);
  let nameId = 0;
  for (let i = 0; i < eventSerials.length; i++) {
    const count = eventCounts[i] as number;
    const events = new Array<Named>(count);
    for (let k = 0; k < count; k++) events[k] = pool[eventNameIds[nameId++] as number] as Named;
    eventsByDay[(eventSerials[i] as number) - COVERAGE_FIRST] = Object.freeze(events);
  }

  const info = new Array<CalendarInfo>(span);
  for (let offset = 0; offset < span; offset++) {
    const tithiOffset = COVERAGE_FIRST + offset - TITHI_FIRST;
    const tithi =
      tithiOffset >= 0 && tithiOffset < tithiIds.length
        ? (pool[tithiIds[tithiOffset] as number] as Named)
        : null;
    const events = eventsByDay[offset] as readonly Named[];
    const isPublicHoliday = holidayFlags[offset] === 1;
    info[offset] =
      tithi === null && !isPublicHoliday && events.length === 0
        ? EMPTY_INFO
        : Object.freeze({ tithi, isPublicHoliday, events });
  }

  return {
    info,
    empty: EMPTY_INFO,
    coverage: DateRange.of(
      NepaliDate.MIN.addDays(COVERAGE_FIRST),
      NepaliDate.MIN.addDays(COVERAGE_LAST),
    ),
    holidays: Array.from(holidaySerials, (serial) => NepaliDate.MIN.addDays(serial)),
  };
}
