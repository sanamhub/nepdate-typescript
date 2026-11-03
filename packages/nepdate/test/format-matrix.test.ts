import { describe, expect, test } from "vitest";
import { type DateOrder, type Lang, NepaliDate, type Separator } from "../src/index.js";
import { bs } from "./helpers.js";
import { readVectors } from "./vectors.js";

const ORDER: Record<string, DateOrder> = {
  Ymd: "ymd",
  Ydm: "ydm",
  Myd: "myd",
  Mdy: "mdy",
  Dym: "dym",
  Dmy: "dmy",
};

const SEPARATOR: Record<string, Separator> = {
  Slash: "/",
  Backslash: "\\",
  Dot: ".",
  Underscore: "_",
  Dash: "-",
  Space: " ",
};

// A typo in the table must fail the run, not quietly produce a default.
function orderOf(text: string): DateOrder {
  const order = ORDER[text];
  if (order === undefined) throw new Error(`unknown order ${text}`);
  return order;
}

function separatorOf(text: string): Separator {
  const separator = SEPARATOR[text];
  if (separator === undefined) throw new Error(`unknown separator ${text}`);
  return separator;
}

// format-matrix.tsv records the six orders, the six separators, the pad choice and the D-15
// Nepali rows (NF02, NF08, NF09) plus the C# ISpanFormattable.TryFormat buffer cases (NF07).
// A string return cannot fail to fit a buffer, and the port has no span formatter (API.md NF07,
// TypeScript column: "none; string return"), so the try_format rows have no counterpart here.
describe("format-matrix.tsv", () => {
  const rows = readVectors("csharp-golden/format-matrix.tsv");
  const short = rows.filter((row) => row.kind === "short");
  const tryFormat = rows.filter((row) => row.kind === "try_format");

  test("102 rows: 94 short, 8 try_format", () => {
    expect(rows).toHaveLength(102);
    expect(short).toHaveLength(94);
    expect(tryFormat).toHaveLength(8);
  });

  test("every short row: order, separator, pad and lang", () => {
    for (const row of short) {
      const date = bs(row.bs as string);
      const actual = date.short({
        order: orderOf(row.order as string),
        separator: separatorOf(row.separator as string),
        pad: row.pad === "true",
        lang: row.lang as Lang,
      });
      expect(actual, `${row.bs} ${row.order} ${row.separator} ${row.pad} ${row.lang}`).toBe(
        row.result,
      );
    }
  });

  test("every try_format row's text is what format() returns", () => {
    // The capacity column only says whether C# could write into a clamped buffer, so the port
    // checks the text the row would have held. NF07 has no port surface.
    for (const row of tryFormat) {
      const date = bs(row.bs as string);
      const pattern = row.format as string;
      const text = pattern === "default" ? date.toString() : date.format(pattern);
      if (row.result === "ERR") {
        expect(text.length, `${row.bs} ${pattern} ${row.capacity}`).toBeGreaterThan(
          Number(row.capacity),
        );
      } else {
        expect(text, `${row.bs} ${pattern} ${row.capacity}`).toBe(row.result);
      }
    }
  });
});
