// Date formatters: short and long (FORMATTING §3, §4), built from precomputed parts with
// Array.prototype.join so the result is a flat string (ADR-0002 §8).

import { digitText, yearText } from "./digits.js";
import type { Lang } from "./lang.js";
import { monthName, monthShortName, weekdayName } from "./names.js";

/** Order of the three fields in `short` (the C# `DateFormats`, same order). */
export type DateOrder = "ymd" | "ydm" | "myd" | "mdy" | "dym" | "dmy";

/** The separator between fields in `short`. */
export type Separator = "/" | "\\" | "." | "_" | "-" | " ";

/**
 * `short`: the three fields in `order`, joined by `separator` (FORMATTING §3). `pad` zero-pads
 * month and day to two digits; the year is always four digits.
 */
export function shortDate(
  year: number,
  month: number,
  day: number,
  order: DateOrder,
  separator: Separator,
  pad: boolean,
  lang: Lang,
): string {
  const y = yearText(year, lang);
  const m = digitText(month, pad, lang);
  const d = digitText(day, pad, lang);
  const parts: string[] = new Array(3);
  for (let i = 0; i < 3; i++) {
    const code = order.charCodeAt(i);
    parts[i] = code === 0x79 ? y : code === 0x6d ? m : d;
  }
  return parts.join(separator);
}

/**
 * `long`: `[weekday, ]month day[, year]` (FORMATTING §4). `pad` gives the day two digits; the
 * year is always four digits.
 */
export function longDate(
  year: number,
  month: number,
  day: number,
  weekday: number,
  withWeekday: boolean,
  withYear: boolean,
  pad: boolean,
  lang: Lang,
): string {
  const parts: string[] = [];
  if (withWeekday) parts.push(weekdayName(weekday, lang), ", ");
  parts.push(monthName(month, lang), " ", digitText(day, pad, lang));
  if (withYear) parts.push(", ", yearText(year, lang));
  return parts.join("");
}

// ---- pattern format (FORMATTING §5) ----

type Field = "y4" | "y2" | "mF" | "mS" | "m2" | "m1" | "d2" | "d1";
type Token =
  | { readonly kind: "lit"; readonly text: string }
  | { readonly kind: "field"; readonly id: Field };

const PATTERN_CACHE = new Map<string, Token[]>();
const PATTERN_CACHE_MAX = 32;

function compile(pattern: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < pattern.length) {
    const c = pattern.charCodeAt(i);
    if (c === 0x5c) {
      // `\x` writes the literal `x`; a trailing `\` writes nothing.
      if (i + 1 < pattern.length) tokens.push({ kind: "lit", text: pattern[i + 1] as string });
      i += 2;
    } else if (c === 0x27) {
      // `'...'` is literal text; an unterminated quote runs to the end.
      let j = i + 1;
      while (j < pattern.length && pattern.charCodeAt(j) !== 0x27) j++;
      tokens.push({ kind: "lit", text: pattern.slice(i + 1, j) });
      i = j < pattern.length ? j + 1 : j;
    } else if (c === 0x79 || c === 0x4d || c === 0x64) {
      let j = i;
      while (j < pattern.length && pattern.charCodeAt(j) === c) j++;
      const length = j - i;
      if (c === 0x79) tokens.push({ kind: "field", id: length >= 4 ? "y4" : "y2" });
      else if (c === 0x4d) {
        tokens.push({
          kind: "field",
          id: length >= 4 ? "mF" : length === 3 ? "mS" : length === 2 ? "m2" : "m1",
        });
      } else tokens.push({ kind: "field", id: length === 2 ? "d2" : "d1" });
      i = j;
    } else {
      let j = i;
      while (j < pattern.length) {
        const cc = pattern.charCodeAt(j);
        if (cc === 0x5c || cc === 0x27 || cc === 0x79 || cc === 0x4d || cc === 0x64) break;
        j++;
      }
      tokens.push({ kind: "lit", text: pattern.slice(i, j) });
      i = j;
    }
  }
  return tokens;
}

function compiledTokens(pattern: string): Token[] {
  const hit = PATTERN_CACHE.get(pattern);
  if (hit !== undefined) return hit;
  const tokens = compile(pattern);
  PATTERN_CACHE.set(pattern, tokens);
  if (PATTERN_CACHE.size > PATTERN_CACHE_MAX) {
    const oldest = PATTERN_CACHE.keys().next().value;
    if (oldest !== undefined) PATTERN_CACHE.delete(oldest);
  }
  return tokens;
}

function fieldText(id: Field, year: number, month: number, day: number, lang: Lang): string {
  switch (id) {
    case "y4":
      return yearText(year, lang);
    case "y2":
      return digitText(year % 100, true, lang);
    case "mF":
      return monthName(month, lang);
    case "mS":
      return monthShortName(month, lang);
    case "m2":
      return digitText(month, true, lang);
    case "m1":
      return digitText(month, false, lang);
    case "d2":
      return digitText(day, true, lang);
    case "d1":
      return digitText(day, false, lang);
  }
}

/**
 * `format` (FORMATTING §5). The standard patterns `""`, `G`, `g`, `d` (default display), `D`
 * (long) and `s` (`YYYY-MM-DD`) are handled directly; every other pattern is compiled once and
 * cached.
 */
export function formatDate(
  year: number,
  month: number,
  day: number,
  weekday: number,
  pattern: string,
  lang: Lang,
): string {
  if (pattern === "" || pattern === "G" || pattern === "g" || pattern === "d") {
    return shortDate(year, month, day, "ymd", "/", true, lang);
  }
  if (pattern === "D") return longDate(year, month, day, weekday, false, true, true, lang);
  if (pattern === "s") return shortDate(year, month, day, "ymd", "-", true, lang);
  const tokens = compiledTokens(pattern);
  const parts: string[] = [];
  for (const token of tokens) {
    if (token.kind === "lit") parts.push(token.text);
    else parts.push(fieldText(token.id, year, month, day, lang));
  }
  return parts.join("");
}

/** Internal: the number of compiled patterns in the cache (for the eviction test). */
export function formatCacheSize(): number {
  return PATTERN_CACHE.size;
}
