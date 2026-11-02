import { describe, expect, test } from "vitest";
import { NepaliDate } from "../src/index.js";
import { bs, kindOf } from "./helpers.js";
import { readVectors } from "./vectors.js";

// serialization.tsv holds literal JSON text in its columns, quotes included (spec/README.md), so a
// reader must not treat quotes as quoting characters. The port hook is toJSON plus fromJSON
// (D-11); the object form and the converters are not ported.
describe("serialization.tsv", () => {
  const rows = readVectors("csharp-golden/serialization.tsv");

  test("11 rows", () => expect(rows).toHaveLength(11));

  test("write: JSON.stringify uses toJSON (NC10)", () => {
    for (const row of rows.filter((r) => r.kind === "write")) {
      expect(JSON.stringify(bs(row.input as string)), row.input).toBe(row.json);
    }
  });

  test("read: fromJSON reads the same text back (NC10)", () => {
    for (const row of rows.filter((r) => r.kind === "read")) {
      const input = row.input as string;
      if (row.result === "ERR") {
        expect(
          kindOf(() => NepaliDate.fromJSON(input)),
          input,
        ).toBeDefined();
      } else {
        expect(NepaliDate.fromJSON(input).toJSON(), input).toBe(row.result);
      }
    }
  });

  test("roundtrip: JSON.stringify then fromJSON is the same date", () => {
    for (const row of rows.filter((r) => r.kind === "roundtrip")) {
      const date = bs(row.input as string);
      expect(JSON.stringify(date)).toBe(row.json);
      expect(NepaliDate.fromJSON(JSON.stringify(date)).toJSON()).toBe(row.result);
      expect(NepaliDate.fromJSON(JSON.stringify(date)).equals(date)).toBe(true);
    }
  });

  test("JSON null is rejected, not turned into a zero date (D-01)", () => {
    expect(kindOf(() => NepaliDate.fromJSON("null"))).toBe("unrecognized");
    expect(kindOf(() => NepaliDate.fromJSON("{}"))).toBe("unrecognized");
    expect(kindOf(() => NepaliDate.fromJSON("2081-04-15"))).toBe("unrecognized");
  });

  test("a JSON array of dates round-trips", () => {
    const dates = [NepaliDate.of(2081, 4, 15), NepaliDate.MAX];
    const text = JSON.stringify(dates);
    expect(text).toBe('["2081-04-15","2199-12-30"]');
    expect(
      (JSON.parse(text) as string[]).map((value) =>
        NepaliDate.fromJSON(JSON.stringify(value)).toJSON(),
      ),
    ).toEqual(["2081-04-15", "2199-12-30"]);
  });

  test("a bad date inside JSON text keeps its parse kind", () => {
    expect(kindOf(() => NepaliDate.fromJSON('"2081-01-32"'))).toBe("invalid-day");
    expect(kindOf(() => NepaliDate.fromJSON('"not a date"'))).toBeDefined();
  });
});
