// Machine load for the benchmark report (BENCHMARK §5): the busy share of all CPUs over a short
// window, sampled just before a measurement. It is not the process's own CPU time, so a number
// above a few percent means other work was running on the machine.

import { cpus } from "node:os";

interface Sample {
  readonly idle: number;
  readonly total: number;
}

function sample(): Sample {
  let idle = 0;
  let total = 0;
  for (const cpu of cpus()) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }
  return { idle, total };
}

/** Busy percentage of all CPUs over `windowMs`, 0 to 100. */
export async function machineLoad(windowMs = 250): Promise<number> {
  const before = sample();
  await new Promise((resolve) => setTimeout(resolve, windowMs));
  const after = sample();
  const total = after.total - before.total;
  if (total <= 0) return 0;
  const idle = after.idle - before.idle;
  return Math.max(0, Math.min(100, (1 - idle / total) * 100));
}
