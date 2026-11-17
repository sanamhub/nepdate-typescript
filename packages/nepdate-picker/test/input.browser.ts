import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { defineElements, type NepDateCalendarElement, NepDateInputElement } from "../src/index.js";

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

describe("nepdate-input: rendering, platform features and native parity", () => {
  const isOpen = (el: NepDateInputElement) => popover(el).matches(":popover-open");

  // Records the scroll and resize listeners added to and removed from window.
  function spyOnWindowListeners(): { calls: string[]; restore: () => void } {
    const calls: string[] = [];
    const add = window.addEventListener;
    const remove = window.removeEventListener;
    const record = (verb: string, original: typeof add) =>
      ((...args: Parameters<typeof add>) => {
        if (args[0] === "scroll" || args[0] === "resize") calls.push(`${verb} ${args[0]}`);
        original.apply(window, args);
      }) as typeof add;
    window.addEventListener = record("add", add);
    window.removeEventListener = record("remove", remove);
    return {
      calls,
      restore: () => {
        window.addEventListener = add;
        window.removeEventListener = remove;
      },
    };
  }

  // The toggle event, which comes after the popover opens, focuses a day.
  const dayFocused = (el: NepDateInputElement) =>
    expect.poll(() => (calendar(el).shadowRoot as ShadowRoot).activeElement).not.toBeNull();

  test("a group of attribute changes renders the calendar once", async () => {
    const form = mount('<nepdate-input value="2081-04-15"></nepdate-input>');
    const el = picker(form);
    const previous = (calendar(el).shadowRoot as ShadowRoot).querySelector('[part~="previous"]');
    const observer = new MutationObserver(() => {});
    observer.observe(previous as Element, { attributeFilter: ["aria-label"] });
    el.setAttribute("lang", "ne");
    el.setAttribute("min", "2081-01-01");
    el.setAttribute("max", "2081-12-30");
    el.setAttribute("first-day-of-week", "1");
    el.setAttribute("show-gregorian", "");
    await Promise.resolve();
    expect(observer.takeRecords()).toHaveLength(1);
    // A sync that changes nothing in the calendar renders nothing.
    el.setAttribute("placeholder", "BS date");
    await Promise.resolve();
    expect(observer.takeRecords()).toHaveLength(0);
  });

  test("with CSS anchor positioning the popover needs no window listeners", async () => {
    if (!CSS.supports("anchor-name", "--x")) return;
    const form = mount('<nepdate-input value="2081-04-15"></nepdate-input>');
    const el = picker(form);
    const spy = spyOnWindowListeners();
    try {
      await userEvent.click(inner(el, "button"));
      await dayFocused(el);
      expect(spy.calls).toEqual([]);
      expect(popover(el).style.top).toBe("");
    } finally {
      spy.restore();
    }
  });

  test("without anchor positioning, the fallback places the popover and cleans up", async () => {
    const form = mount('<nepdate-input value="2081-04-15"></nepdate-input>');
    const el = picker(form);
    const supports = CSS.supports;
    CSS.supports = () => false;
    const spy = spyOnWindowListeners();
    try {
      await userEvent.click(inner(el, "button"));
      await dayFocused(el);
      expect(spy.calls).toEqual(["add scroll", "add resize"]);
      expect(popover(el).style.top).not.toBe("");
      el.hidePicker();
      await expect.poll(() => spy.calls.length).toBe(4);
      expect(spy.calls.slice(2)).toEqual(["remove scroll", "remove resize"]);
      await userEvent.click(inner(el, "button"));
      await expect.poll(() => spy.calls.length).toBe(6);
      el.remove();
      expect(spy.calls.slice(6)).toEqual(["remove scroll", "remove resize"]);
      expect(el.matches(":state(open)")).toBe(false);
    } finally {
      spy.restore();
      CSS.supports = supports;
    }
  });

  test("open, hidePicker and the open state", () => {
    const form = mount('<nepdate-input value="2081-04-15"></nepdate-input>');
    const el = picker(form);
    expect(el.open).toBe(false);
    el.showPicker();
    expect(el.open).toBe(true);
    expect(el.matches(":state(open)")).toBe(true);
    el.hidePicker();
    expect(el.open).toBe(false);
    expect(el.matches(":state(open)")).toBe(false);
  });

  test("disabling the field closes the calendar", () => {
    const form = mount('<nepdate-input value="2081-04-15"></nepdate-input>');
    const el = picker(form);
    el.showPicker();
    el.disabled = true;
    expect(isOpen(el)).toBe(false);
    expect(el.hasAttribute("disabled")).toBe(true);
  });

  test("invalid and user-invalid states follow :invalid and :user-invalid timing", async () => {
    const form = mount('<nepdate-input name="d" required></nepdate-input><button>Save</button>');
    const el = picker(form);
    expect(el.matches(":state(invalid)")).toBe(true);
    expect(el.matches(":state(user-invalid)")).toBe(false);
    expect(text(el).getAttribute("aria-invalid")).toBe("false");
    form.requestSubmit();
    expect(el.matches(":state(user-invalid)")).toBe(true);
    form.reset();
    expect(el.matches(":state(user-invalid)")).toBe(false);
    await userEvent.type(text(el), "2081/13/01{Tab}");
    expect(el.matches(":state(user-invalid)")).toBe(true);
    expect(text(el).getAttribute("aria-invalid")).toBe("true");
    await userEvent.clear(text(el));
    await userEvent.type(text(el), "2081/04/15{Tab}");
    expect(el.matches(":state(invalid)")).toBe(false);
    expect(el.matches(":state(user-invalid)")).toBe(false);
  });

  test("readonly: no typing and no calendar, but the date submits and is not validated", () => {
    const form = mount('<nepdate-input name="d" value="2081-04-15" required></nepdate-input>');
    const el = picker(form);
    el.readOnly = true;
    expect(el.hasAttribute("readonly")).toBe(true);
    expect(text(el).readOnly).toBe(true);
    expect((inner(el, "button") as HTMLButtonElement).disabled).toBe(true);
    el.showPicker();
    expect(isOpen(el)).toBe(false);
    expect(new FormData(form).get("d")).toBe("2081-04-15");
    expect(el.willValidate).toBe(false);
    el.readOnly = false;
    expect(el.willValidate).toBe(true);
  });

  test("setCustomValidity wins over the own validity, and an empty string clears it", () => {
    const form = mount('<nepdate-input name="d" required></nepdate-input>');
    const el = picker(form);
    el.setCustomValidity("Pick a working day.");
    expect(el.validity.customError).toBe(true);
    expect(el.validity.valueMissing).toBe(true);
    expect(el.validationMessage).toBe("Pick a working day.");
    el.setCustomValidity("");
    expect(el.validity.customError).toBe(false);
    expect(el.validationMessage).toBe("Enter a date.");
    el.value = "2081-04-15";
    expect(el.validity.valid).toBe(true);
  });

  test("a typed date the calendar disallows is kept but invalid", async () => {
    const form = mount('<nepdate-input name="d"></nepdate-input>');
    const el = picker(form);
    calendar(el).isDateDisallowed = (date) => date.weekday === 6;
    // 2081-04-19 is a Saturday.
    await userEvent.type(text(el), "2081/04/19{Tab}");
    expect(el.value).toBe("2081-04-19");
    expect(el.validity.stepMismatch).toBe(true);
    expect(el.validationMessage).toBe("This date can't be chosen.");
    expect(el.checkValidity()).toBe(false);
    el.setAttribute("lang", "ne");
    expect(el.validationMessage).toBe("यो मिति छान्न मिल्दैन।");
  });

  test("Enter submits through the default button, with it as the submitter", async () => {
    const form = mount(
      '<nepdate-input name="d"></nepdate-input><input name="other"><button name="go">Go</button>',
    );
    const submitters: (HTMLElement | null)[] = [];
    form.addEventListener("submit", (event) => submitters.push(event.submitter));
    await userEvent.type(text(picker(form)), "2081/04/15{Enter}");
    expect(submitters).toEqual([form.querySelector("button")]);
  });

  test("Enter does not submit when the default button is disabled", async () => {
    const form = mount('<nepdate-input name="d"></nepdate-input><button disabled>Go</button>');
    let submits = 0;
    form.addEventListener("submit", () => submits++);
    await userEvent.type(text(picker(form)), "2081/04/15{Enter}");
    expect(submits).toBe(0);
    expect(picker(form).value).toBe("2081-04-15");
  });

  test("Enter does not submit with no submit button and another text field", async () => {
    const form = mount('<nepdate-input name="d"></nepdate-input><input name="other">');
    let submits = 0;
    form.addEventListener("submit", () => submits++);
    await userEvent.type(text(picker(form)), "2081/04/15{Enter}");
    expect(submits).toBe(0);
    // A checkbox does not block implicit submission.
    const alone = mount('<nepdate-input name="d"></nepdate-input><input type="checkbox">');
    alone.addEventListener("submit", () => submits++);
    await userEvent.type(text(picker(alone)), "2081/04/15{Enter}");
    expect(submits).toBe(1);
  });

  test("without lang it takes the nearest ancestor's", () => {
    const form = mount('<div lang="ne"><nepdate-input value="2081-04-15"></nepdate-input></div>');
    const el = picker(form);
    expect(text(el).value).toBe("२०८१/०४/१५");
    expect(calendar(el).getAttribute("lang")).toBe("ne");
  });

  test("properties reflect their attributes, and labels lists the labels", () => {
    const form = mount('<label for="d">Date</label><nepdate-input id="d"></nepdate-input>');
    const el = picker(form);
    el.name = "dob";
    el.required = true;
    el.min = "2081-01-01";
    el.max = "2081-12-30";
    el.placeholder = "YYYY/MM/DD";
    el.firstDayOfWeek = 1;
    el.showGregorian = true;
    expect(el.getAttribute("name")).toBe("dob");
    expect(el.hasAttribute("required")).toBe(true);
    expect(el.getAttribute("min")).toBe("2081-01-01");
    expect(el.getAttribute("max")).toBe("2081-12-30");
    expect(text(el).placeholder).toBe("YYYY/MM/DD");
    expect(el.getAttribute("first-day-of-week")).toBe("1");
    expect(calendar(el).getAttribute("show-gregorian")).toBe("");
    expect([...el.labels].map((label) => label.textContent)).toEqual(["Date"]);
    el.required = false;
    expect(el.hasAttribute("required")).toBe(false);
    expect(el.disabled).toBe(false);
    expect(el.readOnly).toBe(false);
  });
});

describe("properties set before the element is defined", () => {
  test("are applied when it upgrades", () => {
    // A framework can render and set properties before the script that defines the element runs.
    const form = mount('<nepdate-input-late name="dob"></nepdate-input-late>');
    const late = form.querySelector("nepdate-input-late") as NepDateInputElement;
    const props = late as unknown as Record<string, unknown>;
    props.value = "2081-04-15";
    props.required = true;
    props.min = "2081-01-01";
    customElements.define("nepdate-input-late", class extends NepDateInputElement {});
    expect(late.value).toBe("2081-04-15");
    expect(late.hasAttribute("required")).toBe(true);
    expect(late.getAttribute("min")).toBe("2081-01-01");
    expect(Object.hasOwn(late, "value")).toBe(false);
    expect(new FormData(form).get("dob")).toBe("2081-04-15");
  });
});
