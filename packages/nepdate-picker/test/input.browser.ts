import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import {
  defineElements,
  type NepDateCalendarElement,
  type NepDateInputElement,
} from "../src/index.js";

defineElements();

function mount(html: string): HTMLFormElement {
  const form = document.createElement("form");
  form.innerHTML = html;
  form.addEventListener("submit", (event) => event.preventDefault());
  document.body.append(form);
  return form;
}

const picker = (form: HTMLFormElement) =>
  form.querySelector("nepdate-input") as NepDateInputElement;
const inner = (el: NepDateInputElement, part: string) =>
  (el.shadowRoot as ShadowRoot).querySelector(`[part~="${part}"]`) as HTMLElement;
const text = (el: NepDateInputElement) => inner(el, "input") as HTMLInputElement;
const popover = (el: NepDateInputElement) => inner(el, "popover");
const calendar = (el: NepDateInputElement) => el.calendar as NepDateCalendarElement;
const calendarDay = (el: NepDateInputElement, iso: string) =>
  (calendar(el).shadowRoot as ShadowRoot).querySelector(
    `[data-date="${iso}"]`,
  ) as HTMLButtonElement;

afterEach(() => {
  document.body.replaceChildren();
});

describe("nepdate-input", () => {
  test("submits its BS date under its name", () => {
    const form = mount('<nepdate-input name="dob" value="2081-04-15"></nepdate-input>');
    expect(new FormData(form).get("dob")).toBe("2081-04-15");
    expect(text(picker(form)).value).toBe("2081/04/15");
  });

  test("typed text is parsed, written back in one form, and fires input and change once", async () => {
    const form = mount('<nepdate-input name="d"></nepdate-input>');
    const el = picker(form);
    const events: string[] = [];
    el.addEventListener("input", () => events.push("input"));
    el.addEventListener("change", () => events.push("change"));
    await userEvent.type(text(el), "15 Shrawan 2081{Enter}");
    expect(el.value).toBe("2081-04-15");
    expect(text(el).value).toBe("2081/04/15");
    expect(new FormData(form).get("d")).toBe("2081-04-15");
    expect(events).toEqual(["input", "change"]);
  });

  test("Enter commits the text and submits the form, like a native input", async () => {
    const form = mount('<nepdate-input name="d"></nepdate-input>');
    const submitted: (string | null)[] = [];
    form.addEventListener("submit", () =>
      submitted.push(new FormData(form).get("d") as string | null),
    );
    await userEvent.type(text(picker(form)), "2081/04/15{Enter}");
    expect(submitted).toEqual(["2081-04-15"]);
  });

  test("the open calendar sits beside the field", async () => {
    const form = mount('<nepdate-input value="2081-04-15"></nepdate-input>');
    const el = picker(form);
    await userEvent.click(inner(el, "button"));
    const field = inner(el, "field").getBoundingClientRect();
    const box = popover(el).getBoundingClientRect();
    expect(box.height).toBeGreaterThan(100);
    expect(box.top === field.bottom + 4 || box.bottom === field.top - 4).toBe(true);
  });

  test("Nepali digits are accepted, and lang=ne writes them back", async () => {
    const form = mount('<nepdate-input lang="ne"></nepdate-input>');
    const el = picker(form);
    await userEvent.type(text(el), "२०८१/०४/१५{Enter}");
    expect(el.value).toBe("2081-04-15");
    expect(text(el).value).toBe("२०८१/०४/१५");
  });

  test("text that isn't a date empties the value and sets badInput", async () => {
    const form = mount('<nepdate-input name="d" value="2081-04-15"></nepdate-input>');
    const el = picker(form);
    await userEvent.clear(text(el));
    await userEvent.type(text(el), "2081/13/01{Enter}");
    expect(el.value).toBe("");
    expect(el.validity.badInput).toBe(true);
    expect(el.checkValidity()).toBe(false);
    expect(text(el).value).toBe("2081/13/01");
    expect(text(el).getAttribute("aria-invalid")).toBe("true");
    expect(new FormData(form).get("d")).toBe("");
    el.value = "2081-04-16";
    expect(el.validity.valid).toBe(true);
    expect(text(el).value).toBe("2081/04/16");
  });

  test("required, min and max set the matching validity flags", () => {
    const form = mount(
      '<nepdate-input required min="2081-01-01" max="2081-12-30"></nepdate-input>',
    );
    const el = picker(form);
    expect(el.validity.valueMissing).toBe(true);
    expect(form.checkValidity()).toBe(false);
    el.value = "2080-12-30";
    expect(el.validity.rangeUnderflow).toBe(true);
    expect(el.validationMessage).toContain("2081/01/01");
    el.value = "2082-01-01";
    expect(el.validity.rangeOverflow).toBe(true);
    el.value = "2081-06-01";
    expect(el.validity.valid).toBe(true);
    expect(form.checkValidity()).toBe(true);
  });

  test("form reset goes back to the value attribute", async () => {
    const form = mount('<nepdate-input name="d" value="2081-04-15"></nepdate-input>');
    const el = picker(form);
    el.value = "2082-01-01";
    form.reset();
    expect(el.value).toBe("2081-04-15");
    expect(text(el).value).toBe("2081/04/15");
  });

  test("a changed value attribute replaces the date the user typed", async () => {
    // Blazor and server templates push state through the attribute, not the property.
    const form = mount('<nepdate-input name="d" value="2081-04-15"></nepdate-input>');
    const el = picker(form);
    await userEvent.clear(text(el));
    await userEvent.type(text(el), "2081/05/01{Tab}");
    expect(el.value).toBe("2081-05-01");
    el.setAttribute("value", "2082-01-01");
    expect(el.value).toBe("2082-01-01");
    expect(text(el).value).toBe("2082/01/01");
    el.removeAttribute("value");
    expect(el.value).toBe("");
    expect(text(el).value).toBe("");
  });

  test("an empty value attribute keeps text that isn't a date and its badInput", async () => {
    const form = mount('<nepdate-input name="d"></nepdate-input>');
    const el = picker(form);
    await userEvent.type(text(el), "2081/13/01{Tab}");
    el.setAttribute("value", "");
    expect(text(el).value).toBe("2081/13/01");
    expect(el.validity.badInput).toBe(true);
  });

  test("the button opens the calendar on the value; choosing a day closes it", async () => {
    const form = mount('<nepdate-input value="2081-04-15"></nepdate-input>');
    const el = picker(form);
    let changes = 0;
    el.addEventListener("change", () => changes++);
    await userEvent.click(inner(el, "button"));
    expect(popover(el).matches(":popover-open")).toBe(true);
    expect(inner(el, "button").getAttribute("aria-expanded")).toBe("true");
    expect((calendar(el).shadowRoot as ShadowRoot).activeElement?.getAttribute("data-date")).toBe(
      "2081-04-15",
    );
    await userEvent.keyboard("{ArrowRight}{Enter}");
    expect(el.value).toBe("2081-04-16");
    expect(changes).toBe(1);
    expect(popover(el).matches(":popover-open")).toBe(false);
    expect((el.shadowRoot as ShadowRoot).activeElement).toBe(text(el));
  });

  test("Escape closes the calendar without choosing, and the button toggles it", async () => {
    const form = mount('<nepdate-input value="2081-04-15"></nepdate-input>');
    const el = picker(form);
    await userEvent.click(inner(el, "button"));
    await userEvent.keyboard("{ArrowRight}{Escape}");
    expect(popover(el).matches(":popover-open")).toBe(false);
    expect((el.shadowRoot as ShadowRoot).activeElement).toBe(inner(el, "button"));
    expect(el.value).toBe("2081-04-15");
    await userEvent.click(inner(el, "button"));
    expect(popover(el).matches(":popover-open")).toBe(true);
    await userEvent.click(inner(el, "button"));
    expect(popover(el).matches(":popover-open")).toBe(false);
  });

  test("Alt+ArrowDown in the field opens the calendar, and a mouse pick works", async () => {
    const form = mount("<nepdate-input></nepdate-input>");
    const el = picker(form);
    text(el).focus();
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(popover(el).matches(":popover-open")).toBe(true);
    calendar(el).value = "2081-04-15";
    await userEvent.click(calendarDay(el, "2081-04-20"));
    expect(el.value).toBe("2081-04-20");
  });

  test("a <label for> names the field inside", () => {
    const form = mount(
      '<label for="d">Date of birth</label><nepdate-input id="d"></nepdate-input>',
    );
    expect(text(picker(form)).getAttribute("aria-label")).toBe("Date of birth");
    const labelled = mount('<nepdate-input aria-label="Start"></nepdate-input>');
    expect(text(picker(labelled)).getAttribute("aria-label")).toBe("Start");
  });

  test("disabled, directly or through a fieldset, disables both controls and the submission", () => {
    const form = mount(
      '<fieldset disabled><nepdate-input name="d" value="2081-04-15"></nepdate-input></fieldset>',
    );
    const el = picker(form);
    expect((text(el) as HTMLInputElement).disabled).toBe(true);
    expect((inner(el, "button") as HTMLButtonElement).disabled).toBe(true);
    expect(new FormData(form).has("d")).toBe(false);
    el.showPicker();
    expect(popover(el).matches(":popover-open")).toBe(false);
  });

  test("min and max reach the calendar", async () => {
    const form = mount('<nepdate-input value="2081-04-15" min="2081-04-10"></nepdate-input>');
    const el = picker(form);
    await userEvent.click(inner(el, "button"));
    expect(calendarDay(el, "2081-04-09").getAttribute("aria-disabled")).toBe("true");
  });
});
