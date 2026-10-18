import fc from "fast-check";
import { describe, expect, test, vi } from "vitest";
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
  test("parse.tsv strict column (69 rows)", () => {
    const rows = readVectors("parse.tsv");
    expect(rows).toHaveLength(69);
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
    expect(NepaliDate.parse("२०८१-०४-१९").toJSON()).toBe("2081-04-19");
    expect(kindOf(() => NepaliDate.parse("२०८१-०४-१५\u0970"))).toBe("invalid-character");
    expect(kindOf(() => NepaliDate.parse("2081-02-15x"))).toBe("invalid-character");
  });
});

describe("lenient parse (T3-05)", () => {
  test("parse.tsv lenient column (69 rows)", () => {
    const rows = readVectors("parse.tsv");
    expect(rows).toHaveLength(69);
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
    expect(NepaliDate.parseLenient("2080..7.15").toJSON()).toBe("2080-07-15");
    expect(kindOf(() => NepaliDate.parseLenient("Kartik foo 2080"))).toBe("unrecognized");
    expect(kindOf(() => NepaliDate.parseLenient("2080 foo 7 15"))).toBe("unrecognized");
    expect(kindOf(() => NepaliDate.parseLenient("15-2080.7"))).toBe("ambiguous");
    expect(kindOf(() => NepaliDate.parseLenient("Kartik Magh 2080 1"))).toBe("unrecognized");
    expect(kindOf(() => NepaliDate.parseLenient("005 Kartik 2080"))).toBe("ambiguous");
    expect(kindOf(() => NepaliDate.parseLenient("15 Kartik 080"))).toBe("ambiguous");
    expect(kindOf(() => NepaliDate.parseLenient("Kartik 2080"))).toBe("unrecognized");
    expect(kindOf(() => NepaliDate.parseLenient("2080 7 15 1"))).toBe("unrecognized");
  });

  test("no Unicode normalisation: the Kelvin sign and K are matched as given (PARSING §2)", () => {
    // No Devanagari month name has a canonical decomposition, so the pair that NFC would unify is
    // the Kelvin sign U+212A and ASCII K. The fold rule accepts both, so the spy is what separates
    // "matched as given" from "matched after NFC": with an NFC step the call happens, without it
    // the input reaches the tokenizer unchanged.
    const composed = "15 \u212Aartik 2080";
    const decomposed = "15 Kartik 2080";
    expect(composed.normalize("NFC")).toBe(decomposed);

    const normalize = vi.spyOn(String.prototype, "normalize");
    try {
      expect(NepaliDate.parseLenient(composed).toJSON()).toBe("2080-07-15");
      expect(NepaliDate.parseLenient(decomposed).toJSON()).toBe("2080-07-15");
      expect(normalize).not.toHaveBeenCalled();
    } finally {
      normalize.mockRestore();
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
