// B1 and B2 of shared/spec/BENCHMARK.md for every package in docs/competitors.md, on the 64 dates of
// BENCHMARK §2. Every (package, direction) pair is measured in a fresh pinned process by
// bench/measure.ts (T6-01). Agreement is judged only on the package's documented range (T6-03).
// Run from the repository root:
//   node bench/compare.ts
//   node bench/compare.ts --check
//   node bench/compare.ts --json > compare.json

import { outDir, writeReport } from "./out.ts";
import { type RowResult, runMeasure } from "./protocol.ts";
import { COMPETITOR_RANGES, isoDay } from "./ranges.ts";

const checkOnly = process.argv.includes("--check");
const extra = process.argv.includes("--no-wait") ? ["--no-wait"] : [];
const out = outDir();
const rows: RowResult[] = [];
for (const competitor of COMPETITOR_RANGES) {
  for (const op of ["B1", "B2"] as const) {
    process.stderr.write(`compare: ${competitor.id} ${op}${checkOnly ? " (check only)" : ""}\n`);
    rows.push(await runMeasure(competitor.id, op, checkOnly, extra));
  }
}

const report = {
  node: process.version,
  started: new Date().toISOString(),
  affinity: "4",
  checkOnly,
  rows,
};
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else if (checkOnly) {
  console.log(`node ${process.version}, 18 agreement checks, no measurements`);
  for (const row of rows) {
    const range = COMPETITOR_RANGES.find((entry) => entry.id === row.impl);
    const direction = row.op === "B1" ? range?.bs : range?.ad;
    const source = direction === undefined ? "" : ` [${direction.basis}: ${direction.source}]`;
    const out = row.outOfRange.length === 0 ? "none" : row.outOfRange.join(", ");
    console.log(
      `${row.impl}  ${row.op}  ${row.inRange}/64 in range  ${
        row.agrees ? "agrees" : "DISAGREES"
      }  out of range: ${out}${source}`,
    );
    if (row.firstMismatch !== null) console.log(`  first mismatch in range: ${row.firstMismatch}`);
  }
} else {
  console.log(
    `node ${process.version}, ${rows.length} rows, one process each, affinity 4, ns/op over in-range dates`,
  );
  for (const competitor of COMPETITOR_RANGES) {
    console.log(`\n${competitor.id}`);
    console.log(
      `  BS ${isoDay(competitor.bs.from)}..${isoDay(competitor.bs.to)} (${competitor.bs.basis})  ` +
        `AD ${isoDay(competitor.ad.from)}..${isoDay(competitor.ad.to)} (${competitor.ad.basis})`,
    );
    for (const row of rows.filter((entry) => entry.impl === competitor.id)) {
      const ns = row.ns === null ? "n/a" : row.ns.toFixed(1);
      const status = row.loaded ? "LOADED" : "final";
      const out = row.outOfRange.length === 0 ? "none" : `${row.outOfRange.length} dates`;
      const during = row.backgroundLoad === null ? "n/a" : `${Math.round(row.backgroundLoad)}%`;
      console.log(
        `  ${row.op}  ${ns.padStart(9)} ns/op  n=${String(row.n).padStart(2)}  ` +
          `in-range ${row.inRange}/64  out ${out}  core ${String(
            Math.round(row.coreLoad ?? 0),
          ).padStart(3)}%  all ${String(Math.round(row.allLoad ?? 0)).padStart(3)}%  ` +
          `during ${during.padStart(4)}  ${String(row.attempts)} tries  ${status.padEnd(6)}  ${
            row.agrees ? "agrees" : "DISAGREES"
          }`,
      );
      if (row.firstMismatch !== null) console.log(`        first mismatch: ${row.firstMismatch}`);
      if (row.throws > 0) console.log(`        ${row.throws} date(s) throw inside the range`);
    }
  }
}
writeReport(out, "compare", report);
