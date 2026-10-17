import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type ErrorKind, NepaliDate, NepDateError } from "../src/index.js";
import { kindOf } from "./helpers.js";
import { readVectors } from "./vectors.js";

const KIND: Record<string, ErrorKind> = {
  "ERR:InvalidCharacter": "invalid-character",
  "ERR:WrongGroupCount": "wrong-group-count",
  "ERR:NumberTooLong": "number-too-long",
  "ERR:OutOfRange": "out-of-range",
  "ERR:InvalidMonth": "invalid-month",
  "ERR:InvalidDay": "invalid-day",
  "ERR:Ambiguous": "ambiguous",
  "ERR:Unrecognized": "unrecognized",
};

describe("strict parse (T3-04)", () => {
  test("parse.tsv strict column (67 rows)", () => {
    const rows = readVectors("parse.tsv");
    expect(rows).toHaveLength(67);
    for (const row of rows) {
      const input = row.input as string;
      const strict = row.strict as string;
      if (strict.startsWith("ERR:")) {
        const kind = KIND[strict];
        expect(kind, input).toBeDefined();
        expect(
          kindOf(() => NepaliDate.parse(input)),
          input,
        ).toBe(kind);
        expect(NepaliDate.tryParse(input), input).toBeNull();
      } else {
        const date = NepaliDate.parse(input);
        expect(date.toJSON(), input).toBe(strict);
        expect(NepaliDate.tryParse(input)?.toJSON(), input).toBe(strict);
      }
    }
  });
});

describe("lenient parse (T3-05)", () => {
  test("parse.tsv lenient column (67 rows)", () => {
    const rows = readVectors("parse.tsv");
    expect(rows).toHaveLength(67);
    for (const row of rows) {
      const input = row.input as string;
      const lenient = row.lenient as string;
      if (lenient.startsWith("ERR:")) {
        const kind = KIND[lenient];
        expect(kind, input).toBeDefined();
        expect(
          kindOf(() => NepaliDate.parseLenient(input)),
          input,
        ).toBe(kind);
      } else {
        expect(NepaliDate.parseLenient(input).toJSON(), input).toBe(lenient);
      }
    }
  });

  test("fuzz: 10,000 inputs throw only NepDateError or return a date", () => {
    const devanagari = [
      "बैशाख",
      "वैशाख",
      "बैसाख",
      "जेठ",
      "जेष्ठ",
      "ज्येष्ठ",
      "असार",
      "आषाढ",
      "असाढ",
      "साउन",
      "श्रावण",
      "सावन",
      "भदौ",
      "भाद्र",
      "भाद्रपद",
      "असोज",
      "आश्विन",
      "असौज",
      "कार्तिक",
      "कात्तिक",
      "मंसिर",
      "मङ्सिर",
      "मार्गशीर्ष",
      "पुष",
      "पौष",
      "पुस",
      "माघ",
      "फागुन",
      "फाल्गुन",
      "चैत",
      "चैत्र",
      "गते",
      "मिति",
      "बि.सं.",
      "वि.सं.",
    ].join("");
    const alphabet = [
      "0123456789",
      "०१२३४५६७८९",
      "-/._\\ |।",
      ",",
      "abcdefghijklmnopqrstuvwxyz",
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      [...new Set(devanagari)].join(""),
    ].join("");
    const chars = [...alphabet];
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: chars.length - 1 }), { minLength: 0, maxLength: 20 }),
        (indices) => {
          const input = indices.map((i) => chars[i]).join("");
          for (const fn of [NepaliDate.parse, NepaliDate.tryParse, NepaliDate.parseLenient]) {
            try {
              fn(input);
            } catch (error) {
              expect(error, `${fn.name}(${JSON.stringify(input)})`).toBeInstanceOf(NepDateError);
            }
          }
        },
      ),
      { seed: 20261013, numRuns: 10_000 },
    );
  });
});
