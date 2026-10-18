// Shared benchmark protocol: the operation list, the JSON row the child returns, and the spawn
// helper that gives every row a fresh process pinned to logical CPU 2. The child never imports
// another row's package (T6-01).

import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** BENCHMARK §1: affinity mask 0x4 is logical CPU 2, a performance core on the reference machine. */
export const AFFINITY_MASK = "4";
export const LOAD_LIMIT = 15;
export const LOAD_RETRIES = 5;
export const LOAD_WAIT_MS = 5_000;

export interface OpMeta {
  readonly id: string;
  readonly name: string;
}

export const OWN_OPS: readonly OpMeta[] = [
  { id: "B1", name: "BS to AD: of(y, m, d).toGregorian()" },
  { id: "B2", name: "AD to BS: fromGregorian(g)" },
  { id: "B3", name: "addDays(1000)" },
  { id: "B4", name: "addMonths(13) clamp" },
  { id: "B5", name: "long({weekday: true, lang: 'ne'})" },
  { id: "B6", name: "parse('YYYY/MM/DD')" },
  { id: "B7", name: "patro info(date)" },
  { id: "B8", name: "month grid: of + info for every day" },
];

export interface RowResult {
  readonly impl: string;
  readonly op: string;
  readonly pid: number;
  readonly ns: number | null;
  readonly n: number;
  readonly inRange: number;
  readonly outOfRange: readonly string[];
  readonly agrees: boolean | null;
  readonly firstMismatch: string | null;
  readonly throws: number;
  readonly coreLoad: number | null;
  readonly allLoad: number | null;
  readonly backgroundLoad: number | null;
  readonly attempts: number;
  readonly loaded: boolean;
  readonly heapBytes: number | null;
  readonly checkOnly: boolean;
}

export interface SessionResult {
  readonly node: string;
  readonly started: string;
  readonly affinity: string;
  readonly rows: readonly RowResult[];
}

/** Spawn `node --expose-gc bench/<script> <args>` under `start /affinity 4 /wait /b`. */
export async function runNode<T>(script: string, args: readonly string[]): Promise<T> {
  const target = join(ROOT, "bench", script);
  const command = [
    "/d",
    "/c",
    "start",
    "",
    "/affinity",
    AFFINITY_MASK,
    "/wait",
    "/b",
    process.execPath,
    "--expose-gc",
    target,
    ...args,
  ];
  return await new Promise<T>((resolvePromise, reject) => {
    const child = spawn(process.env.ComSpec ?? "cmd.exe", command, {
      cwd: ROOT,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${script} ${args.join(" ")} exited with ${String(code)}\n${stderr.trim() || stdout.trim()}`,
          ),
        );
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout.trim()) as T);
      } catch (error) {
        reject(
          new Error(
            `${script} ${args.join(" ")} did not print JSON: ${String(error)}\nstdout: ${stdout.trim()}\nstderr: ${stderr.trim()}`,
          ),
        );
      }
    });
  });
}

export function runMeasure(
  impl: string,
  op: string,
  checkOnly = false,
  extra: readonly string[] = [],
): Promise<RowResult> {
  const args = ["--impl", impl, "--op", op];
  if (checkOnly) args.push("--check");
  args.push(...extra);
  return runNode<RowResult>("measure.ts", args);
}
