// Machine load for the benchmark report (BENCHMARK §5). Two figures matter: the busy share of the
// logical CPU the benchmark is pinned to, and the busy share of all CPUs. The first decides whether a
// row is quiet enough for a target verdict; the second is reported next to it so a reader can see
// what else was running. Neither is the process's own CPU time.

import { cpus } from "node:os";

interface Sample {
  readonly idle: number;
  readonly total: number;
}

interface CpuTimes {
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

function allTimes(): Sample {
  let idle = 0;
  let total = 0;
  for (const cpu of cpus()) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }
  return { idle, total };
}

function busy(before: { idle: number; total: number }, after: { idle: number; total: number }) {
  const total = after.total - before.total;
  if (total <= 0) return 0;
  const idle = after.idle - before.idle;
  return Math.max(0, Math.min(100, (1 - idle / total) * 100));
}

/** Busy percentage of all CPUs over `windowMs`, 0 to 100. */
export async function machineLoad(windowMs = 250): Promise<number> {
  const before = allTimes();
  await new Promise((resolve) => setTimeout(resolve, windowMs));
  return busy(before, allTimes());
}

/** Busy percentage of one logical CPU over `windowMs`, 0 to 100. */
export async function coreLoad(index: number, windowMs = 250): Promise<number> {
  const before = timesOf(index);
  await new Promise((resolve) => setTimeout(resolve, windowMs));
  return busy(before, timesOf(index));
}
