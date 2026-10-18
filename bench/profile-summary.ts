// Summarise a V8 .cpuprofile by self time (T7-05). Usage:
//   node bench/profile-summary.ts <file.cpuprofile> [top]
// The profile's samples and timeDeltas are in microseconds; a missing timeDelta counts as zero.

import { readFileSync } from "node:fs";

interface CallFrame {
  readonly functionName: string;
  readonly url: string;
  readonly lineNumber: number;
}

interface ProfileNode {
  readonly id: number;
  readonly callFrame: CallFrame;
}

interface Profile {
  readonly nodes: readonly ProfileNode[];
  readonly samples: readonly number[];
  readonly timeDeltas: readonly number[];
}

const path = process.argv[2];
if (path === undefined)
  throw new Error("usage: node bench/profile-summary.ts <file.cpuprofile> [top]");
const top = Number(process.argv[3] ?? 12);
const profile = JSON.parse(readFileSync(path, "utf8")) as Profile;
const byId = new Map(profile.nodes.map((node) => [node.id, node]));
const self = new Map<number, number>();
for (const [index, id] of profile.samples.entries()) {
  const delta = profile.timeDeltas[index] ?? 0;
  self.set(id, (self.get(id) ?? 0) + delta);
}
const total = [...self.values()].reduce((sum, value) => sum + value, 0);
const rows = [...self.entries()]
  .map(([id, micros]) => {
    const frame = byId.get(id)?.callFrame;
    return {
      name: frame?.functionName === "" ? "(anonymous)" : (frame?.functionName ?? "(unknown)"),
      url: (frame?.url ?? "").split("/").slice(-2).join("/"),
      line: (frame?.lineNumber ?? 0) + 1,
      micros,
    };
  })
  .sort((a, b) => b.micros - a.micros)
  .slice(0, top);

console.log(`profile ${path}`);
console.log(`sampled ${(total / 1000).toFixed(1)} ms`);
console.log("self ms  share  function (file:line)");
for (const row of rows) {
  console.log(
    `${(row.micros / 1000).toFixed(2).padStart(7)}  ${((row.micros / total) * 100)
      .toFixed(1)
      .padStart(5)}%  ${row.name} (${row.url}:${row.line})`,
  );
}
