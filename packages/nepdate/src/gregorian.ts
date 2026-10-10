// Gregorian <-> days since 1970-01-01, Howard Hinnant's algorithms (ALGORITHM §5, public domain).
// Callers pass only years 1843..2143 and day counts from EPOCH_UNIX_DAYS on, so every operand of
// `/` and `%` below is non-negative and below 2^31, and `(a / b) | 0` is exact (ADR-0002 §4).

/** A proleptic Gregorian date. A `Temporal.PlainDate` has this shape. */
export interface GregorianDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Days in Gregorian month `m` (1..12) of year `y`. */
export function gregorianMonthLength(y: number, m: number): number {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

/** Days since 1970-01-01 of a valid Gregorian date with `year >= 1`. */
export function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = (y / 400) | 0;
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = (((153 * mp + 2) / 5) | 0) + day - 1;
  const doe = yoe * 365 + ((yoe / 4) | 0) - ((yoe / 100) | 0) + doy;
  return era * 146097 + doe - 719468;
}

/** The Gregorian date `days` after 1970-01-01, for `days >= -719468`. */
export function civilFromDays(days: number): GregorianDate {
  const z = days + 719468;
  const era = (z / 146097) | 0;
  const doe = z - era * 146097;
  const yoe = ((doe - ((doe / 1460) | 0) + ((doe / 36524) | 0) - ((doe / 146096) | 0)) / 365) | 0;
  const doy = doe - (365 * yoe + ((yoe / 4) | 0) - ((yoe / 100) | 0));
  const mp = ((5 * doy + 2) / 153) | 0;
  const day = doy - (((153 * mp + 2) / 5) | 0) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}
