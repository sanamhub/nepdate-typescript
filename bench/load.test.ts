// Unit tests for the load split and the quiet decision (ADR-0008). These use synthetic samples and
// do not spawn a benchmark.

import { strict as assert } from "node:assert";
import test from "node:test";
import { type CpuTimes, decideLoaded, meanBusy } from "./load.ts";

const START: CpuTimes = { idle: 0, total: 0 };

// A CPU that spent `busy` percent of a 100 tick window busy.
function cpu(busy: number): CpuTimes {
  return { idle: 100 - busy, total: 100 };
}

test("meanBusy leaves out the pinned CPU", () => {
  const before = [START, START, START, START];
  const after = [cpu(10), cpu(20), cpu(90), cpu(40)];
  // CPU 2 is the pinned one and its 90% does not count: (10 + 20 + 40) / 3.
  assert.equal(meanBusy(before, after, 2), 70 / 3);
});

test("meanBusy weights each CPU the same", () => {
  const before = [START, START, START];
  const after = [cpu(0), cpu(30), cpu(60)];
  assert.equal(meanBusy(before, after, 0), 45);
});

test("meanBusy rejects snapshots of different lengths", () => {
  assert.throws(() => meanBusy([START], [], 0), /different lengths/);
});

test("a background sample above 15% marks the row LOADED", () => {
  // The before-row all-CPU figure is quiet, the during-row figure is not.
  assert.equal(decideLoaded(5, 20), true);
  assert.equal(decideLoaded(20, 5), true);
});

test("15% exactly is loaded; 14.9% is quiet", () => {
  assert.equal(decideLoaded(14.9, 14.9), false);
  assert.equal(decideLoaded(15, 14.9), true);
  assert.equal(decideLoaded(14.9, 15), true);
});
