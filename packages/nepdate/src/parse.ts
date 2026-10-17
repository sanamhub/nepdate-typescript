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

// ---- lenient (PARSING §2) ----

const MONTH_TOKEN = new Map<string, number>();
for (const [month, names] of [
  [1, ["baishakh", "baisakh", "baishak", "vaishakh", "vaisakh", "bai", "बैशाख", "वैशाख", "बैसाख"]],
  [2, ["jestha", "jeth", "jyestha", "jes", "जेठ", "जेष्ठ", "ज्येष्ठ"]],
  [3, ["ashad", "ashadh", "asar", "asadh", "asa", "असार", "आषाढ", "असाढ"]],
  [4, ["shrawan", "shravan", "srawan", "sawan", "saun", "shr", "साउन", "श्रावण", "सावन"]],
  [5, ["bhadra", "bhadau", "bha", "भदौ", "भाद्र", "भाद्रपद"]],
  [6, ["ashoj", "asoj", "ashwin", "aso", "असोज", "आश्विन", "असौज"]],
  [7, ["kartik", "kattik", "kar", "कार्तिक", "कात्तिक"]],
  [8, ["mangsir", "mansir", "margashirsha", "man", "मंसिर", "मङ्सिर", "मार्गशीर्ष"]],
  [9, ["poush", "paush", "push", "pus", "pou", "पुष", "पौष", "पुस"]],
  [10, ["magh", "mag", "माघ"]],
  [11, ["falgun", "phalgun", "fagun", "fal", "फागुन", "फाल्गुन"]],
  [12, ["chaitra", "chait", "cha", "चैत", "चैत्र"]],
] as const) {
  for (const name of names) MONTH_TOKEN.set(name, month);
}

const ERA = new Set(["bs", "b.s.", "b.s", "vs", "v.s.", "v.s", "बि.सं.", "वि.सं.", "बि.सं", "वि.सं"]);

// "Case-insensitive" is str.lower() onto ASCII (PARSING §2): A-Z and the Kelvin sign fold, and
// nothing else (the long s and dotless i do not).
function foldChar(code: number): number {
  if (code >= 0x41 && code <= 0x5a) return code + 0x20;
  if (code === 0x212a) return 0x6b;
  return code;
}

function fold(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) out += String.fromCharCode(foldChar(text.charCodeAt(i)));
  return out;
}

type LenientToken =
  | { readonly kind: "month"; readonly month: number }
  | { readonly kind: "num"; readonly value: number; readonly digits: number }
  | { readonly kind: "word" };

function isAsciiDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39;
}

function isLenientSeparator(code: number): boolean {
  return (
    code === 0x2d || // -
    code === 0x2f || // /
    code === 0x5f || // _
    code === 0x5c || // backslash
    code === 0x20 || // space
    code === 0x0964 || // danda
    code === 0x7c || // |
    code === 0x2c // ,
  );
}

function classifyPiece(piece: string, tokens: LenientToken[]): void {
  if (piece === "") return;
  if (piece === "गते" || piece === "मिति") return;
  const folded = fold(piece);
  if (ERA.has(folded)) return;
  const month = MONTH_TOKEN.get(folded);
  if (month !== undefined) {
    tokens.push({ kind: "month", month });
    return;
  }
  let allDigits = true;
  for (let i = 0; i < piece.length; i++) {
    if (!isAsciiDigit(piece.charCodeAt(i))) {
      allDigits = false;
      break;
    }
  }
  if (allDigits) {
    if (piece.length > 4) fail("number-too-long", "a number has more than 4 digits");
    let value = 0;
    for (let i = 0; i < piece.length; i++) value = value * 10 + (piece.charCodeAt(i) - 0x30);
    tokens.push({ kind: "num", value, digits: piece.length });
    return;
  }
  tokens.push({ kind: "word" });
}

function tokenizeLenient(input: string): LenientToken[] {
  const tokens: LenientToken[] = [];
  let chunk = "";
  let digitsAndDots = true;
  const flush = (): void => {
    if (chunk === "") return;
    if (digitsAndDots) {
      let piece = "";
      for (let i = 0; i < chunk.length; i++) {
        const c = chunk.charCodeAt(i);
        if (c === 0x2e) {
          classifyPiece(piece, tokens);
          piece = "";
        } else piece += String.fromCharCode(c);
      }
      classifyPiece(piece, tokens);
    } else {
      classifyPiece(chunk, tokens);
    }
  };
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    if (code >= 0x0966 && code <= 0x096f) code = code - 0x0966 + 0x30;
    if (code === 0x200c || code === 0x200d) continue;
    if (isLenientSeparator(code)) {
      flush();
      chunk = "";
      digitsAndDots = true;
    } else {
      chunk += String.fromCharCode(code);
      if (!isAsciiDigit(code) && code !== 0x2e) digitsAndDots = false;
    }
  }
  flush();
  return tokens;
}

/**
 * Lenient parse (PARSING §2): the three fields as `[year, month, day]`, after NFC normalisation
 * and the closed month-name list. Returns the fields, or throws a parse `NepDateError`.
 */
export function lenientParts(input: string): [number, number, number] {
  const tokens = tokenizeLenient(input);
  const months: number[] = [];
  const nums: { value: number; digits: number }[] = [];
  let words = 0;
  for (const token of tokens) {
    if (token.kind === "month") months.push(token.month);
    else if (token.kind === "num") nums.push(token);
    else words++;
  }

  if (words > 0 || months.length >= 2) fail("unrecognized", "unrecognized input");

  if (months.length === 1) {
    if (nums.length !== 2) fail("unrecognized", "unrecognized input");
    const a = nums[0] as { value: number; digits: number };
    const b = nums[1] as { value: number; digits: number };
    if (a.digits === 4 && b.digits >= 1 && b.digits <= 2) {
      return [a.value, months[0] as number, b.value];
    }
    if (b.digits === 4 && a.digits >= 1 && a.digits <= 2) {
      return [b.value, months[0] as number, a.value];
    }
    fail("ambiguous", "ambiguous input");
  }

  if (nums.length !== 3) fail("unrecognized", "unrecognized input");
  const a = nums[0] as { value: number; digits: number };
  const b = nums[1] as { value: number; digits: number };
  const c = nums[2] as { value: number; digits: number };
  if (a.digits === 4) return [a.value, b.value, c.value];
  if (c.digits === 4) return [c.value, b.value, a.value];
  fail("ambiguous", "ambiguous input");
}
