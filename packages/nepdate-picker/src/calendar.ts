import { monthName, NepaliDate, toNepaliDigits, weekdayName, weekdayShortName } from "nepdate-core";
import { ElementBase, langOf, parseDateAttribute, TEXT } from "./base.js";
import {
  GRID_ROWS,
  type GridKey,
  type GridOptions,
  monthGrid,
  moveFocus,
  weekdayOrder,
} from "./grid.js";

/** Parts every calendar exposes for `::part()` styling. `nepdate-input` forwards them all. */
export const CALENDAR_PARTS: readonly string[] = [
  "header",
  "previous",
  "next",
  "heading",
  "month-select",
  "year-select",
  "grid",
  "weekday",
  "day",
  "selected",
  "today",
  "disabled",
  "gregorian",
];

const KEYS: Record<string, GridKey> = {
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
};

// Structure only. Colours, sizes and spacing come from the page (::part) or theme.css.
const STYLE = `
:host { display: inline-block; }
:host([hidden]) { display: none; }
[part~="header"] { display: flex; align-items: center; gap: 0.25em; }
[part~="heading"] { display: flex; flex: 1; gap: 0.25em; justify-content: center; }
button, select { font: inherit; color: inherit; }
[part~="grid"] { border-collapse: collapse; }
[part~="weekday"] { font-weight: inherit; }
td { padding: 0; text-align: center; }
[part~="day"] { display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
  min-width: 2.25em; min-height: 2.25em; margin: 0; padding: 0; border: 0; background: none; cursor: pointer; }
[part~="day"][aria-disabled="true"] { cursor: default; }
[part~="day"][hidden] { display: none; }
[part~="gregorian"] { font-size: 0.65em; opacity: 0.7; }
.label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

/**
 * `<nepdate-calendar>`: one BS month as a grid of days, chosen with a click or the keyboard.
 *
 * Attributes: `value`, `min`, `max` (BS dates such as `2081-04-15`), `lang` (`en` or `ne`),
 * `first-day-of-week` (0 = Sunday, the default), `show-gregorian`.
 * Fires `change` when the visitor chooses a day. Style it with `::part()`; see the README.
 * @example
 * NepDateCalendarElement.observedAttributes.includes("show-gregorian"); // => true
 */
export class NepDateCalendarElement extends ElementBase {
  static readonly observedAttributes: string[] = [
    "value",
    "min",
    "max",
    "lang",
    "first-day-of-week",
    "show-gregorian",
  ];

  #value: NepaliDate | null = null;
  #focused: NepaliDate | null = null;
  #isDateDisallowed: ((date: NepaliDate) => boolean) | null = null;
  #dayParts: ((date: NepaliDate) => readonly string[]) | null = null;
  #root: ShadowRoot | null = null;
  #previous!: HTMLButtonElement;
  #next!: HTMLButtonElement;
  #monthSelect!: HTMLSelectElement;
  #yearSelect!: HTMLSelectElement;
  #label!: HTMLDivElement;
  #weekdays!: HTMLTableCellElement[];
  #days!: HTMLButtonElement[];

  /** The chosen date as `YYYY-MM-DD` (BS), or `""` when none. */
  get value(): string {
    return this.#value?.toJSON() ?? "";
  }
  set value(value: string) {
    this.#value = parseDateAttribute(value);
    if (this.#value) this.#focused = this.#value;
    this.#render();
  }

  /** The chosen date, or `null`. */
  get date(): NepaliDate | null {
    return this.#value;
  }
  set date(date: NepaliDate | null) {
    this.value = date?.toJSON() ?? "";
  }

  /** Disables extra days, for example Saturdays. Set it as a property. */
  get isDateDisallowed(): ((date: NepaliDate) => boolean) | null {
    return this.#isDateDisallowed;
  }
  set isDateDisallowed(fn: ((date: NepaliDate) => boolean) | null) {
    this.#isDateDisallowed = fn;
    this.#render();
  }

  /**
   * Adds part names to a day, for example `["holiday"]` from `nepdate-patro`, so a page can style
   * `nepdate-calendar::part(holiday)`. Set it as a property.
   */
  get dayParts(): ((date: NepaliDate) => readonly string[]) | null {
    return this.#dayParts;
  }
  set dayParts(fn: ((date: NepaliDate) => readonly string[]) | null) {
    this.#dayParts = fn;
    this.#render();
  }

  /** The month on show, as its first day. */
  get month(): NepaliDate {
    return (this.#focused ?? this.#value ?? NepaliDate.today()).firstOfMonth();
  }

  /** Moves keyboard focus to the focused day (the chosen one, or today). */
  focusDay(): void {
    this.#dayButton(this.#currentFocus())?.focus();
  }

  connectedCallback(): void {
    if (!this.#root) this.#build();
    if (!this.#value && this.hasAttribute("value"))
      this.#value = parseDateAttribute(this.getAttribute("value"));
    this.#render();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "value") {
      this.#value = parseDateAttribute(value);
      if (this.#value) this.#focused = this.#value;
    }
    this.#render();
  }

  #options(): GridOptions {
    return {
      firstDayOfWeek: Number(this.getAttribute("first-day-of-week") ?? 0),
      min: parseDateAttribute(this.getAttribute("min")),
      max: parseDateAttribute(this.getAttribute("max")),
      isDateDisallowed: this.#isDateDisallowed,
    };
  }

  #currentFocus(): NepaliDate {
    const options = this.#options();
    // Keyboard moves clamp already; this covers a value or today outside min/max.
    return clampDate(this.#focused ?? this.#value ?? NepaliDate.today(), options);
  }

  #build(): void {
    const root = this.attachShadow({ mode: "open" });
    this.#root = root;
    const style = document.createElement("style");
    style.textContent = STYLE;

    const header = el("div", "header");
    this.#previous = el("button", "previous");
    this.#previous.type = "button";
    this.#previous.textContent = "‹";
    this.#next = el("button", "next");
    this.#next.type = "button";
    this.#next.textContent = "›";
    const heading = el("div", "heading");
    // The grid's name, and what a screen reader hears when the month changes.
    this.#label = document.createElement("div");
    this.#label.className = "label";
    this.#label.id = "label";
    this.#label.setAttribute("aria-live", "polite");
    this.#monthSelect = el("select", "month-select");
    this.#yearSelect = el("select", "year-select");
    heading.append(this.#monthSelect, this.#yearSelect);
    header.append(this.#previous, heading, this.#next);

    const table = el("table", "grid");
    table.setAttribute("role", "grid");
    table.setAttribute("aria-labelledby", "label");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    this.#weekdays = Array.from({ length: 7 }, () => {
      const th = el("th", "weekday");
      th.scope = "col";
      headRow.append(th);
      return th;
    });
    head.append(headRow);
    const body = document.createElement("tbody");
    this.#days = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      const tr = document.createElement("tr");
      for (let col = 0; col < 7; col++) {
        const td = document.createElement("td");
        const button = el("button", "day");
        button.type = "button";
        button.tabIndex = -1;
        td.append(button);
        tr.append(td);
        this.#days.push(button);
      }
      body.append(tr);
    }
    table.append(head, body);
    root.append(style, header, this.#label, table);

    this.#previous.addEventListener("click", () => this.#showMonth(-1));
    this.#next.addEventListener("click", () => this.#showMonth(1));
    this.#monthSelect.addEventListener("change", () => this.#jump());
    this.#yearSelect.addEventListener("change", () => this.#jump());
    body.addEventListener("click", (event) => {
      const button = (event.target as Element).closest("button");
      if (button) this.#choose(button);
    });
    body.addEventListener("keydown", (event) => this.#onKey(event));
  }

  #onKey(event: KeyboardEvent): void {
    const button = (event.target as Element).closest("button");
    if (!button?.dataset.date) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.#choose(button);
      return;
    }
    const base = KEYS[event.key];
    if (!base) return;
    const key = (
      event.shiftKey && (base === "PageUp" || base === "PageDown") ? `Shift+${base}` : base
    ) as GridKey;
    event.preventDefault();
    this.#focused = moveFocus(NepaliDate.parse(button.dataset.date), key, this.#options());
    this.#render();
    this.focusDay();
  }

  #choose(button: HTMLButtonElement): void {
    const iso = button.dataset.date;
    if (!iso || button.getAttribute("aria-disabled") === "true") return;
    const date = NepaliDate.parse(iso);
    this.#focused = date;
    const changed = !this.#value?.equals(date);
    this.#value = date;
    this.#render();
    this.focusDay();
    if (changed) this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  #showMonth(step: -1 | 1): void {
    this.#focused = moveFocus(
      this.#currentFocus(),
      step < 0 ? "PageUp" : "PageDown",
      this.#options(),
    );
    this.#render();
  }

  #jump(): void {
    const year = Number(this.#yearSelect.value);
    const month = Number(this.#monthSelect.value);
    const day = Math.min(this.#currentFocus().day, NepaliDate.of(year, month, 1).monthLength);
    this.#focused = clampDate(NepaliDate.of(year, month, day), this.#options());
    this.#render();
  }

  #dayButton(date: NepaliDate): HTMLButtonElement | undefined {
    const iso = date.toJSON();
    return this.#days?.find((button) => button.dataset.date === iso);
  }

  #render(): void {
    if (!this.#root) return;
    const lang = langOf(this);
    const text = TEXT[lang];
    const options = this.#options();
    const focus = this.#currentFocus();
    const min = options.min ?? NepaliDate.MIN;
    const max = options.max ?? NepaliDate.MAX;
    const showGregorian = this.hasAttribute("show-gregorian");
    const digits = (n: number) => (lang === "ne" ? toNepaliDigits(n) : String(n));

    this.#previous.setAttribute("aria-label", text.previous);
    this.#next.setAttribute("aria-label", text.next);
    this.#previous.disabled = focus.year * 12 + focus.month <= min.year * 12 + min.month;
    this.#next.disabled = focus.year * 12 + focus.month >= max.year * 12 + max.month;
    this.#monthSelect.setAttribute("aria-label", text.month);
    this.#yearSelect.setAttribute("aria-label", text.year);
    fillSelect(
      this.#monthSelect,
      1,
      12,
      focus.month,
      (m) => monthName(m, lang),
      (m) =>
        (focus.year === min.year && m < min.month) || (focus.year === max.year && m > max.month),
    );
    fillSelect(this.#yearSelect, min.year, max.year, focus.year, digits, () => false);
    const label = `${monthName(focus.month, lang)} ${digits(focus.year)}`;
    if (this.#label.textContent !== label) this.#label.textContent = label;

    const order = weekdayOrder(options);
    this.#weekdays.forEach((th, i) => {
      const weekday = order[i] ?? 0;
      th.textContent = weekdayShortName(weekday, lang);
      th.abbr = weekdayName(weekday, lang);
    });

    const cells = monthGrid(focus.year, focus.month, options).flat();
    cells.forEach((cell, i) => {
      const button = this.#days[i];
      if (!button) return;
      const td = button.parentElement as HTMLTableCellElement;
      if (!cell) {
        button.hidden = true;
        button.replaceChildren();
        button.removeAttribute("data-date");
        td.removeAttribute("role");
        td.removeAttribute("aria-selected");
        return;
      }
      const selected = this.#value?.equals(cell.date) ?? false;
      const parts = ["day"];
      if (selected) parts.push("selected");
      if (cell.isToday) parts.push("today");
      if (cell.disabled) parts.push("disabled");
      for (const name of this.#dayParts?.(cell.date) ?? [])
        if (/^[a-z][a-z0-9-]*$/.test(name)) parts.push(name);
      button.hidden = false;
      button.dataset.date = cell.date.toJSON();
      button.setAttribute("part", parts.join(" "));
      button.setAttribute("aria-label", cell.date.long({ weekday: true, lang }));
      button.tabIndex = cell.date.equals(focus) ? 0 : -1;
      toggleAttribute(button, "aria-disabled", cell.disabled ? "true" : null);
      toggleAttribute(button, "aria-current", cell.isToday ? "date" : null);
      td.setAttribute("role", "gridcell");
      td.setAttribute("aria-selected", String(selected));
      button.replaceChildren(digits(cell.date.day));
      if (showGregorian) {
        const ad = el("span", "gregorian");
        ad.setAttribute("aria-hidden", "true");
        ad.textContent = digits(cell.gregorian.day);
        button.append(ad);
      }
    });
  }
}

function clampDate(date: NepaliDate, options: GridOptions): NepaliDate {
  const min = options.min ?? NepaliDate.MIN;
  const max = options.max ?? NepaliDate.MAX;
  if (NepaliDate.compare(date, min) < 0) return min;
  if (NepaliDate.compare(date, max) > 0) return max;
  return date;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, part: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.setAttribute("part", part);
  return node;
}

function toggleAttribute(node: Element, name: string, value: string | null): void {
  if (value === null) node.removeAttribute(name);
  else node.setAttribute(name, value);
}

function fillSelect(
  select: HTMLSelectElement,
  from: number,
  to: number,
  current: number,
  label: (n: number) => string,
  disabled: (n: number) => boolean,
): void {
  const count = to - from + 1;
  if (select.options.length !== count || select.options[0]?.value !== String(from)) {
    select.replaceChildren(
      ...Array.from({ length: count }, (_, i) => {
        const option = document.createElement("option");
        option.value = String(from + i);
        return option;
      }),
    );
  }
  for (const option of select.options) {
    const n = Number(option.value);
    option.textContent = label(n);
    option.disabled = disabled(n);
  }
  select.value = String(current);
}
