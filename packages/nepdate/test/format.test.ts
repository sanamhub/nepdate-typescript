import { describe, expect, test } from "vitest";
import { NepaliDate } from "../src/index.js";
import { readVectors } from "./vectors.js";

function bs(text: string): NepaliDate {
  const [y, m, d] = text.split("-").map(Number);
  return NepaliDate.of(y as number, m as number, d as number);
}

describe("short and long (T3-02)", () => {
  test("FORMATTING §3 examples", () => {
    const d = bs("2080-05-15");
    expect(d.short({ order: "ymd", separator: "-", pad: true })).toBe("2080-05-15");
    expect(d.short({ order: "dmy", separator: "-", pad: false })).toBe("15-5-2080");
    expect(d.short({ order: "ymd", separator: "/", pad: true, lang: "ne" })).toBe("२०८०/०५/१५");
    expect(d.short()).toBe("2080/05/15");
    expect(d.toString()).toBe("2080/05/15");
    expect(d.toJSON()).toBe("2080-05-15");
  });

  test("FORMATTING §4 examples", () => {
    expect(bs("2081-04-15").long()).toBe("Shrawan 15, 2081");
    expect(bs("2081-04-15").long({ weekday: true })).toBe("Tuesday, Shrawan 15, 2081");
    expect(bs("1901-01-01").long()).toBe("Baishakh 01, 1901");
    expect(bs("2079-02-06").long({ weekday: true, year: false, pad: false })).toBe(
      "Friday, Jestha 6",
    );
    expect(bs("2081-04-15").long({ lang: "ne" })).toBe("साउन १५, २०८१");
    expect(bs("2081-04-15").long({ weekday: true, lang: "ne" })).toBe("मङ्गलवार, साउन १५, २०८१");
  });

  test("JSON.stringify uses toJSON", () => {
    expect(JSON.stringify({ d: NepaliDate.of(2081, 4, 15) })).toBe('{"d":"2081-04-15"}');
  });

  test("golden dates.tsv formatting columns (1018 rows)", () => {
    const rows = readVectors("csharp-golden/dates.tsv");
    expect(rows).toHaveLength(1018);
    for (const row of rows) {
      const d = bs(row.bs as string);
      expect(d.toString(), row.bs).toBe(row.to_string);
      expect(d.short({ order: "ymd", separator: "/", pad: true, lang: "ne" }), row.bs).toBe(
        row.unicode,
      );
      expect(d.long(), row.bs).toBe(row.long_en);
      expect(d.long({ weekday: true }), row.bs).toBe(row.long_en_weekday);
      expect(d.long({ lang: "ne" }), row.bs).toBe(row.long_ne);
      expect(d.long({ weekday: true, lang: "ne" }), row.bs).toBe(row.long_ne_weekday);
      expect(d.short({ order: "dmy", separator: "-", pad: false }), row.bs).toBe(
        row.dmy_dash_nopad,
      );
    }
  });
});
