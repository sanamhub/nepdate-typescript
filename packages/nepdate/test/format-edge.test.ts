import { describe, expect, test } from "vitest";
import { clearFormatCache, formatCacheSize } from "../src/format.js";
import { NepaliDate } from "../src/index.js";

const d = NepaliDate.of(2081, 4, 15);

function format(pattern: string): string {
  clearFormatCache();
  return d.format(pattern);
}

describe("format pattern edge cases", () => {
  test("quoted text, terminated and unterminated", () => {
    expect(format("'abc'")).toBe("abc");
    expect(format("'abc")).toBe("abc");
    expect(format("''")).toBe("");
    expect(format("yyyy'x'MM")).toBe("2081x04");
  });

  test("a trailing backslash writes nothing and escapes the next character", () => {
    expect(format("yyyy\\")).toBe("2081");
    expect(format("\\y")).toBe("y");
    expect(format("\\M\\M")).toBe("MM");
  });

  test("two-letter years and repeated field letters", () => {
    expect(format("yy")).toBe("81");
    expect(format("yyyyy")).toBe("2081");
    expect(format("MMMM")).toBe("Shrawan");
    expect(format("ddd")).toBe("15");
  });

  test("mixed literals and fields keep every literal", () => {
    expect(format("yyyy-MM-dd")).toBe("2081-04-15");
    expect(format("dd.MM.yyyy")).toBe("15.04.2081");
    expect(format("'BS' yyyy")).toBe("BS 2081");
  });

  test("quoted field letters stay literal, also after a literal run", () => {
    expect(format("'yyyy'")).toBe("yyyy");
    expect(format("'dd MM'")).toBe("dd MM");
    expect(format("BS'yyyy'")).toBe("BSyyyy");
  });

  test("clearFormatCache empties the pattern cache", () => {
    d.format("yyyy MM");
    expect(formatCacheSize()).toBeGreaterThan(0);
    clearFormatCache();
    expect(formatCacheSize()).toBe(0);
  });
});
