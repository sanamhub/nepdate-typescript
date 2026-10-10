// Devanagari digits (U+0966..U+096F). T3-01 exports this as toNepaliDigits.

const ZERO = 0x30;
const DEVANAGARI_ZERO = 0x0966;

/** `n` (an integer) in Devanagari digits, zero-padded to at least `minWidth` digits. */
export function nepaliDigits(n: number, minWidth = 0): string {
  const ascii = String(n < 0 ? -n : n).padStart(minWidth, "0");
  let out = n < 0 ? "-" : "";
  for (let i = 0; i < ascii.length; i++) {
    out += String.fromCharCode(ascii.charCodeAt(i) - ZERO + DEVANAGARI_ZERO);
  }
  return out;
}
