import { type Lang, NepaliDate } from "nepdate-core";

/**
 * `HTMLElement`, or an empty class where there is no DOM (Node, SSR builds), so the module loads
 * anywhere and only `defineElements()` needs a browser.
 */
export const ElementBase: typeof HTMLElement =
  typeof HTMLElement === "undefined" ? (class {} as unknown as typeof HTMLElement) : HTMLElement;

/**
 * Reads a BS date attribute such as "2081-04-15" or "2081/04/15".
 * @returns The date, or `null` for a missing, empty or unparseable value.
 */
export function parseDateAttribute(value: string | null): NepaliDate | null {
  if (value === null || value.trim() === "") return null;
  return NepaliDate.tryParse(value.trim());
}

/**
 * The element's language: `ne` when its `lang` attribute is `ne`, else `en`.
 * @returns `"en"` or `"ne"`.
 */
export function langOf(element: HTMLElement): Lang {
  return element.getAttribute("lang") === "ne" ? "ne" : "en";
}

/** The elements' own words (button names, validation messages) in English and Nepali. */
export const TEXT = {
  en: {
    previous: "Previous month",
    next: "Next month",
    month: "Month",
    year: "Year",
    choose: "Choose a date",
    invalid: "Enter a BS date such as 2081/04/15.",
    tooEarly: "Choose a date on or after",
    tooLate: "Choose a date on or before",
    missing: "Enter a date.",
  },
  ne: {
    previous: "अघिल्लो महिना",
    next: "अर्को महिना",
    month: "महिना",
    year: "वर्ष",
    choose: "मिति छान्नुहोस्",
    invalid: "२०८१/०४/१५ जस्तै वि.सं. मिति लेख्नुहोस्।",
    tooEarly: "यो मिति वा पछिको मिति छान्नुहोस्:",
    tooLate: "यो मिति वा अघिको मिति छान्नुहोस्:",
    missing: "मिति लेख्नुहोस्।",
  },
} as const;
