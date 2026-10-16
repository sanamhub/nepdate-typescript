// Date formatters: short and long (FORMATTING §3, §4), built from precomputed parts with
// Array.prototype.join so the result is a flat string (ADR-0002 §8).

import { digitText, yearText } from "./digits.js";
import type { Lang } from "./lang.js";
import { monthName, weekdayName } from "./names.js";

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
