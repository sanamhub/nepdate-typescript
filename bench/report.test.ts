// Unit tests for the BenchmarkDotNet CSV reader (T7-03). Run from the repository root:
//   node --test bench/report.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseReportText, scaled } from "./dotnet-report.ts";

const CSV = [
  "Method,Runtime,Mean,Allocated",
  "'B1 BS to AD',.NET 10.0,20.00 ns,0 B",
  "'B2 AD to BS',.NET 10.0,1.5 μs,1 KB",
  "'B3 add 1000 days',.NET 10.0,2.5 µs,2 KB",
  '"\'B4 add 13 months, Clamp\'",.NET 10.0,"3,132.66 ns",-',
  "\"'B5 long format, Nepali, weekday'\",.NET 10.0,153.02 ns,435 B",
  "'B6 strict parse',.NET 10.0,31.39 ns,0 B",
  "'B7 patro info',.NET 10.0,63.77 ns,51 B",
  "'B8 patro month grid',.NET 10.0,1 ms,1 MB",
  "'B1 BS to AD',.NET 8.0,1 ns,0 B",
].join("\n");

test("reads ns, microseconds, milliseconds and byte units", () => {
  const rows = parseReportText(CSV);
  const byOp = new Map(rows.map((row) => [row.op, row]));
  assert.equal(byOp.size, 8);
  assert.equal(byOp.get("B1")?.ns, 20);
  assert.equal(byOp.get("B2")?.ns, 1500);
  assert.equal(byOp.get("B3")?.ns, 2500);
  assert.equal(byOp.get("B4")?.ns, 3132.66);
  assert.equal(byOp.get("B5")?.ns, 153.02);
  assert.equal(byOp.get("B6")?.ns, 31.39);
  assert.equal(byOp.get("B7")?.ns, 63.77);
  assert.equal(byOp.get("B8")?.ns, 1e6);
  assert.equal(byOp.get("B2")?.heapBytes, 1024);
  assert.equal(byOp.get("B3")?.heapBytes, 2048);
  assert.equal(byOp.get("B8")?.heapBytes, 1024 * 1024);
});

test("keeps a quoted method name with a comma and reads a dash as no allocation", () => {
  const rows = parseReportText(CSV);
  const b4 = rows.find((row) => row.op === "B4");
  assert.equal(b4?.ns, 3132.66);
  assert.equal(b4?.heapBytes, null);
});

test("ignores the .NET 8 rows", () => {
  const rows = parseReportText(CSV);
  assert.equal(rows.length, 8);
  assert.equal(
    rows.some((row) => row.impl.includes("2.0.7")),
    true,
  );
});

test("throws on an unknown unit", () => {
  const bad = [
    "Method,Runtime,Mean,Allocated",
    "'B1 BS to AD',.NET 10.0,1.0 Ps,0 B",
    "'B2 AD to BS',.NET 10.0,1.0 ns,0 B",
    "'B3 add 1000 days',.NET 10.0,1.0 ns,0 B",
    "'B4 add 13 months, Clamp',.NET 10.0,1.0 ns,0 B",
    "'B5 long format, Nepali, weekday',.NET 10.0,1.0 ns,0 B",
    "'B6 strict parse',.NET 10.0,1.0 ns,0 B",
    "'B7 patro info',.NET 10.0,1.0 ns,0 B",
    "'B8 patro month grid',.NET 10.0,1.0 ns,0 B",
  ].join("\n");
  assert.throws(() => parseReportText(bad), /unknown unit in "1\.0 Ps"/);
});

test("scaled reads a comma group and rejects an unknown unit", () => {
  assert.equal(scaled("3,132.66 ns", { ns: 1 }), 3132.66);
  assert.equal(scaled("1 KB", { KB: 1024 }), 1024);
  assert.throws(() => scaled("2 PB", { KB: 1024 }), /unknown unit/);
});
