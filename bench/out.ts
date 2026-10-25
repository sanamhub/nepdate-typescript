// The `--out <dir>` writer for the benchmark scripts (ADR-0008). Every future benchmark pass
// commits its JSON under bench/results/<date>/ so a number on docs/benchmarks.md has a source in
// the tree.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** The `--out` directory, resolved, or null when the flag is absent. */
export function outDir(): string | null {
  const index = process.argv.indexOf("--out");
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error("missing --out");
  return resolve(value);
}

/** Write `value` as `<dir>/<name>.json` when a directory was given; print the path. */
export function writeReport(dir: string | null, name: string, value: unknown): void {
  if (dir === null) return;
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`wrote ${file}`);
}
