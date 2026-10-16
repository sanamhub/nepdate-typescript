// Parsing (PARSING §1, §2): charCodeAt loops, no regex, no split, no substring.

import { type ErrorKind, NepDateError } from "./errors.js";

const STRICT_SEPARATOR = new Uint8Array(128);
for (const code of [0x2d, 0x2f, 0x2e, 0x5f, 0x5c, 0x20, 0x7c]) STRICT_SEPARATOR[code] = 1;

function fail(kind: ErrorKind, message: string): never {
  throw new NepDateError(kind, message);
}

/**
 * Strict parse (PARSING §1): the three groups as `[year, month, day]`. Separators are marked in a
 * `Uint8Array(128)`; ASCII and Devanagari digits accumulate as integers, at most 4 per group.
 */
export function strictParts(input: string): [number, number, number] {
  const groups: number[] = [];
  let current = 0;
  let digits = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    if (c >= 0x30 && c <= 0x39) {
      if (groups.length === 3) fail("wrong-group-count", "a fourth group");
      if (digits === 4) fail("number-too-long", "a group has more than 4 digits");
      current = current * 10 + (c - 0x30);
      digits++;
    } else if (c >= 0x0966 && c <= 0x096f) {
      if (groups.length === 3) fail("wrong-group-count", "a fourth group");
      if (digits === 4) fail("number-too-long", "a group has more than 4 digits");
      current = current * 10 + (c - 0x0966);
      digits++;
    } else if (c === 0x0964 || (c < 128 && STRICT_SEPARATOR[c] === 1)) {
      if (digits > 0) {
        groups.push(current);
        current = 0;
        digits = 0;
      }
    } else {
      fail("invalid-character", "invalid character");
    }
  }
  if (digits > 0) groups.push(current);
  if (groups.length !== 3) fail("wrong-group-count", "need year, month and day");
  return [groups[0] as number, groups[1] as number, groups[2] as number];
}
