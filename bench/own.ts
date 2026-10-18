// B1 to B8 of shared/spec/BENCHMARK.md. Every row is measured in a fresh pinned process by
// bench/measure.ts, so a row never shares a JIT, heap or import graph with another row (T6-01).
// Run from the repository root:
//   node bench/own.ts
//   node bench/own.ts --json > own.json
// For the published numbers the parent is started from an idle shell; each child samples load
// before its measurement and retries when all CPUs are busier than 15% (T6-04).

import { outDir, writeReport } from "./out.ts";
import { OWN_OPS, type RowResult, runMeasure } from "./protocol.ts";

const started = new Date().toISOString();
const out = outDir();
const rows: RowResult[] = [];
for (const op of OWN_OPS) {
  process.stderr.write(`own: ${op.id} in a fresh process\n`);
  rows.push(await runMeasure("nepdate", op.id));
}

const report = { node: process.version, started, affinity: "4", rows };
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`node ${process.version}, ${rows.length} rows, one process each, affinity 4`);
  console.log("op  ns/op       n    all  core  during  tries  status  heap/op          operation");
  for (const row of rows) {
    const ns = row.ns === null ? "n/a" : row.ns.toFixed(1);
    const heap = row.heapBytes === null ? "n/a" : `${row.heapBytes.toFixed(0)} B approx.`;
    const status = row.loaded ? "LOADED" : "final";
    const during = row.backgroundLoad === null ? "n/a" : `${Math.round(row.backgroundLoad)}%`;
    const name = OWN_OPS.find((op) => op.id === row.op)?.name ?? "";
    console.log(
      `${row.op.padEnd(3)} ${ns.padStart(6)}  ${String(row.n).padStart(4)}  ${String(
        Math.round(row.allLoad ?? 0),
      ).padStart(3)}%  ${String(Math.round(row.coreLoad ?? 0)).padStart(3)}%  ${during.padStart(
        6,
      )}  ${String(row.attempts).padStart(5)}  ${status.padEnd(6)}  ${heap.padEnd(16)}  ${name}`,
    );
  }
}
writeReport(out, "own", report);
