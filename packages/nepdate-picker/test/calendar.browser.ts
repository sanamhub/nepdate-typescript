import { NepaliDate } from "nepdate-core";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { defineElements, type NepDateCalendarElement } from "../src/index.js";

defineElements();

function mount(attributes: Record<string, string> = {}): NepDateCalendarElement {
  const calendar = document.createElement("nepdate-calendar");
  for (const [name, value] of Object.entries(attributes)) calendar.setAttribute(name, value);
  document.body.append(calendar);
  return calendar;
}

const shadow = (calendar: NepDateCalendarElement) => calendar.shadowRoot as ShadowRoot;
const days = (calendar: NepDateCalendarElement) =>
  [...shadow(calendar).querySelectorAll<HTMLButtonElement>('[part~="day"]')].filter(
    (b) => !b.hidden,
  );
const day = (calendar: NepDateCalendarElement, iso: string) =>
  shadow(calendar).querySelector<HTMLButtonElement>(`[data-date="${iso}"]`) as HTMLButtonElement;
const label = (calendar: NepDateCalendarElement) =>
  shadow(calendar).querySelector(".label")?.textContent;
const focused = (calendar: NepDateCalendarElement) =>
  (shadow(calendar).activeElement as HTMLElement | null)?.dataset.date;
const part = (calendar: NepDateCalendarElement, name: string) =>
  shadow(calendar).querySelector(`[part~="${name}"]`) as HTMLElement;

afterEach(() => {
  document.body.replaceChildren();
});

describe("nepdate-calendar", () => {
  test("shows the month of its value, one button per day", () => {
    const calendar = mount({ value: "2081-04-15" });
    expect(label(calendar)).toBe("Shrawan 2081");
    expect(days(calendar).map((b) => b.textContent)).toEqual(
      Array.from({ length: 32 }, (_, i) => String(i + 1)),
    );
    expect([...shadow(calendar).querySelectorAll("th")].map((th) => th.textContent)).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    expect(day(calendar, "2081-04-15").getAttribute("aria-label")).toBe(
      "Tuesday, Shrawan 15, 2081",
    );
  });

  test("has one tab stop, on the chosen day, and marks it selected", () => {
    const calendar = mount({ value: "2081-04-15" });
    const stops = days(calendar).filter((b) => b.tabIndex === 0);
    expect(stops.map((b) => b.dataset.date)).toEqual(["2081-04-15"]);
    expect(day(calendar, "2081-04-15").getAttribute("part")).toBe("day selected");
    expect(day(calendar, "2081-04-15").parentElement?.getAttribute("aria-selected")).toBe("true");
    expect(day(calendar, "2081-04-16").parentElement?.getAttribute("aria-selected")).toBe("false");
  });

  test("a click chooses a day and fires change once", async () => {
    const calendar = mount({ value: "2081-04-15" });
    let changes = 0;
    calendar.addEventListener("change", () => changes++);
    await userEvent.click(day(calendar, "2081-04-20"));
    expect(calendar.value).toBe("2081-04-20");
    expect(calendar.date?.toJSON()).toBe("2081-04-20");
    expect(changes).toBe(1);
    await userEvent.click(day(calendar, "2081-04-20"));
    expect(changes).toBe(1);
  });

  test("arrow keys move focus and Enter chooses", async () => {
    const calendar = mount({ value: "2081-04-15" });
    let changes = 0;
    calendar.addEventListener("change", () => changes++);
    calendar.focusDay();
    expect(focused(calendar)).toBe("2081-04-15");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused(calendar)).toBe("2081-04-16");
    await userEvent.keyboard("{ArrowDown}");
    expect(focused(calendar)).toBe("2081-04-23");
    await userEvent.keyboard("{Home}");
    expect(focused(calendar)).toBe("2081-04-20");
    expect(calendar.value).toBe("2081-04-15");
    await userEvent.keyboard("{Enter}");
    expect(calendar.value).toBe("2081-04-20");
    expect(changes).toBe(1);
  });

  test("Page Down shows the next month, Shift+Page Up the year before", async () => {
    const calendar = mount({ value: "2081-04-32" });
    calendar.focusDay();
    await userEvent.keyboard("{PageDown}");
    expect(label(calendar)).toBe("Bhadra 2081");
    expect(focused(calendar)).toBe("2081-05-31");
    await userEvent.keyboard("{Shift>}{PageUp}{/Shift}");
    expect(label(calendar)).toBe("Bhadra 2080");
    expect(calendar.value).toBe("2081-04-32");
  });

  test("the month buttons and selects change the month on show", async () => {
    const calendar = mount({ value: "2081-04-15" });
    await userEvent.click(part(calendar, "next"));
    expect(label(calendar)).toBe("Bhadra 2081");
    await userEvent.click(part(calendar, "previous"));
    await userEvent.click(part(calendar, "previous"));
    expect(label(calendar)).toBe("Ashad 2081");
    await userEvent.selectOptions(part(calendar, "year-select"), "2090");
    await userEvent.selectOptions(part(calendar, "month-select"), "12");
    expect(label(calendar)).toBe("Chaitra 2090");
    expect(calendar.value).toBe("2081-04-15");
  });

  test("days outside min and max are disabled and can't be chosen", async () => {
    const calendar = mount({ value: "2081-04-15", min: "2081-04-10", max: "2081-04-20" });
    expect(day(calendar, "2081-04-09").getAttribute("aria-disabled")).toBe("true");
    expect(day(calendar, "2081-04-09").getAttribute("part")).toBe("day disabled");
    expect(day(calendar, "2081-04-10").hasAttribute("aria-disabled")).toBe(false);
    // Playwright won't click an aria-disabled button, which is the point; click it directly.
    day(calendar, "2081-04-21").click();
    expect(calendar.value).toBe("2081-04-15");
    expect((part(calendar, "previous") as HTMLButtonElement).disabled).toBe(true);
    expect((part(calendar, "next") as HTMLButtonElement).disabled).toBe(true);
    calendar.focusDay();
    await userEvent.keyboard("{PageDown}");
    expect(focused(calendar)).toBe("2081-04-20");
  });

  test("blank cells stay empty and out of view after the month changes", async () => {
    const calendar = mount({ value: "2081-04-15" });
    await userEvent.click(part(calendar, "next"));
    await userEvent.click(part(calendar, "next"));
    const blanks = [
      ...shadow(calendar).querySelectorAll<HTMLButtonElement>('[part~="day"]'),
    ].filter((b) => b.hidden);
    expect(blanks.length).toBeGreaterThan(0);
    for (const blank of blanks) {
      expect(blank.textContent).toBe("");
      expect(getComputedStyle(blank).display).toBe("none");
    }
  });

  test("isDateDisallowed and dayParts mark days", () => {
    const calendar = mount({ value: "2081-04-15" });
    calendar.isDateDisallowed = (date) => date.weekday === 6;
    calendar.dayParts = (date) => (date.day === 1 ? ["holiday", "Not A Part"] : []);
    expect(day(calendar, "2081-04-05").getAttribute("aria-disabled")).toBe("true");
    expect(day(calendar, "2081-04-01").getAttribute("part")).toBe("day holiday");
  });

  test("lang=ne uses Nepali names and digits", () => {
    const calendar = mount({ value: "2081-04-15", lang: "ne" });
    expect(label(calendar)).toBe("साउन २०८१");
    expect(day(calendar, "2081-04-15").textContent).toBe("१५");
    expect(day(calendar, "2081-04-15").getAttribute("aria-label")).toBe("मङ्गलवार, साउन १५, २०८१");
    expect(part(calendar, "previous").getAttribute("aria-label")).toBe("अघिल्लो महिना");
  });

  test("show-gregorian adds the AD day, hidden from screen readers", () => {
    const calendar = mount({ value: "2081-04-15", "show-gregorian": "" });
    const ad = day(calendar, "2081-04-15").querySelector('[part="gregorian"]');
    expect(ad?.textContent).toBe("30");
    expect(ad?.getAttribute("aria-hidden")).toBe("true");
  });

  test("first-day-of-week reorders the columns", () => {
    const calendar = mount({ value: "2081-04-15", "first-day-of-week": "1" });
    expect(shadow(calendar).querySelector("th")?.textContent).toBe("Mon");
  });

  test("without a value it shows today, marked as the current date", () => {
    const calendar = mount();
    const today = NepaliDate.today();
    expect(calendar.value).toBe("");
    expect(day(calendar, today.toJSON()).getAttribute("aria-current")).toBe("date");
    expect(day(calendar, today.toJSON()).tabIndex).toBe(0);
  });

  test("an unparseable value is no value", () => {
    const calendar = mount({ value: "2081-13-01" });
    expect(calendar.value).toBe("");
    calendar.value = "2081/04/15";
    expect(calendar.value).toBe("2081-04-15");
    calendar.date = null;
    expect(calendar.value).toBe("");
  });
});
