// Calendar tables, built once at module load from the packed month lengths (ADR-0002 §5).

import { MAX_YEAR, MIN_YEAR, PACKED_MONTH_LENGTHS } from "./calendar.gen.js";

/** Number of BS years in the range (299). */
export const YEARS: number = MAX_YEAR - MIN_YEAR + 1;
/** Number of BS months in the range (3588). */
export const MONTHS: number = YEARS * 12;

/** Length of month index `i = (year - MIN_YEAR) * 12 + month - 1`, 29..32. */
export const MONTH_LENGTHS: Uint8Array = new Uint8Array(MONTHS);
/** Serial of the first day of month index `i`; `MONTH_START[MONTHS]` is the total day count. */
export const MONTH_START: Int32Array = new Int32Array(MONTHS + 1);
/** Serial of 1 Baishakh of year `MIN_YEAR + i`; `YEAR_START[YEARS]` is the total day count. */
export const YEAR_START: Int32Array = new Int32Array(YEARS + 1);

// Base64 by hand: `atob` and `Buffer` are not in every runtime's type library, and the string is
// short (1196 characters).
/** Internal: the 6-bit value of one base64 character. Exported for the decoder test. */
export function base64Value(code: number): number {
  if (code >= 65 && code <= 90) return code - 65; // A-Z
  if (code >= 97 && code <= 122) return code - 71; // a-z
  if (code >= 48 && code <= 57) return code + 4; // 0-9
  return code === 43 ? 62 : 63; // + or /
}

/** Internal: decodes `PACKED_MONTH_LENGTHS` and fills the three tables. Exported for the load-time test. */
export function build(): void {
  const text = PACKED_MONTH_LENGTHS;
  let month = 0;
  for (let c = 0; c < text.length && month < MONTHS; c += 4) {
    // Four characters carry 24 bits, that is 3 bytes or 12 months. Padding "=" only ever follows
    // the last month, so the loop stops on `month` before it reads one.
    const bits =
      (base64Value(text.charCodeAt(c)) << 18) |
      (base64Value(text.charCodeAt(c + 1)) << 12) |
      (base64Value(text.charCodeAt(c + 2)) << 6) |
      base64Value(text.charCodeAt(c + 3));
    for (let b = 16; b >= 0 && month < MONTHS; b -= 8) {
      const byte = (bits >> b) & 0xff;
      for (let shift = 0; shift < 8 && month < MONTHS; shift += 2) {
        MONTH_LENGTHS[month++] = 29 + ((byte >> shift) & 3);
      }
    }
  }
  for (let i = 0; i < MONTHS; i++) {
    MONTH_START[i + 1] = (MONTH_START[i] as number) + (MONTH_LENGTHS[i] as number);
  }
  for (let y = 0; y <= YEARS; y++) YEAR_START[y] = MONTH_START[y * 12] as number;
}

build();
