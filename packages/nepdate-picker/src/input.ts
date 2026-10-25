import { NepaliDate } from "nepdate-core";
import { ElementBase, langOf, parseDateAttribute, TEXT } from "./base.js";
import { CALENDAR_PARTS, type NepDateCalendarElement } from "./calendar.js";
import { isSelectable } from "./grid.js";

/** Parts of `nepdate-input` itself; the calendar's parts are forwarded too. */
export const INPUT_PARTS: readonly string[] = ["field", "input", "button", "popover", "calendar"];

const STYLE = `
:host { display: inline-block; }
:host([hidden]) { display: none; }
[part~="field"] { display: flex; align-items: stretch; }
[part~="input"] { font: inherit; color: inherit; min-width: 0; flex: 1; }
[part~="button"] { font: inherit; color: inherit; display: inline-grid; place-items: center; cursor: pointer; }
[part~="popover"] { position: fixed; inset: auto; margin: 0; }
svg { width: 1.1em; height: 1.1em; }
`;

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';

/**
 * `<nepdate-input>`: a text field for a BS date with a calendar in a popover, usable in a `<form>`
 * like a native input. It submits `YYYY-MM-DD` (BS) under its `name`.
 *
 * Attributes: `name`, `value` (the date, and what a form reset returns to), `min`, `max`, `required`, `disabled`, `placeholder`,
 * `lang` (`en` or `ne`), `first-day-of-week`, `show-gregorian`.
 * Fires `input` and `change` when the date changes.
 * @example
 * NepDateInputElement.formAssociated; // => true
 */
export class NepDateInputElement extends ElementBase {
  static readonly formAssociated: boolean = true;
  static readonly observedAttributes: string[] = [
    "value",
    "min",
    "max",
    "required",
    "disabled",
    "placeholder",
    "lang",
    "first-day-of-week",
    "show-gregorian",
    "aria-label",
  ];

  #internals: ElementInternals;
  #value: NepaliDate | null = null;
  #dirty = false;
  #badInput = false;
  #root: ShadowRoot | null = null;
  #input!: HTMLInputElement;
  #button!: HTMLButtonElement;
  #popover!: HTMLDivElement;
  #calendar!: NepDateCalendarElement;

  constructor() {
    super();
    this.#internals = this.attachInternals();
  }

  /** The date as `YYYY-MM-DD` (BS), or `""`. */
  get value(): string {
    return this.#value?.toJSON() ?? "";
  }
  set value(value: string) {
    this.#dirty = true;
    this.#badInput = false;
    this.#value = parseDateAttribute(value);
    this.#sync();
  }

  /** The date, or `null`. */
  get date(): NepaliDate | null {
    return this.#value;
  }
  set date(date: NepaliDate | null) {
    this.value = date?.toJSON() ?? "";
  }

  /** The calendar inside the popover, to set `isDateDisallowed` or `dayParts` on. */
  get calendar(): NepDateCalendarElement | null {
    return this.#root ? this.#calendar : null;
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }
  get name(): string {
    return this.getAttribute("name") ?? "";
  }
  get validity(): ValidityState {
    return this.#internals.validity;
  }
  get validationMessage(): string {
    return this.#internals.validationMessage;
  }
  checkValidity(): boolean {
    return this.#internals.checkValidity();
  }
  reportValidity(): boolean {
    return this.#internals.reportValidity();
  }

  /** Opens the calendar. */
  showPicker(): void {
    if (this.#root && !this.hasAttribute("disabled") && !this.#popover.matches(":popover-open"))
      this.#popover.showPopover();
  }

  connectedCallback(): void {
    if (!this.#root) this.#build();
    if (!this.#dirty) this.#value = parseDateAttribute(this.getAttribute("value"));
    this.#sync();
  }

  attributeChangedCallback(name: string): void {
    if (name === "value") {
      // Unlike a native input, a changed value attribute sets the date even after the user has
      // edited it: Blazor and server-rendered templates update the attribute, not the property,
      // to push their state. The same date changes nothing, so text that isn't a date stays.
      const date = parseDateAttribute(this.getAttribute("value"));
      if (!sameDate(date, this.#value)) {
        this.#value = date;
        this.#badInput = false;
      }
    }
    this.#sync();
  }

  formResetCallback(): void {
    this.#dirty = false;
    this.#badInput = false;
    this.#value = parseDateAttribute(this.getAttribute("value"));
    this.#sync();
  }

  formDisabledCallback(disabled: boolean): void {
    this.toggleAttribute("disabled", disabled);
  }

  formStateRestoreCallback(state: string | File | FormData | null): void {
    if (typeof state === "string") this.#setDate(parseDateAttribute(state), false);
  }

  #build(): void {
    const root = this.attachShadow({ mode: "open", delegatesFocus: true });
    this.#root = root;
    const style = document.createElement("style");
    style.textContent = STYLE;

    const field = document.createElement("div");
    field.setAttribute("part", "field");
    this.#input = document.createElement("input");
    this.#input.setAttribute("part", "input");
    this.#input.type = "text";
    this.#input.autocomplete = "off";
    this.#input.spellcheck = false;
    this.#button = document.createElement("button");
    this.#button.setAttribute("part", "button");
    this.#button.type = "button";
    this.#button.setAttribute("aria-haspopup", "dialog");
    this.#button.setAttribute("aria-expanded", "false");
    this.#button.innerHTML = ICON;
    field.append(this.#input, this.#button);

    this.#popover = document.createElement("div");
    this.#popover.setAttribute("part", "popover");
    this.#popover.setAttribute("role", "dialog");
    this.#popover.popover = "auto";
    this.#calendar = document.createElement("nepdate-calendar") as NepDateCalendarElement;
    this.#calendar.setAttribute("part", "calendar");
    this.#calendar.setAttribute("exportparts", CALENDAR_PARTS.join(", "));
    this.#popover.append(this.#calendar);
    root.append(style, field, this.#popover);

    // popovertarget, not a click handler: the browser then handles light dismiss and Escape, and a
    // click on the button while open closes the popover instead of reopening it.
    this.#button.popoverTargetElement = this.#popover;
    this.#input.addEventListener("change", (event) => {
      event.stopPropagation();
      this.#fromText();
    });
    this.#input.addEventListener("input", (event) => event.stopPropagation());
    this.#input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" && event.altKey) {
        event.preventDefault();
        this.showPicker();
      } else if (event.key === "Enter") {
        // As in a native input, Enter commits the text and submits the form.
        this.#fromText();
        this.form?.requestSubmit();
      }
    });
    this.#popover.addEventListener("beforetoggle", (event) => {
      if ((event as ToggleEvent).newState === "open") this.#place();
    });
    this.#popover.addEventListener("toggle", (event) => {
      const open = (event as ToggleEvent).newState === "open";
      // Browsers expose popovertarget's state differently; the attribute makes it the same everywhere.
      this.#button.setAttribute("aria-expanded", String(open));
      if (open) {
        // Placed again now that the popover has its real size, and kept beside the field.
        this.#place();
        addEventListener("scroll", this.#onViewportChange, { capture: true, passive: true });
        addEventListener("resize", this.#onViewportChange, { passive: true });
        this.#calendar.focusDay();
      } else {
        removeEventListener("scroll", this.#onViewportChange, { capture: true });
        removeEventListener("resize", this.#onViewportChange);
      }
    });
    this.#popover.addEventListener("keydown", (event) => {
      // popover="auto" closes on Escape by itself; focus goes back to the button that opened it.
      if (event.key === "Escape") this.#button.focus();
    });
    this.#calendar.addEventListener("change", (event) => {
      event.stopPropagation();
      this.#dirty = true;
      this.#setDate(this.#calendar.date, true);
      this.#popover.hidePopover();
      this.#input.focus();
    });
  }

  #fromText(): void {
    const text = this.#input.value.trim();
    this.#dirty = true;
    if (text === "") {
      this.#badInput = false;
      this.#setDate(null, true);
      return;
    }
    let date: NepaliDate | null = null;
    try {
      date = NepaliDate.parseLenient(text);
    } catch {
      date = null;
    }
    // Like a native date input, text that isn't a date leaves the value empty and sets badInput.
    this.#badInput = date === null;
    this.#setDate(date, true);
  }

  #setDate(date: NepaliDate | null, fromUser: boolean): void {
    const changed = !sameDate(date, this.#value);
    this.#value = date;
    if (date) this.#badInput = false;
    this.#sync(fromUser || changed);
    if (fromUser && changed) {
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      this.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  #onViewportChange = (): void => this.#place();

  #place(): void {
    const field = this.#input.parentElement as HTMLElement;
    const rect = field.getBoundingClientRect();
    const height = this.#popover.offsetHeight || 340;
    const below = window.innerHeight - rect.bottom;
    const top =
      below < height + 8 && rect.top > below ? Math.max(8, rect.top - height - 4) : rect.bottom + 4;
    const width = this.#popover.offsetWidth || 300;
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    this.#popover.style.top = `${top}px`;
    this.#popover.style.left = `${left}px`;
  }

  #sync(rewriteText = true): void {
    if (!this.#root) return;
    const lang = langOf(this);
    const text = TEXT[lang];
    const disabled = this.hasAttribute("disabled");
    const min = parseDateAttribute(this.getAttribute("min"));
    const max = parseDateAttribute(this.getAttribute("max"));

    this.#input.disabled = disabled;
    this.#button.disabled = disabled;
    this.#input.required = this.hasAttribute("required");
    this.#input.placeholder =
      this.getAttribute("placeholder") ?? (lang === "ne" ? "२०८१/०४/१५" : "2081/04/15");
    this.#input.setAttribute(
      "aria-label",
      this.getAttribute("aria-label") ?? this.#labelText() ?? text.choose,
    );
    this.#button.setAttribute("aria-label", text.choose);
    this.#popover.setAttribute("aria-label", text.choose);
    for (const name of ["lang", "min", "max", "first-day-of-week", "show-gregorian"]) {
      const value = this.getAttribute(name);
      if (value === null) this.#calendar.removeAttribute(name);
      else this.#calendar.setAttribute(name, value);
    }
    this.#calendar.date = this.#value;
    if (rewriteText && !this.#badInput)
      this.#input.value = this.#value ? this.#value.short({ lang }) : "";
    this.#input.setAttribute("aria-invalid", String(this.#badInput));

    const internals = this.#internals;
    internals.setFormValue(this.value, this.value);
    const range = this.#value && !isSelectable(this.#value, { min, max });
    if (this.#badInput) internals.setValidity({ badInput: true }, text.invalid, this.#input);
    else if (this.hasAttribute("required") && !this.#value)
      internals.setValidity({ valueMissing: true }, text.missing, this.#input);
    else if (range && min && this.#value && NepaliDate.compare(this.#value, min) < 0)
      internals.setValidity(
        { rangeUnderflow: true },
        `${text.tooEarly} ${min.short({ lang })}`,
        this.#input,
      );
    else if (range && max)
      internals.setValidity(
        { rangeOverflow: true },
        `${text.tooLate} ${max.short({ lang })}`,
        this.#input,
      );
    else internals.setValidity({});
  }

  // A <label for> on the host doesn't name the input inside the shadow root, so copy its text.
  #labelText(): string | null {
    const labels = this.#internals.labels;
    if (labels.length === 0) return null;
    const text = Array.from(labels, (label) => label.textContent?.trim() ?? "")
      .join(" ")
      .trim();
    return text === "" ? null : text;
  }
}

function sameDate(a: NepaliDate | null, b: NepaliDate | null): boolean {
  return a === b || (a !== null && b !== null && a.equals(b));
}
