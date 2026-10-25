// Order-dependence check for the one-process-per-row protocol. Each pair measures B1 alone, runs
// all 18 competitor rows in fresh processes, then measures B1 again. Five pairs take about a
// minute, so the load is close within a pair; the per-pair difference controls for the slow load
// drift that made the first, ten-minute version inconclusive. The competitor rows are agreement
// passes, not timed rows: the question is whether a competitor process leaves state behind for the
// next B1 process.
//
// Run from the repository root:
//   node bench/order.ts
//   node bench/order.ts --out bench/results/<date>

import { outDir, writeReport } from "./out.ts";
import { type RowResult, runMeasure, runNode } from "./protocol.ts";

const PAIRS = 5;
const LIMIT = 0.1;
const out = outDir();
const started = new Date().toISOString();

interface Pair {
  readonly before: RowResult;
  readonly after: RowResult;
  readonly difference: number;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
    : (sorted[middle] as number);
}

const pairs: Pair[] = [];
for (let i = 1; i <= PAIRS; i++) {
  process.stderr.write(`order: pair ${i}/${PAIRS}, B1 alone\n`);
  const before = await runMeasure("nepdate", "B1", false, ["--no-wait"]);
  process.stderr.write(`order: pair ${i}/${PAIRS}, every competitor row\n`);
  await runNode<{ rows: RowResult[] }>("compare.ts", ["--json", "--check", "--no-wait"]);
  process.stderr.write(`order: pair ${i}/${PAIRS}, B1 after competitors\n`);
  const after = await runMeasure("nepdate", "B1", false, ["--no-wait"]);
  pairs.push({
    before,
    after,
    difference: ((after.ns as number) - (before.ns as number)) / (before.ns as number),
  });
}

const before = median(pairs.map((pair) => pair.before.ns as number));
const after = median(pairs.map((pair) => pair.after.ns as number));
const difference = median(pairs.map((pair) => pair.difference));
const loadBefore = median(pairs.map((pair) => pair.before.allLoad ?? 0));
const loadAfter = median(pairs.map((pair) => pair.after.allLoad ?? 0));
const verdict =
  Math.abs(difference) <= LIMIT
    ? "no order effect detected"
    : Math.abs(loadAfter - loadBefore) > 10
      ? "inconclusive: load shifted within the pairs"
      : "ORDER EFFECT DETECTED";
const summary = {
  before,
  after,
  difference,
  loadBefore,
  loadAfter,
  limit: LIMIT,
  verdict,
};
const report = { node: process.version, started, affinity: "4", pairs, summary };

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("pair  B1 alone           B1 after all competitors  difference");
  for (const [index, pair] of pairs.entries()) {
    const beforeDuring =
      pair.before.backgroundLoad === null ? "n/a" : `${Math.round(pair.before.backgroundLoad)}%`;
    const afterDuring =
      pair.after.backgroundLoad === null ? "n/a" : `${Math.round(pair.after.backgroundLoad)}%`;
    console.log(
      `${String(index + 1).padStart(4)}  ${(pair.before.ns as number).toFixed(1).padStart(6)} ns  ` +
        `load ${String(Math.round(pair.before.allLoad ?? 0)).padStart(3)}%  ` +
        `during ${beforeDuring.padStart(4)}  ` +
        `${(pair.after.ns as number).toFixed(1).padStart(6)} ns  ` +
        `load ${String(Math.round(pair.after.allLoad ?? 0)).padStart(3)}%  ` +
        `during ${afterDuring.padStart(4)}  ` +
        `${(pair.difference * 100).toFixed(1).padStart(6)}%`,
    );
  }
  console.log(
    `\nmedian ${before.toFixed(1)} ns alone, ${after.toFixed(
      1,
    )} ns after competitors; median paired difference ${(difference * 100).toFixed(
      1,
    )}% (limit ${(LIMIT * 100).toFixed(0)}%, loads ${loadBefore.toFixed(0)}% and ${loadAfter.toFixed(
      0,
    )}%): ${verdict}`,
  );
}
writeReport(out, "order", report);
