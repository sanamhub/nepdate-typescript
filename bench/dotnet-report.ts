// BenchmarkDotNet CSV reader (T7-03). The report prints a unit with every cell and picks the unit
// per column, so the unit is read, not assumed. This module is kept free of child-process and file
// system imports so the parser can be unit-tested directly.

import { readFileSync } from "node:fs";
import type { RowResult } from "./protocol.ts";

const OP_NAMES: Record<string, string> = {
  "B1 BS to AD": "B1",
  "B2 AD to BS": "B2",
  "B3 add 1000 days": "B3",
  "B4 add 13 months, Clamp": "B4",
  "B5 long format, Nepali, weekday": "B5",
  "B6 strict parse": "B6",
  "B7 patro info": "B7",
  "B8 patro month grid": "B8",
};

const TIME = { ns: 1, μs: 1e3, µs: 1e3, us: 1e3, ms: 1e6, s: 1e9 };
const BYTES = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };

export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i] as string;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

export function scaled(text: string, units: Record<string, number>): number {
  const match = /^\s*(-?[\d,]*\.?\d+)\s*(\S+)\s*$/.exec(text);
  if (match === null) return Number.NaN;
  const factor = units[match[2] as string];
  if (factor === undefined) throw new Error(`unknown unit in "${text}"`);
  return Number.parseFloat((match[1] as string).replaceAll(",", "")) * factor;
}

export function parseReportText(text: string, source = "report"): RowResult[] {
  const lines = text.split(/\r?\n/).filter((line) => line !== "");
  const header = parseCsvLine(lines[0] as string);
  const column = (name: string): number => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`BenchmarkDotNet report has no ${name} column`);
    return index;
  };
  const method = column("Method");
  const runtime = column("Runtime");
  const mean = column("Mean");
  const allocated = column("Allocated");

  const rows: RowResult[] = [];
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    if (fields[runtime] !== ".NET 10.0") continue;
    // BenchmarkDotNet single-quotes a method name that contains a comma.
    const methodName = (fields[method] as string).replace(/^'|'$/g, "");
    const name = OP_NAMES[methodName];
    if (name === undefined) continue;
    const ns = scaled(fields[mean] as string, TIME);
    // "-" means BenchmarkDotNet measured no allocation column for the row.
    const bytes =
      fields[allocated] === "-" ? Number.NaN : scaled(fields[allocated] as string, BYTES);
    if (!Number.isFinite(ns)) throw new Error(`no mean in ${line}`);
    rows.push({
      impl: "C# NepDate 2.0.7 (.NET 10)",
      op: name,
      pid: 0,
      ns,
      n: 64,
      inRange: 64,
      outOfRange: [],
      agrees: null,
      firstMismatch: null,
      throws: 0,
      coreLoad: null,
      allLoad: null,
      backgroundLoad: null,
      attempts: 0,
      loaded: false,
      heapBytes: Number.isFinite(bytes) ? bytes : null,
      checkOnly: false,
    });
  }
  rows.sort((a, b) => a.op.localeCompare(b.op));
  if (rows.length !== 8) {
    throw new Error(`expected 8 .NET 10 rows, found ${rows.length} in ${source}`);
  }
  return rows;
}

export function parseReport(csvPath: string): RowResult[] {
  return parseReportText(readFileSync(csvPath, "utf8"), csvPath);
}
