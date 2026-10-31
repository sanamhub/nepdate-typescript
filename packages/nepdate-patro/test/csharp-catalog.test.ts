// C# NepDate's patro tests (shared/spec/vectors/csharp-tests/catalog.tsv, phase 4), translated to
// this API. One test per catalogue row (shared/spec/PORT-PLAN.md, "C# test catalogue").

import { NepaliDate, NepDateError } from "nepdate-core";
import { expect } from "vitest";
import type { Named } from "../src/index.js";
import { coverage, info, publicHolidays } from "../src/index.js";
import {
  EVENT_COUNTS,
  EVENT_DAYS,
  EVENT_NAME_IDS,
  HOLIDAY_DAYS,
  NAMES_EN,
  NAMES_NP,
  TITHI_IDS,
} from "../src/tables.gen.js";
import { type CatalogCase, checkCatalog } from "./catalog.js";
import { decodeBytes, decodeInt32, decodeUint16 } from "./decode.js";
import { SUMMARY } from "./summary.js";

const of = NepaliDate.of;
const MAX_SERIAL = 109211;
const MONTHS = 299 * 12;

const TITHI = decodeBytes(TITHI_IDS);
const HOLIDAYS = decodeInt32(HOLIDAY_DAYS);
const EVENT_SERIALS = decodeInt32(EVENT_DAYS);
const EVENT_DAY_COUNTS = decodeBytes(EVENT_COUNTS);
const EVENT_IDS = decodeUint16(EVENT_NAME_IDS);

function serialOf(date: NepaliDate): number {
  return NepaliDate.MIN.daysUntil(date);
}

function english(events: readonly Named[]): string[] {
  return events.map((named) => named.en);
}

function expectEmpty(date: NepaliDate): void {
  const calendarInfo = info(date);
  expect(calendarInfo.tithi).toBeNull();
  expect(calendarInfo.isPublicHoliday).toBe(false);
  expect(calendarInfo.events).toEqual([]);
}

function expectOutOfRange(fn: () => unknown): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(NepDateError);
  expect((caught as NepDateError).kind).toBe("out-of-range");
}

function expectStrictlyIncreasing(values: Int32Array): void {
  for (let i = 1; i < values.length; i++) {
    expect(values[i] as number).toBeGreaterThan(values[i - 1] as number);
  }
}

// The C# CalendarOffsets table covers BS 2001..2089 (32,509 days); this port covers BS 1901..2199
// (API.md, ALGORITHM §2), so the rows below check the port's wider table.
const monthStarts: CatalogCase = () => {
  const serials = new Set<number>();
  let count = 0;
  for (let year = 1901; year <= 2199; year++) {
    for (let month = 1; month <= 12; month++) {
      const serial = serialOf(of(year, month, 1));
      expect(serial).toBeGreaterThanOrEqual(0);
      expect(serial).toBeLessThanOrEqual(MAX_SERIAL);
      expect(serials.has(serial)).toBe(false);
      serials.add(serial);
      count++;
    }
  }
  expect(count).toBe(MONTHS);
  expect(serials.size).toBe(MONTHS);
};

const cases: Record<string, CatalogCase> = {
  "CalendarDataTests.CalendarStrings_Pool_IsNonEmpty": () => {
    expect(NAMES_NP.length).toBeGreaterThan(0);
  },
  "CalendarDataTests.CalendarStrings_Pool_AllEntriesHaveNonEmptyNpAndEn": () => {
    for (let i = 0; i < NAMES_NP.length; i++) {
      expect(NAMES_NP[i]).not.toBe("");
      expect(NAMES_EN[i]).not.toBe("");
    }
  },
  "CalendarDataTests.CalendarOffsets_MonthStart_HasExpectedLength": monthStarts,
  "CalendarDataTests.CalendarOffsets_MonthStart_IsStrictlyMonotonic": () => {
    let previous = -1;
    for (let year = 1901; year <= 2199; year++) {
      for (let month = 1; month <= 12; month++) {
        const serial = serialOf(of(year, month, 1));
        expect(serial).toBeGreaterThan(previous);
        previous = serial;
      }
    }
  },
  // C# CalendarOffsets holds 32,509 days (BS 2001..2089); the port holds 109,212 (BS 1901..2199).
  "CalendarDataTests.CalendarOffsets_TotalDays_MatchesExpectedCount": () => {
    expect(serialOf(NepaliDate.MAX) + 1).toBe(109212);
  },
  "CalendarDataTests.TithiData_DayOffsets_IsStrictlySorted": () => {
    let first = -1;
    let last = -1;
    let count = 0;
    for (const date of coverage()) {
      if (info(date).tithi !== null) {
        const serial = serialOf(date);
        if (first < 0) first = serial;
        last = serial;
        count++;
      }
    }
    expect(count).toBe(SUMMARY.tithi_days);
    expect(last - first + 1).toBe(count);
  },
  "CalendarDataTests.TithiData_AllPoolIds_AreInRange": () => {
    for (const id of TITHI) expect(id).toBeLessThan(NAMES_NP.length);
  },
  "CalendarDataTests.TithiData_EntryCount_Matches2190": () => {
    let count = 0;
    for (const date of coverage()) if (info(date).tithi !== null) count++;
    expect(count).toBe(SUMMARY.tithi_days);
  },
  "CalendarDataTests.EventData_DayOffsets_IsStrictlySorted": () => {
    expectStrictlyIncreasing(EVENT_SERIALS);
  },
  "CalendarDataTests.EventData_SliceStart_IsNonDecreasing": () => {
    let start = 0;
    for (const count of EVENT_DAY_COUNTS) {
      const previous = start;
      start += count;
      expect(start).toBeGreaterThanOrEqual(previous);
    }
  },
  "CalendarDataTests.EventData_SliceStart_SentinelEqualsEntriesLength": () => {
    let start = 0;
    for (const count of EVENT_DAY_COUNTS) start += count;
    expect(start).toBe(EVENT_IDS.length);
  },
  "CalendarDataTests.EventData_AllEntries_AreInRange": () => {
    for (const id of EVENT_IDS) expect(id).toBeLessThan(NAMES_NP.length);
  },
  "CalendarDataTests.EventData_DayCount_Matches1671": () => {
    expect(EVENT_SERIALS).toHaveLength(SUMMARY.event_days);
  },
  "CalendarDataTests.HolidayData_DayOffsets_IsStrictlySorted": () => {
    expectStrictlyIncreasing(HOLIDAYS);
  },
  "CalendarDataTests.HolidayData_Count_Matches294": () => {
    expect(HOLIDAYS).toHaveLength(SUMMARY.holidays);
  },
  "CalendarDataTests.CalendarOffsets_GetOffset_BaseYear_Month1_Day1_ReturnsZero": () => {
    expect(serialOf(NepaliDate.MIN)).toBe(0);
    expect(serialOf(of(1901, 1, 1))).toBe(0);
  },
  // C# returns the -1 sentinel for a date outside its table (which starts at BS 2001); this port's
  // table starts at BS 1901 and cannot construct an invalid date, so the equivalent is the
  // documented "out-of-range" error (API.md, NepaliDate.of).
  "CalendarDataTests.CalendarOffsets_GetOffset_OutOfRange_ReturnsNegativeOne": () => {
    expectOutOfRange(() => of(1900, 1, 1));
  },
  "CalendarDataTests.CalendarOffsets_GetOffset_AllOffsetsAreUniqueSentinel": monthStarts,
  "CalendarDataTests.NepaliDate_2081_01_01_CalendarData": () => {
    const calendarInfo = info(of(2081, 1, 1));
    expect(calendarInfo.tithi?.np).toBe("पञ्चमी");
    expect(calendarInfo.tithi?.en).toBe("Panchami");
    expect(calendarInfo.isPublicHoliday).toBe(true);
    expect(calendarInfo.events.map((named) => named.np)).toEqual([
      "नयाँ वर्ष",
      "मेष संक्रान्ति",
      "बिस्का: जात्रा",
    ]);
  },
  "CalendarDataTests.NepaliDate_2081_01_02_Tithi_IsShashthi": () => {
    expect(info(of(2081, 1, 2)).tithi?.np).toBe("षष्ठी");
    expect(info(of(2081, 1, 2)).tithi?.en).toBe("Shashthi");
  },
  "CalendarDataTests.NepaliDate_2081_01_05_IsPublicHoliday": () => {
    expect(info(of(2081, 1, 5)).isPublicHoliday).toBe(true);
  },
  "CalendarDataTests.NepaliDate_2081_02_15_IsPublicHoliday_GanatantraDiwas": () => {
    const calendarInfo = info(of(2081, 2, 15));
    expect(calendarInfo.isPublicHoliday).toBe(true);
    expect(english(calendarInfo.events)).toEqual(["Republic Day"]);
  },
  "CalendarDataTests.NepaliDate_2080_11_01_CalendarData": () => {
    const calendarInfo = info(of(2080, 11, 1));
    expect(calendarInfo.tithi?.np).toBe("चतुर्थी");
    expect(calendarInfo.tithi?.en).toBe("Chaturthi");
    expect(calendarInfo.isPublicHoliday).toBe(false);
    expect(english(calendarInfo.events)).toEqual([
      "Mangala Chauthi Brata",
      "People's War Day",
      "Tilakund Chauthi",
      "Kumbha Sankranti",
      "World Radio Day",
    ]);
  },
  "CalendarDataTests.NepaliDate_BeforeRange_AllPropertiesReturnDefaults": () => {
    expectEmpty(of(2070, 6, 15));
  },
  "CalendarDataTests.NepaliDate_AfterRange_AllPropertiesReturnDefaults": () => {
    expectEmpty(of(2090, 1, 1));
  },
  "CalendarDataTests.NepaliDate_OutsideTithiRange_TithiIsEmpty": () => {
    expect(info(of(2077, 6, 15)).tithi).toBeNull();
  },
  "CalendarDataTests.NepaliDate_EventsNp_And_EventsEn_AlwaysHaveSameLength": () => {
    for (const date of coverage()) {
      for (const named of info(date).events) {
        expect(named.np.length).toBeGreaterThan(0);
        expect(named.en.length).toBeGreaterThan(0);
      }
    }
  },
  "CalendarDataTests.GetCalendarInfo_TithiMatchesFlatProperties": () => {
    // The flat NepaliDate members are gone (D-13). The equivalent is that info() is the only
    // source, that it returns the same frozen object on every call, and that its tithi is shared.
    const date = of(2081, 1, 1);
    const first = info(date);
    expect(info(of(2081, 1, 1))).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(info(date).tithi).toBe(first.tithi);
  },
  "CalendarDataTests.AllDaysInScrapedRange_OffsetsAreInBounds": () => {
    for (const date of coverage()) {
      const serial = serialOf(date);
      expect(serial).toBeGreaterThanOrEqual(0);
      expect(serial).toBeLessThanOrEqual(MAX_SERIAL);
    }
  },
  "CalendarDataTests.AllDaysInScrapedRange_NoExceptionOnPropertyAccess": () => {
    for (const date of coverage()) {
      const calendarInfo = info(date);
      if (calendarInfo.tithi !== null) expect(calendarInfo.tithi.en).toBeTypeOf("string");
      expect(calendarInfo.isPublicHoliday).toBeTypeOf("boolean");
      expect(calendarInfo.events.length).toBeGreaterThanOrEqual(0);
    }
  },
  "CalendarDataTests.AllTithiEntries_ResolveToNonEmptyStrings": () => {
    for (const id of TITHI) {
      expect(NAMES_NP[id]).not.toBe("");
      expect(NAMES_EN[id]).not.toBe("");
    }
  },
  "CalendarDataTests.AllHolidayOffsets_AreInBounds": () => {
    for (const serial of HOLIDAYS) {
      expect(serial).toBeGreaterThanOrEqual(0);
      expect(serial).toBeLessThanOrEqual(MAX_SERIAL);
    }
  },
  "CalendarDataTests.AllEventOffsets_AreInBounds": () => {
    for (const serial of EVENT_SERIALS) {
      expect(serial).toBeGreaterThanOrEqual(0);
      expect(serial).toBeLessThanOrEqual(MAX_SERIAL);
    }
  },
  "CalendarDataTests.HolidayCount_ViaApi_Matches294": () => {
    expect([...publicHolidays()]).toHaveLength(SUMMARY.holidays);
  },
  "CalendarDataTests.CalendarInfo_EventArrays_AreNeverNull": () => {
    for (const date of coverage()) expect(Array.isArray(info(date).events)).toBe(true);
  },
};

checkCatalog("4", cases, "Core/CalendarDataTests.cs");
