// Month and weekday names (FORMATTING §1). The arrays are frozen; no allocation per call.

import type { Lang } from "./lang.js";

const MONTHS_EN = [
  "Baishakh",
  "Jestha",
  "Ashad",
  "Shrawan",
  "Bhadra",
  "Ashoj",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
] as const;

/** Short English month names (D-04: Ashad is `Asa` and Ashoj is `Aso`, not both `Ash`). */
const MONTHS_EN_SHORT = [
  "Bai",
  "Jes",
  "Asa",
  "Shr",
  "Bha",
  "Aso",
  "Kar",
  "Man",
  "Pou",
  "Mag",
  "Fal",
  "Cha",
] as const;

const MONTHS_NE = [
  "बैशाख",
  "जेठ",
  "असार",
  "साउन",
  "भदौ",
  "असोज",
  "कार्तिक",
  "मंसिर",
  "पुष",
  "माघ",
  "फागुन",
  "चैत",
] as const;

const WEEKDAYS_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const WEEKDAYS_EN_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const WEEKDAYS_NE = [
  "आइतवार",
  "सोमवार",
  "मङ्गलवार",
  "बुधवार",
  "बिहिवार",
  "शुक्रवार",
  "शनिवार",
] as const;

const WEEKDAYS_NE_SHORT = ["आइत", "सोम", "मङ्गल", "बुध", "बिहि", "शुक्र", "शनि"] as const;

/**
 * The name of BS month `month` (1..12).
 */
export function monthName(month: number, lang: Lang = "en"): string {
  return (lang === "ne" ? MONTHS_NE : MONTHS_EN)[month - 1] as string;
}

/**
 * The short name of BS month `month` (1..12). Nepali has no customary abbreviation, so `lang`
 * `"ne"` returns the full name.
 */
export function monthShortName(month: number, lang: Lang = "en"): string {
  return lang === "ne" ? (MONTHS_NE[month - 1] as string) : (MONTHS_EN_SHORT[month - 1] as string);
}

/**
 * The name of weekday `weekday` (0 = Sunday).
 */
export function weekdayName(weekday: number, lang: Lang = "en"): string {
  return (lang === "ne" ? WEEKDAYS_NE : WEEKDAYS_EN)[weekday] as string;
}

/**
 * The short name of weekday `weekday` (0 = Sunday).
 */
export function weekdayShortName(weekday: number, lang: Lang = "en"): string {
  return lang === "ne"
    ? (WEEKDAYS_NE_SHORT[weekday] as string)
    : (WEEKDAYS_EN_SHORT[weekday] as string);
}
