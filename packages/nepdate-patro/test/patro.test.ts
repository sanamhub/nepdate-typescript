import { NepaliDate } from "nepdate-core";
import { describe, expect, test } from "vitest";
import { build } from "../src/build.js";
import { type CalendarInfo, coverage, info, type Named, publicHolidays } from "../src/index.js";

const of = NepaliDate.of;

function english(list: readonly Named[]): string[] {
  return list.map((named) => named.en);
}

function expectEmpty(calendarInfo: CalendarInfo): void {
  expect(calendarInfo.tithi).toBeNull();
  expect(calendarInfo.isPublicHoliday).toBe(false);
  expect(calendarInfo.events).toEqual([]);
}

describe("PATRO §4 anchors", () => {
  test("2081-01-01: Panchami, holiday, three events in file order", () => {
    const calendarInfo = info(of(2081, 1, 1));
    expect(calendarInfo.tithi?.np).toBe("पञ्चमी");
    expect(calendarInfo.tithi?.en).toBe("Panchami");
    expect(calendarInfo.isPublicHoliday).toBe(true);
    expect(english(calendarInfo.events)).toEqual(["New Year", "Mesh Sankranti", "Bisket Jatra"]);
  });

  test("2081-01-02: Shashthi, no holiday, no events", () => {
    const calendarInfo = info(of(2081, 1, 2));
    expect(calendarInfo.tithi?.en).toBe("Shashthi");
    expect(calendarInfo.isPublicHoliday).toBe(false);
    expect(calendarInfo.events).toEqual([]);
  });

  test("2081-02-15: Panchami, Republic Day", () => {
    const calendarInfo = info(of(2081, 2, 15));
    expect(calendarInfo.tithi?.en).toBe("Panchami");
    expect(calendarInfo.isPublicHoliday).toBe(true);
    expect(english(calendarInfo.events)).toEqual(["Republic Day"]);
  });

  test("2080-11-01: Chaturthi with five events in order", () => {
    const calendarInfo = info(of(2080, 11, 1));
    expect(calendarInfo.tithi?.en).toBe("Chaturthi");
    expect(calendarInfo.isPublicHoliday).toBe(false);
    expect(english(calendarInfo.events)).toEqual([
      "Mangala Chauthi Brata",
      "People's War Day",
      "Tilakund Chauthi",
      "Kumbha Sankranti",
      "World Radio Day",
    ]);
  });

  test("2081-04-15: Dashami, the sentinel event among three", () => {
    const calendarInfo = info(of(2081, 4, 15));
    expect(calendarInfo.tithi?.en).toBe("Dashami");
    expect(calendarInfo.isPublicHoliday).toBe(false);
    expect(english(calendarInfo.events)).toEqual([
      "Kheer Khane Din",
      "World Day Against Human Trafficking",
      "International Friendship Day",
    ]);
  });

  test("2070-06-15 and 2090-01-01: outside coverage, empty info", () => {
    expectEmpty(info(of(2070, 6, 15)));
    expectEmpty(info(of(2090, 1, 1)));
    expectEmpty(info(NepaliDate.MIN));
    expectEmpty(info(NepaliDate.MAX));
  });

  test("2077-06-15: inside coverage, before the tithi range", () => {
    const calendarInfo = info(of(2077, 6, 15));
    expect(calendarInfo.tithi).toBeNull();
    expect(calendarInfo.isPublicHoliday).toBe(false);
  });
});

test("coverage() is 2077-01-01..2084-08-20, 2793 days", () => {
  const range = coverage();
  expect(range.start.toJSON()).toBe("2077-01-01");
  expect(range.end.toJSON()).toBe("2084-08-20");
  expect(range.length).toBe(2793);
});

test("publicHolidays() is 294 ascending dates, first 2077-01-01, last 2084-08-18", () => {
  const dates = [...publicHolidays()];
  expect(dates).toHaveLength(294);
  expect((dates[0] as NepaliDate).toJSON()).toBe("2077-01-01");
  expect((dates[293] as NepaliDate).toJSON()).toBe("2084-08-18");
  for (let i = 1; i < dates.length; i++) {
    expect(NepaliDate.compare(dates[i - 1] as NepaliDate, dates[i] as NepaliDate)).toBe(-1);
  }
});

test("info returns the same frozen CalendarInfo on every call", () => {
  const date = of(2081, 1, 1);
  const first = info(date);
  const second = info(of(2081, 1, 1));
  expect(second).toBe(first);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.tithi)).toBe(true);
  expect(Object.isFrozen(first.events)).toBe(true);
});

test("every coverage day returns a frozen value object with a frozen events array", () => {
  const range = coverage();
  for (const date of range) {
    const calendarInfo = info(date);
    expect(info(date)).toBe(calendarInfo);
    expect(Object.isFrozen(calendarInfo)).toBe(true);
    expect(Object.isFrozen(calendarInfo.events)).toBe(true);
  }
  // Days with no data share one frozen empty object.
  expect(info(of(2077, 1, 2))).toBe(info(of(2090, 1, 1)));
});

test("build() builds the tables in under 3 ms (time reported, not asserted)", () => {
  // The v8 coverage provider slows this down to about 4 ms; without coverage the first call takes
  // 1.4 to 1.7 ms on the reference machine.
  const start = performance.now();
  build();
  const ms = performance.now() - start;
  console.log(`patro build(): ${ms.toFixed(3)} ms`);
});
