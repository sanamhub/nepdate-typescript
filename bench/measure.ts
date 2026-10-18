// One benchmark row in one fresh process (T6-01). Run by bench/own.ts, bench/compare.ts and
// bench/order.ts, never directly. It prints exactly one JSON object on stdout.

import { setTimeout as delay } from "node:timers/promises";
import { do_not_optimize, measure } from "mitata";
import { INPUTS, loadCompetitor } from "./competitors.ts";
import { coreLoad, machineLoad } from "./load.ts";
import type { CoreOp } from "./own-core.ts";
import { LOAD_LIMIT, LOAD_RETRIES, LOAD_WAIT_MS, type RowResult } from "./protocol.ts";
import { COMPETITOR_RANGES, inRange, isoDay, type Range } from "./ranges.ts";

interface LoadSample {
  readonly core: number;
  readonly all: number;
  readonly attempts: number;
  readonly loaded: boolean;
}

async function sampleLoad(): Promise<{ core: number; all: number }> {
  const [core, all] = await Promise.all([coreLoad(2), machineLoad()]);
  return { core, all };
}

async function waitForQuiet(): Promise<LoadSample> {
  if (process.argv.includes("--no-wait")) {
    const sample = await sampleLoad();
    return { ...sample, attempts: 1, loaded: sample.all > LOAD_LIMIT };
  }
  let attempts = 0;
  let sample = { core: 0, all: 0 };
  do {
    if (attempts > 0) await delay(LOAD_WAIT_MS);
    sample = await sampleLoad();
    attempts++;
  } while (sample.all > LOAD_LIMIT && attempts <= LOAD_RETRIES);
  return { ...sample, attempts, loaded: sample.all > LOAD_LIMIT };
}

function argument(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`missing --${name}`);
  return value;
}

interface Agreement {
  readonly inRange: number;
  readonly outOfRange: readonly string[];
  readonly agrees: boolean;
  readonly firstMismatch: string | null;
  readonly throws: number;
  readonly measured: readonly number[];
}

function agreement(
  impl: Awaited<ReturnType<typeof loadCompetitor>>,
  range: Range,
  direction: "B1" | "B2",
): Agreement {
  const inRangeIndices: number[] = [];
  const outOfRange: string[] = [];
  for (let i = 0; i < INPUTS.length; i++) {
    const input = INPUTS[i] as (typeof INPUTS)[number];
    const date = direction === "B1" ? input.bs : input.ad;
    if (inRange(date, range)) inRangeIndices.push(i);
    else outOfRange.push(`${direction === "B1" ? "BS" : "AD"} ${isoDay(date)}`);
  }

  let agrees = true;
  let firstMismatch: string | null = null;
  const failed = new Set<number>();
  for (const i of inRangeIndices) {
    const input = INPUTS[i] as (typeof INPUTS)[number];
    const expected = direction === "B1" ? input.adIso : input.bsIso;
    let actual: string;
    try {
      actual = direction === "B1" ? impl.b1Iso(i) : impl.b2Iso(i);
    } catch (error) {
      failed.add(i);
      actual = `throws ${String(error)}`;
    }
    if (actual !== expected) {
      agrees = false;
      const label = direction === "B1" ? `BS ${input.bsIso}` : `AD ${input.adIso}`;
      firstMismatch ??= `${label}: ${actual}, expected ${expected}`;
    }
    // A call that throws can't be timed, but it stays a mismatch. Probe with the timed function so
    // the subset matches what measure() will actually call.
    try {
      if (direction === "B1") impl.b1(i);
      else impl.b2(i);
    } catch {
      failed.add(i);
    }
  }
  return {
    inRange: inRangeIndices.length,
    outOfRange,
    agrees,
    firstMismatch,
    throws: failed.size,
    measured: inRangeIndices.filter((i) => !failed.has(i)),
  };
}

const impl = argument("impl");
const op = argument("op");
const checkOnly = process.argv.includes("--check");

if (!/^B[1-8]$/.test(op)) throw new Error(`unknown operation ${op}`);
if (impl !== "nepdate" && op !== "B1" && op !== "B2") {
  throw new Error(`competitors are measured on B1 and B2 only, not ${op}`);
}
if (checkOnly && impl === "nepdate") {
  throw new Error("--check needs a competitor; nepdate does not have an agreement row");
}

if (impl === "nepdate") {
  let ops: readonly CoreOp[];
  if (op === "B7" || op === "B8") {
    const module = await import("./own-patro.ts");
    ops = module.PATRO_OPS;
  } else {
    const module = await import("./own-core.ts");
    ops = module.CORE_OPS;
  }
  const opDef = ops.find((row) => row.id === op);
  if (opDef === undefined) throw new Error(`no own implementation for ${op}`);

  const load = await waitForQuiet();
  const stats = await measure(opDef.run, { heap: () => process.memoryUsage().heapUsed });
  const heap = (stats as { heap?: { avg: number } }).heap;
  const row: RowResult = {
    impl,
    op,
    pid: process.pid,
    ns: stats.avg / opDef.n,
    n: opDef.n,
    inRange: opDef.n,
    outOfRange: [],
    agrees: null,
    firstMismatch: null,
    throws: 0,
    coreLoad: load.core,
    allLoad: load.all,
    attempts: load.attempts,
    loaded: load.loaded,
    heapBytes: heap === undefined ? null : heap.avg / opDef.n,
    checkOnly: false,
  };
  console.log(JSON.stringify(row));
} else {
  const meta = COMPETITOR_RANGES.find((entry) => entry.id === impl);
  if (meta === undefined) throw new Error(`no range for ${impl}`);
  const competitor = await loadCompetitor(impl);
  const range = op === "B1" ? meta.bs : meta.ad;
  const check = agreement(competitor, range, op as "B1" | "B2");

  if (checkOnly) {
    const row: RowResult = {
      impl,
      op,
      pid: process.pid,
      ns: null,
      n: 0,
      inRange: check.inRange,
      outOfRange: check.outOfRange,
      agrees: check.agrees,
      firstMismatch: check.firstMismatch,
      throws: check.throws,
      coreLoad: null,
      allLoad: null,
      attempts: 0,
      loaded: false,
      heapBytes: null,
      checkOnly: true,
    };
    console.log(JSON.stringify(row));
  } else {
    const load = await waitForQuiet();
    let ns: number | null = null;
    if (check.measured.length > 0) {
      const stats = await measure(() => {
        for (const i of check.measured) {
          do_not_optimize(op === "B1" ? competitor.b1(i) : competitor.b2(i));
        }
      });
      ns = stats.avg / check.measured.length;
    }
    const row: RowResult = {
      impl,
      op,
      pid: process.pid,
      ns,
      n: check.measured.length,
      inRange: check.inRange,
      outOfRange: check.outOfRange,
      agrees: check.agrees,
      firstMismatch: check.firstMismatch,
      throws: check.throws,
      coreLoad: load.core,
      allLoad: load.all,
      attempts: load.attempts,
      loaded: load.loaded,
      heapBytes: null,
      checkOnly: false,
    };
    console.log(JSON.stringify(row));
  }
}
