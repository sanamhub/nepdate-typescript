// The patro: tithi, public holidays and events per BS day (shared/spec/PATRO.md). The tables are
// generated; every value object is built and frozen once at module load (ADR-0002 §7).

import { type DateRange, NepaliDate } from "nepdate-core";
import { build, type CalendarInfo } from "./build.js";
import { COVERAGE_FIRST, COVERAGE_LAST } from "./tables.gen.js";

export type { CalendarInfo, Named } from "./build.js";

const DATA = build();

/**
 * What the patro knows about `date`.
 *
 * Never throws: a day without data, and any day outside the coverage, returns the shared frozen
 * empty object (`tithi: null`, `isPublicHoliday: false`, `events: []`). The same call for the same
 * day returns the same object (ADR-0002 §7), so it can be compared by identity.
 * @example
 * info(NepaliDate.of(2081, 2, 15)).events[0]?.en; // => "Republic Day"
 */
export function info(date: NepaliDate): CalendarInfo {
  const serial = NepaliDate.MIN.daysUntil(date);
  if (serial < COVERAGE_FIRST || serial > COVERAGE_LAST) return DATA.empty;
  return DATA.info[serial - COVERAGE_FIRST] as CalendarInfo;
}

/**
 * The smallest range that contains every day with data, BS 2077-01-01..2084-08-20 with the current
 * data. Use it to decide whether to show "no data for this year".
 * @example
 * coverage().length; // => 2793
 */
export function coverage(): DateRange {
  return DATA.coverage;
}

/**
 * Every public holiday, in ascending order.
 * @example
 * publicHolidays().next().value?.toJSON(); // => "2077-01-01"
 */
export function* publicHolidays(): IterableIterator<NepaliDate> {
  yield* DATA.holidays;
}
