// Machine load for the benchmark report (BENCHMARK §5). Three figures matter: the busy share of
// the logical CPU the benchmark is pinned to, the busy share of all CPUs, and the busy share of
// every CPU except the pinned one while the row runs. The before-row all-CPU figure and the
// during-row background figure decide whether a row is quiet enough for a target verdict
// (ADR-0006); the core figure is reported next to them. None is the process's own CPU time.

import { cpus } from "node:os";

export interface CpuTimes {
  readonly idle: number;
  readonly total: number;
}

function timesOf(index: number): CpuTimes {
  const cpu = cpus()[index];
  if (cpu === undefined) throw new Error(`logical CPU ${index} does not exist`);
  const t = cpu.times;
  return {
    idle: t.idle,
    total: t.user + t.nice + t.sys + t.irq + t.idle,
  };
}

/** One snapshot of every logical CPU's cumulative idle and total time. */
export function snapshot(): CpuTimes[] {
  return cpus().map((cpu) => ({
    idle: cpu.times.idle,
    total: cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle,
  }));
}

function sum(times: readonly CpuTimes[]): CpuTimes {
  let idle = 0;
  let total = 0;
  for (const cpu of times) {
    idle += cpu.idle;
    total += cpu.total;
  }
  return { idle, total };
}

/** Busy percentage between two cumulative samples, 0 to 100. */
export function busyPercent(before: CpuTimes, after: CpuTimes): number {
  const total = after.total - before.total;
  if (total <= 0) return 0;
  const idle = after.idle - before.idle;
  return Math.max(0, Math.min(100, (1 - idle / total) * 100));
}

/**
 * Mean busy percentage of every CPU except `exclude`, 0 to 100. The benchmark keeps the pinned
 * CPU busy, so the background figure leaves it out. Each CPU has the same weight, not each tick.
 */
export function meanBusy(
  before: readonly CpuTimes[],
  after: readonly CpuTimes[],
  exclude: number,
): number {
  if (before.length !== after.length) throw new Error("CPU snapshots have different lengths");
  let sumBusy = 0;
  let count = 0;
  for (let i = 0; i < before.length; i++) {
    if (i === exclude) continue;
    sumBusy += busyPercent(before[i] as CpuTimes, after[i] as CpuTimes);
    count++;
  }
  return count === 0 ? 0 : sumBusy / count;
}

/** A row is quiet only when both load figures are at most the limit. */
export function decideLoaded(allLoad: number, backgroundLoad: number, limit = 15): boolean {
  return allLoad > limit || backgroundLoad > limit;
}

/** Busy percentage of all CPUs over `windowMs`, 0 to 100. */
export async function machineLoad(windowMs = 250): Promise<number> {
  const before = sum(snapshot());
  await new Promise((resolve) => setTimeout(resolve, windowMs));
  return busyPercent(before, sum(snapshot()));
}

/** Busy percentage of one logical CPU over `windowMs`, 0 to 100. */
export async function coreLoad(index: number, windowMs = 250): Promise<number> {
  const before = timesOf(index);
  await new Promise((resolve) => setTimeout(resolve, windowMs));
  return busyPercent(before, timesOf(index));
}

/**
 * Mean busy percentage of every CPU except `exclude` over `windowMs`, 0 to 100. `exclude` is the
 * pinned benchmark CPU (2 by default).
 */
export async function backgroundLoad(exclude = 2, windowMs = 250): Promise<number> {
  const before = snapshot();
  await new Promise((resolve) => setTimeout(resolve, windowMs));
  return meanBusy(before, snapshot(), exclude);
}
