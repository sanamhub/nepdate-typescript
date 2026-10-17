import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { NepaliDate } from "nepdate";
import { expect, test } from "vitest";
import { coverage, info } from "../src/index.js";

interface NamedJson {
  np: string;
  en: string;
}
interface DayJson {
  tithi?: NamedJson;
  holiday?: boolean;
  events?: NamedJson[];
}
interface PatroJson {
  days: Record<string, DayJson>;
}

// The straightforward lookup the property checks against: the JSON of shared/data/patro, keyed by
// serial so a test does not repeat the package's own table layout.
const dir = fileURLToPath(new URL("../../../shared/data/patro/", import.meta.url));
const expected = new Map<number, DayJson>();
for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
  const json = JSON.parse(readFileSync(dir + file, "utf8")) as PatroJson;
  for (const [label, day] of Object.entries(json.days)) {
    const [year, month, dayOfMonth] = label.split("-").map(Number) as [number, number, number];
    expected.set(NepaliDate.MIN.daysUntil(NepaliDate.of(year, month, dayOfMonth)), day);
  }
}

function check(date: NepaliDate): void {
  const day = expected.get(NepaliDate.MIN.daysUntil(date));
  const actual = info(date);
  if (day?.tithi === undefined) {
    expect(actual.tithi).toBeNull();
  } else {
    expect(actual.tithi?.np).toBe(day.tithi.np);
    expect(actual.tithi?.en).toBe(day.tithi.en);
  }
  expect(actual.isPublicHoliday).toBe(day?.holiday === true);
  expect(actual.events.map((named) => named.np)).toEqual((day?.events ?? []).map((e) => e.np));
  expect(actual.events.map((named) => named.en)).toEqual((day?.events ?? []).map((e) => e.en));
}

test("every serial in the coverage agrees with the patro JSON", () => {
  for (const date of coverage()) check(date);
});

test("arbitrary serials across the BS range agree with the patro JSON (seed 20261018)", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 109211 }), (serial) => {
      check(NepaliDate.MIN.addDays(serial));
    }),
    { seed: 20261018, numRuns: 10_000 },
  );
});
