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
 * The element's language, found as a native element finds it: its own `lang` attribute, else the
 * nearest ancestor's, crossing shadow roots to their hosts. `ne` and `ne-*` mean Nepali; anything
 * else, or no `lang` at all, means English.
 * @returns `"en"` or `"ne"`.
 */
export function langOf(element: Element): Lang {
  let node: Element | null = element;
  while (node) {
    const lang = node.closest("[lang]")?.getAttribute("lang");
    if (lang != null) return /^ne(-|$)/i.test(lang) ? "ne" : "en";
    node = (node.getRootNode() as ShadowRoot).host ?? null;
  }
  return "en";
}

const sheets = new Map<string, CSSStyleSheet>();

/**
 * Puts the element's own CSS in its shadow root. Where constructable stylesheets work, every
 * element of a class shares one sheet; elsewhere each root gets a `<style>`.
 */
export function adoptStyle(root: ShadowRoot, css: string): void {
  if ("adoptedStyleSheets" in root && "replaceSync" in CSSStyleSheet.prototype) {
    let sheet = sheets.get(css);
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      sheets.set(css, sheet);
    }
    root.adoptedStyleSheets = [sheet];
  } else {
    const style = document.createElement("style");
    style.textContent = css;
    root.prepend(style);
  }
}

/**
 * Defines properties that mirror attributes, as a native input's `min` or `disabled` do. Frameworks
 * such as React 19 set a property when the element has one, so each attribute needs its property.
 * Each argument is a space-separated list of attribute names: text, present-or-absent and number
 * attributes. The property is the camelCase name (`first-day-of-week` is `firstDayOfWeek`), except
 * `readonly`, which is `readOnly` as on a native input.
 */
export function reflect(target: object, texts: string, booleans: string, numbers: string): void {
  for (const [kind, names] of [texts, booleans, numbers].entries()) {
    for (const attribute of names.split(" ")) {
      const property =
        attribute === "readonly"
          ? "readOnly"
          : attribute.replace(/-(.)/g, (_, c) => c.toUpperCase());
      Object.defineProperty(target, property, {
        configurable: true,
        get(this: Element) {
          if (kind === 1) return this.hasAttribute(attribute);
          const value = this.getAttribute(attribute);
          return kind === 2 ? Number(value) || 0 : (value ?? "");
        },
        set(this: Element, value: unknown) {
          if (kind === 1) this.toggleAttribute(attribute, Boolean(value));
          else this.setAttribute(attribute, String(value));
        },
      });
    }
  }
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
    unavailable: "This date can't be chosen.",
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
    unavailable: "यो मिति छान्न मिल्दैन।",
  },
} as const;
