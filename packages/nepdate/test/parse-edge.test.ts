import { describe, expect, test } from "vitest";
import { NepaliDate, NepDateError } from "../src/index.js";

function messageOf(fn: () => unknown): { kind: string; message: string } {
  try {
    fn();
  } catch (error) {
    if (error instanceof NepDateError) return { kind: error.kind, message: error.message };
    throw error;
  }
  throw new Error("expected a NepDateError");
}

describe("strict parse messages and Devanagari boundaries", () => {
  test.each([
    ["2081 1 1 1", "wrong-group-count", "a fourth group"],
    ["20811 1 1", "number-too-long", "a group has more than 4 digits"],
    ["abc", "invalid-character", "invalid character"],
    ["2081 1", "wrong-group-count", "need year, month and day"],
  ])("%s names its failure", (input, kind, message) => {
    expect(messageOf(() => NepaliDate.parse(input))).toEqual({ kind, message });
  });

  test("a Devanagari fourth group and a Devanagari fifth digit are rejected", () => {
    expect(messageOf(() => NepaliDate.parse("२०८१ १ १ १"))).toEqual({
      kind: "wrong-group-count",
      message: "a fourth group",
    });
    expect(messageOf(() => NepaliDate.parse("२०८११ १ १"))).toEqual({
      kind: "number-too-long",
      message: "a group has more than 4 digits",
    });
  });

  test("the last Devanagari digit is a digit", () => {
    expect(NepaliDate.parse("२०८१-०४-१५").toJSON()).toBe("2081-04-15");
    expect(NepaliDate.parse("२०८१-०४-१९").toJSON()).toBe("2081-04-19");
  });

  test("a non-ASCII character outside the Devanagari digit range is invalid", () => {
    expect(messageOf(() => NepaliDate.parse("2081-02-15x"))).toEqual({
      kind: "invalid-character",
      message: "invalid character",
    });
  });
});

describe("lenient parse edges", () => {
  // T8 review: inputs that reach the lenient-only branches; strict parse rejects each one first.
  test.each([
    ["2081 1", "unrecognized", "unrecognized input"],
    ["Kartik Magh 2080 1 15", "unrecognized", "unrecognized input"],
    ["Kartik Kartik 2080 1 15", "unrecognized", "unrecognized input"],
    ["15 Kartik 2080+", "unrecognized", "unrecognized input"],
    ["2080 Kartik 015", "ambiguous", "ambiguous input"],
  ])("%s reaches the lenient failure", (input, kind, message) => {
    expect(messageOf(() => NepaliDate.parseLenient(input))).toEqual({ kind, message });
  });

  test("a trailing dot in a numeric chunk is an empty piece and is skipped", () => {
    expect(NepaliDate.parseLenient("15. Kartik 2080").toJSON()).toBe("2080-07-15");
  });

  test("the last Devanagari digit is a digit in lenient input", () => {
    expect(NepaliDate.parseLenient("१९ Kartik २०८०").toJSON()).toBe("2080-07-19");
  });

  test.each([
    ["foo", "unrecognized", "unrecognized input"],
    ["Kartik Magh 2080", "unrecognized", "unrecognized input"],
    ["Kartik Magh 2080 1", "unrecognized", "unrecognized input"],
    ["15 Kartik 80", "ambiguous", "ambiguous input"],
    ["15 Kartik 2080 1", "unrecognized", "unrecognized input"],
    ["15 Kartik 080", "ambiguous", "ambiguous input"],
    ["12345", "number-too-long", "a number has more than 4 digits"],
    ["2080 foo 7 15", "unrecognized", "unrecognized input"],
    ["15-2080.7", "ambiguous", "ambiguous input"],
    ["Kartik 2080", "unrecognized", "unrecognized input"],
  ])("%s names its failure", (input, kind, message) => {
    expect(messageOf(() => NepaliDate.parseLenient(input))).toEqual({ kind, message });
  });

  test("गते and मिति are skipped words", () => {
    expect(NepaliDate.parseLenient("15 गते Kartik 2080").toJSON()).toBe("2080-07-15");
    expect(NepaliDate.parseLenient("15 मिति Kartik 2080").toJSON()).toBe("2080-07-15");
  });

  test("every lenient separator is accepted", () => {
    for (const separator of ["-", "/", "_", "\\", " ", "।", "|", ","]) {
      expect(NepaliDate.parseLenient(`15${separator}Kartik${separator}2080`).toJSON()).toBe(
        "2080-07-15",
      );
    }
  });

  test("dots separate numeric pieces", () => {
    expect(NepaliDate.parseLenient("2080.7.15").toJSON()).toBe("2080-07-15");
    expect(NepaliDate.parseLenient("2080..7.15").toJSON()).toBe("2080-07-15");
  });

  test("a word in a numeric slot is not a number", () => {
    expect(messageOf(() => NepaliDate.parseLenient("Kartik foo 2080"))).toEqual({
      kind: "unrecognized",
      message: "unrecognized input",
    });
  });

  test("era names are ignored in every documented spelling", () => {
    for (const era of [
      "bs",
      "b.s.",
      "b.s",
      "vs",
      "v.s.",
      "v.s",
      "बि.सं.",
      "वि.सं.",
      "बि.सं",
      "वि.सं",
    ]) {
      expect(NepaliDate.parseLenient(`15 Kartik 2080 ${era}`).toJSON()).toBe("2080-07-15");
    }
  });

  test("one and three digit fields are ambiguous or accepted as documented", () => {
    expect(NepaliDate.parseLenient("5 Kartik 2080").toJSON()).toBe("2080-07-05");
    expect(NepaliDate.parseLenient("2080 Kartik 5").toJSON()).toBe("2080-07-05");
    expect(NepaliDate.parseLenient("15 Kartik 2080").toJSON()).toBe("2080-07-15");
    expect(messageOf(() => NepaliDate.parseLenient("005 Kartik 2080"))).toEqual({
      kind: "ambiguous",
      message: "ambiguous input",
    });
  });
});
