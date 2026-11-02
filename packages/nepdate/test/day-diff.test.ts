import { describe, expect, test } from "vitest";
import { NepaliDate } from "../src/index.js";
import { bs } from "./helpers.js";
import { readVectors } from "./vectors.js";

// day-diff.tsv is recorded from C# in both directions (D-07): `days_until` is `b - a` and
// `operator_minus` is `a - b`. TypeScript has no operator overload (API.md NA05), so the operator
// column is asserted through the named method with the operands swapped, which is the same
// direction a port with `-` must keep.
describe("day-diff.tsv", () => {
  const rows = readVectors("csharp-golden/day-diff.tsv");

  test("16 rows", () => expect(rows).toHaveLength(16));

  test("daysUntil is other - this (NA04)", () => {
    for (const row of rows) {
      const a = bs(row.a as string);
      const b = bs(row.b as string);
      expect(a.daysUntil(b), `${row.a} -> ${row.b}`).toBe(Number(row.days_until));
      expect(a.diff(b).totalDays, `${row.a} diff ${row.b}`).toBe(Number(row.days_until));
    }
  });

  test("the operator direction is b.daysUntil(a) (NA05)", () => {
    for (const row of rows) {
      const a = bs(row.a as string);
      const b = bs(row.b as string);
      expect(b.daysUntil(a), `${row.b} -> ${row.a}`).toBe(Number(row.operator_minus));
    }
  });

  test("the two directions are opposites and zero is zero", () => {
    const a = NepaliDate.of(2081, 4, 15);
    expect(a.daysUntil(a)).toBe(0);
    expect(a.daysUntil(a.addDays(3))).toBe(3);
    expect(a.addDays(3).daysUntil(a)).toBe(-3);
    expect(a.diff(a).negative).toBe(false);
    expect(a.diff(a).totalDays).toBe(0);
  });
});
