import { NepaliDate } from "nepdate-core";
import { adoptStyle, ElementBase, langOf, parseDateAttribute, reflect, TEXT } from "./base.js";
import { CALENDAR_PARTS, type NepDateCalendarElement } from "./calendar.js";

/** Parts of `nepdate-input` itself; the calendar's parts are forwarded too. */
export const INPUT_PARTS: readonly string[] = ["field", "input", "button", "popover", "calendar"];

// Where CSS anchor positioning works, it keeps the popover under the field (or above it, or moved
// sideways, when there is no room) and #place() is not used.
const STYLE = `
:host { display: inline-block; }
:host([hidden]) { display: none; }
[part~="field"] { display: flex; align-items: stretch; anchor-name: --field; }
[part~="input"] { font: inherit; color: inherit; min-width: 0; flex: 1; }
[part~="button"] { font: inherit; color: inherit; display: inline-grid; place-items: center; cursor: pointer; }
[part~="popover"] { position: fixed; inset: auto; margin: 0; }
@supports (anchor-name: --x) {
  [part~="popover"] { position-anchor: --field; top: anchor(bottom); left: anchor(left); margin-top: 4px;
    position-try-fallbacks: flip-block, flip-inline; }
}
svg { width: 1.1em; height: 1.1em; }
`;

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';

// Input types that block implicit submission when a form has no submit button (HTML spec).
const BLOCKING =
  /^(text|search|url|tel|email|password|date|month|week|time|datetime-local|number)$/;

const anchored = (): boolean => CSS.supports("anchor-name", "--x");

/**
 * `<nepdate-input>`: a text field for a BS date with a calendar in a popover, usable in a `<form>`
 * like a native input. It submits `YYYY-MM-DD` (BS) under its `name`.
 *
 * Attributes: `name`, `value` (the date, and what a form reset returns to), `min`, `max`,
 * `required`, `disabled`, `readonly`, `placeholder`, `lang` (`en` or `ne`, else the nearest
 * ancestor's), `first-day-of-week`, `show-gregorian`.
 * Fires `input` and `change` when the date changes. Custom states: `open`, `invalid`,
 * `user-invalid`, for `nepdate-input:state(open)` and the like.
 *
 * @attr name - The form field name.
 * @attr value - The date, `YYYY-MM-DD` in BS, and what a form reset returns to.
 * @attr min - The earliest date that can be chosen.
 * @attr max - The latest date that can be chosen.
 * @attr required - The form needs a date.
 * @attr disabled - No typing, no calendar, not submitted.
 * @attr readonly - No typing and no calendar, but submitted.
 * @attr placeholder - The hint in the empty field.
 * @attr lang - `en` or `ne`; without it, the nearest ancestor's `lang`.
 * @attr first-day-of-week - 0 = Sunday (the default) to 6 = Saturday.
 * @attr show-gregorian - Shows the AD day under each BS day in the calendar.
 * @fires input - The date changed.
 * @fires change - The date changed.
 * @csspart field - The box around the text field and the button.
 * @csspart input - The text field.
 * @csspart button - The button that opens the calendar.
 * @csspart popover - The popover around the calendar.
 * @csspart calendar - The calendar; its own parts are forwarded too.
 * @cssstate open - The calendar is open.
 * @cssstate invalid - The date does not pass validation, as `:invalid`.
 * @cssstate user-invalid - Invalid after the visitor committed a date or the form was submitted, as `:user-invalid`.
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
    "readonly",
    "placeholder",
    "lang",
    "first-day-of-week",
    "show-gregorian",
    "aria-label",
  ];

  /** The form field name; reflects the `name` attribute. */
  declare name: string;
  /** Reflects the `disabled` attribute. */
  declare disabled: boolean;
  /** Reflects the `required` attribute. */
  declare required: boolean;
  /** No typing and no calendar, but the date still submits; reflects the `readonly` attribute. */
  declare readOnly: boolean;
  /** The earliest date that can be chosen; reflects the `min` attribute. */
  declare min: string;
  /** The latest date that can be chosen; reflects the `max` attribute. */
  declare max: string;
  /** Reflects the `placeholder` attribute. */
  declare placeholder: string;
  /** 0 = Sunday to 6 = Saturday; reflects the `first-day-of-week` attribute. */
  declare firstDayOfWeek: number;
  /** Shows the AD day in the calendar; reflects the `show-gregorian` attribute. */
  declare showGregorian: boolean;

  #internals: ElementInternals;
  #value: NepaliDate | null = null;
  #dirty = false;
  #badInput = false;
  // Set once the visitor commits a date or the form checks validity, as for :user-invalid.
  #touched = false;
  #customError = "";
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

  /** Whether the calendar is open. */
  get open(): boolean {
    return this.#root ? this.#popover.matches(":popover-open") : false;
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }
  get labels(): NodeList {
    return this.#internals.labels;
  }
  get willValidate(): boolean {
    return this.#internals.willValidate;
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
  /** As on a native input: a message makes the field invalid with it, `""` clears it. */
  setCustomValidity(message: string): void {
    this.#customError = String(message);
    if (this.#root) this.#validate();
  }

  /** Opens the calendar, unless the field is disabled or read-only. */
  showPicker(): void {
    if (this.#root && !this.disabled && !this.readOnly && !this.open) this.#popover.showPopover();
  }

  /** Closes the calendar. */
  hidePicker(): void {
    if (this.open) this.#popover.hidePopover();
  }

  connectedCallback(): void {
    if (!this.#root) this.#build();
    if (!this.#dirty) this.#value = parseDateAttribute(this.getAttribute("value"));
    this.#sync();
  }

  disconnectedCallback(): void {
    // A removed popover closes without a toggle event, so clean up here.
    this.hidePicker();
    this.#closed();
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
    this.#touched = false;
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
    adoptStyle(root, STYLE);

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
    root.append(field, this.#popover);

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
        this.#fromText();
        this.#submit();
      }
    });
    // Fired when the form or a script checks validity; native :user-invalid starts on a submit.
    this.addEventListener("invalid", () => {
      this.#touched = true;
      this.#validate();
    });
    // beforetoggle runs at once on show and hide, so `open`, the state and aria-expanded agree.
    this.#popover.addEventListener("beforetoggle", (event) => {
      const open = (event as ToggleEvent).newState === "open";
      this.#expanded(open);
      if (open && !anchored()) this.#place();
    });
    this.#popover.addEventListener("toggle", (event) => {
      if ((event as ToggleEvent).newState !== "open") return this.#listen(false);
      if (!anchored()) {
        // Placed again now that the popover has its real size, and kept beside the field.
        this.#place();
        this.#listen(true);
      }
      this.#calendar.focusDay();
    });
    this.#popover.addEventListener("keydown", (event) => {
      // popover="auto" closes on Escape by itself; focus goes back to the button that opened it.
      if (event.key === "Escape") this.#button.focus();
    });
    this.#calendar.addEventListener("change", (event) => {
      event.stopPropagation();
      this.#dirty = true;
      this.#touched = true;
      this.#setDate(this.#calendar.date, true);
      this.#popover.hidePopover();
      this.#input.focus();
    });
  }

  #closed(): void {
    if (!this.#root) return;
    this.#expanded(false);
    this.#listen(false);
  }

  #expanded(open: boolean): void {
    // Browsers expose popovertarget's state differently; the attribute makes it the same everywhere.
    this.#button.setAttribute("aria-expanded", String(open));
    this.#state("open", open);
  }

  #listen(on: boolean): void {
    const method = on ? addEventListener : removeEventListener;
    method("scroll", this.#onViewportChange, { capture: true, passive: true });
    method("resize", this.#onViewportChange, { passive: true });
  }

  // Enter submits only where a native text field would: through the form's default button, or
  // with no submit button when this is the only field that blocks implicit submission.
  #submit(): void {
    const form = this.form;
    if (!form) return;
    const fields = [...form.elements];
    const button = fields.find((field) => (field as HTMLButtonElement).type === "submit") as
      | HTMLButtonElement
      | undefined;
    if (button) {
      if (!button.disabled) form.requestSubmit(button);
    } else if (fields.filter(blocksImplicitSubmission).length === 1) form.requestSubmit();
  }

  #fromText(): void {
    const text = this.#input.value.trim();
    this.#dirty = true;
    this.#touched = true;
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

  // The fallback where CSS anchor positioning is not supported.
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
    const disabled = this.disabled;
    const readOnly = this.readOnly;

    this.#input.disabled = disabled;
    this.#input.readOnly = readOnly;
    this.#button.disabled = disabled || readOnly;
    if (disabled || readOnly) this.hidePicker();
    this.#input.required = this.required;
    this.#input.placeholder =
      this.getAttribute("placeholder") ?? (lang === "ne" ? "२०८१/०४/१५" : "2081/04/15");
    this.#input.setAttribute(
      "aria-label",
      this.getAttribute("aria-label") ?? this.#labelText() ?? text.choose,
    );
    this.#button.setAttribute("aria-label", text.choose);
    this.#popover.setAttribute("aria-label", text.choose);
    // The calendar gets the resolved language, as it can't see this element's ancestors.
    const calendar = this.#calendar;
    for (const name of ["lang", "min", "max", "first-day-of-week", "show-gregorian"]) {
      const value = name === "lang" ? lang : this.getAttribute(name);
      // Only real changes, so a sync that changes nothing does not render the calendar.
      if (calendar.getAttribute(name) === value) continue;
      if (value === null) calendar.removeAttribute(name);
      else calendar.setAttribute(name, value);
    }
    if (!sameDate(calendar.date, this.#value)) calendar.date = this.#value;
    if (rewriteText && !this.#badInput)
      this.#input.value = this.#value ? this.#value.short({ lang }) : "";
    this.#internals.setFormValue(this.value, this.value);
    this.#validate();
  }

  #validate(): void {
    const internals = this.#internals;
    const value = this.#value;
    const lang = langOf(this);
    const text = TEXT[lang];
    const min = parseDateAttribute(this.getAttribute("min"));
    const max = parseDateAttribute(this.getAttribute("max"));
    let flags: ValidityStateFlags = {};
    let message = "";
    if (this.#badInput) [flags, message] = [{ badInput: true }, text.invalid];
    else if (!value) {
      if (this.required) [flags, message] = [{ valueMissing: true }, text.missing];
    } else if (min && NepaliDate.compare(value, min) < 0)
      [flags, message] = [{ rangeUnderflow: true }, `${text.tooEarly} ${min.short({ lang })}`];
    else if (max && NepaliDate.compare(value, max) > 0)
      [flags, message] = [{ rangeOverflow: true }, `${text.tooLate} ${max.short({ lang })}`];
    // A date the calendar refuses through isDateDisallowed. stepMismatch, because a native date
    // input reports the same kind of rule that way: the date is in range and well formed, but not
    // one of the dates allowed (step="7" allows one weekday). badInput would empty the value, and
    // customError belongs to setCustomValidity.
    else if (this.#calendar.isDateDisallowed?.(value))
      [flags, message] = [{ stepMismatch: true }, text.unavailable];
    if (this.#customError) [flags, message] = [{ ...flags, customError: true }, this.#customError];
    internals.setValidity(flags, message, message ? this.#input : undefined);

    const invalid = internals.willValidate && !internals.validity.valid;
    // A screen reader hears "invalid" at the same time a page would show :user-invalid, not on a
    // fresh empty required field.
    this.#input.setAttribute("aria-invalid", String(invalid && this.#touched));
    this.#state("invalid", invalid);
    this.#state("user-invalid", invalid && this.#touched);
  }

  // CustomStateSet, where the browser has it. Chromium before 125 took only "--name" and throws on
  // a plain name; those versions get no states.
  #state(name: string, on: boolean): void {
    try {
      this.#internals.states?.[on ? "add" : "delete"](name);
    } catch {
      // No states in this browser.
    }
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

reflect(
  NepDateInputElement.prototype,
  "name min max placeholder",
  "disabled required readonly show-gregorian",
  "first-day-of-week",
);

function blocksImplicitSubmission(field: Element): boolean {
  return field instanceof HTMLInputElement
    ? BLOCKING.test(field.type)
    : field.localName === "nepdate-input";
}

function sameDate(a: NepaliDate | null, b: NepaliDate | null): boolean {
  return a === b || (a !== null && b !== null && a.equals(b));
}
