import { describe, expect, test } from "vitest";
import { type ErrorKind, NepaliDate } from "../src/index.js";
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
