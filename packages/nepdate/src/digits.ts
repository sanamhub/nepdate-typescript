// Digits and the precomputed digit tables the formatters use (ADR-0002 §8).

import { MAX_YEAR, MIN_YEAR } from "./calendar.gen.js";
import type { Lang } from "./lang.js";

const ASCII_ZERO = 0x30;
const DEVANAGARI_ZERO = 0x0966;

/**
 * `n` (an integer) in Devanagari digits, zero-padded to at least `minWidth` digits. Digits are
 * produced by the char-code offset 0x0966; `Intl.NumberFormat` is never used here because it
 * inserts group separators such as "२,०८१".
 * @example
 * toNepaliDigits(2081); // => "२०८१"
 * toNepaliDigits(15, 2); // => "१५"
 */
export function toNepaliDigits(n: number, minWidth = 0): string {
  const digits = String(n < 0 ? -n : n).padStart(minWidth, "0");
  let out = n < 0 ? "-" : "";
  for (let i = 0; i < digits.length; i++) {
    out += String.fromCharCode(digits.charCodeAt(i) - ASCII_ZERO + DEVANAGARI_ZERO);
  }
  return out;
}

// Tables built once at module load: ASCII and Devanagari strings for 0..99 with and without
// padding, and for every supported year.
const COUNT = 100;
const ASCII: string[] = new Array(COUNT);
const ASCII_PAD: string[] = new Array(COUNT);
const NE: string[] = new Array(COUNT);
const NE_PAD: string[] = new Array(COUNT);
for (let i = 0; i < COUNT; i++) {
  const text = String(i);
  ASCII[i] = text;
  ASCII_PAD[i] = text.length === 1 ? `0${text}` : text;
  NE[i] = toNepaliDigits(i);
  NE_PAD[i] = toNepaliDigits(i, 2);
}

const YEARS = MAX_YEAR - MIN_YEAR + 1;
const ASCII_YEAR: string[] = new Array(YEARS);
const NE_YEAR: string[] = new Array(YEARS);
for (let y = MIN_YEAR; y <= MAX_YEAR; y++) {
  ASCII_YEAR[y - MIN_YEAR] = String(y);
  NE_YEAR[y - MIN_YEAR] = toNepaliDigits(y);
}

/** Internal: `n` (0..99) as one or two digits, padded when `pad`. */
export function digitText(n: number, pad: boolean, lang: Lang): string {
  return lang === "ne"
    ? ((pad ? NE_PAD : NE)[n] as string)
    : ((pad ? ASCII_PAD : ASCII)[n] as string);
}

/** Internal: the 4-digit year `y` in the requested script. */
export function yearText(y: number, lang: Lang): string {
  return lang === "ne" ? (NE_YEAR[y - MIN_YEAR] as string) : (ASCII_YEAR[y - MIN_YEAR] as string);
}
