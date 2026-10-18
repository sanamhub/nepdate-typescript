// Same-machine C# column (T6-02). Runs the hub's tools/dotnet-bench on this machine, in the same
// session as the TypeScript rows, and parses the .NET 10 rows out of BenchmarkDotNet's CSV report.
// The hub checkout defaults to ../nepdate and can be set with HUB_DIR. NuGet, build and benchmark
// caches go to D:\devcache\dotnet by default (DOTNET_CACHE overrides), so the hub checkout stays
// clean and the C: drive is not filled.
//
// Run from the repository root:
//   node bench/dotnet.ts
//   node bench/dotnet.ts --json > dotnet.json

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { machineLoad } from "./load.ts";
import type { RowResult } from "./protocol.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HUB = resolve(process.env.HUB_DIR ?? join(ROOT, "..", "nepdate"));
const CACHE = resolve(process.env.DOTNET_CACHE ?? "D:\\devcache\\dotnet");
const PROJECT = join(HUB, "tools", "dotnet-bench");
const jsonOutput = process.argv.includes("--json");

interface DotnetRun {
  readonly node: string;
  readonly started: string;
  readonly hub: string;
  readonly commit: string;
  readonly sdk: string;
  readonly runtime: string;
  readonly command: string;
  readonly artifacts: string;
  readonly loadBefore: number;
  readonly loadAfter: number;
  readonly loadMedian: number;
  readonly loadMax: number;
  readonly rows: readonly RowResult[];
}

const OP_NAMES: Record<string, string> = {
  "B1 BS to AD": "B1",
  "B2 AD to BS": "B2",
  "B3 add 1000 days": "B3",
  "B4 add 13 months, Clamp": "B4",
  "B5 long format, Nepali, weekday": "B5",
  "B6 strict parse": "B6",
  "B7 patro info": "B7",
  "B8 patro month grid": "B8",
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i] as string;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

function run(command: string, args: readonly string[], env?: NodeJS.ProcessEnv): string {
  const result = spawnSync(command, args, {
    cwd: HUB,
    encoding: "utf8",
    env: env ?? process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with ${String(result.status)}\n${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

function parseReport(csvPath: string): RowResult[] {
  const lines = readFileSync(csvPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line !== "");
  const header = parseCsvLine(lines[0] as string);
  const column = (name: string): number => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`BenchmarkDotNet report has no ${name} column`);
    return index;
  };
  const method = column("Method");
  const runtime = column("Runtime");
  const mean = column("Mean");
  const allocated = column("Allocated");

  const number = (text: string): number =>
    Number.parseFloat(text.replaceAll(",", "").replace(/[^0-9.-]/g, ""));
  const rows: RowResult[] = [];
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    if (fields[runtime] !== ".NET 10.0") continue;
    const methodName = (fields[method] as string).replace(/^'|'$/g, "");
    const name = OP_NAMES[methodName];
    if (name === undefined) continue;
    const ns = number(fields[mean] as string);
    const bytes = number(fields[allocated] as string);
    if (!Number.isFinite(ns)) throw new Error(`no mean in ${line}`);
    rows.push({
      impl: "C# NepDate 2.0.7 (.NET 10)",
      op: name,
      pid: 0,
      ns,
      n: 64,
      inRange: 64,
      outOfRange: [],
      agrees: null,
      firstMismatch: null,
      throws: 0,
      coreLoad: null,
      allLoad: null,
      attempts: 0,
      loaded: false,
      heapBytes: Number.isFinite(bytes) ? bytes : null,
      checkOnly: false,
    });
  }
  rows.sort((a, b) => a.op.localeCompare(b.op));
  if (rows.length !== 8) {
    throw new Error(`expected 8 .NET 10 rows, found ${rows.length} in ${csvPath}`);
  }
  return rows;
}

const csvIndex = process.argv.indexOf("--csv");
if (csvIndex >= 0) {
  const path = process.argv[csvIndex + 1];
  if (path === undefined) throw new Error("--csv needs a report path");
  const rows = parseReport(path);
  if (jsonOutput) {
    console.log(JSON.stringify({ rows }, null, 2));
  } else {
    for (const row of rows) console.log(`${row.op}  ${(row.ns as number).toFixed(2)} ns`);
  }
  process.exit(0);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
    : (sorted[middle] as number);
}

if (!existsSync(join(PROJECT, "DotnetBench.csproj"))) {
  throw new Error(`hub dotnet-bench not found at ${PROJECT}; set HUB_DIR`);
}

const env: NodeJS.ProcessEnv = {
  ...process.env,
  NUGET_PACKAGES: join(CACHE, "nuget"),
  DOTNET_CLI_HOME: join(CACHE, "cli"),
  TMP: join(CACHE, "tmp"),
  TEMP: join(CACHE, "tmp"),
  DOTNET_CLI_TELEMETRY_OPTOUT: "1",
  DOTNET_NOLOGO: "1",
};
for (const dir of ["nuget", "cli", "tmp", "bin", "obj", "artifacts"]) {
  mkdirSync(join(CACHE, dir), { recursive: true });
}
const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\..*/, "");
const artifacts = join(CACHE, "artifacts", stamp);
mkdirSync(artifacts, { recursive: true });

const commit = run("git", ["rev-parse", "HEAD"]);
const sdk = run("dotnet", ["--version"], env);
const runtimes = run("dotnet", ["--list-runtimes"], env)
  .split(/\r?\n/)
  .filter((line) => line.startsWith("Microsoft.NETCore.App 10."));
const runtime = runtimes.join("; ") || "10.x not found";
const args = [
  "run",
  "-c",
  "Release",
  "-f",
  "net10.0",
  `-p:BaseOutputPath=${join(CACHE, "bin")}\\`,
  `-p:BaseIntermediateOutputPath=${join(CACHE, "obj")}\\`,
  "--project",
  PROJECT,
  "--",
  "--filter",
  "*",
  "--artifacts",
  artifacts,
];
const command = `dotnet ${args.join(" ")}`;
const loadBefore = await machineLoad(500);
const samples: number[] = [];
let running = true;
const sampler = (async () => {
  while (running) {
    await delay(2_000);
    if (!running) break;
    samples.push(await machineLoad(500));
  }
})();

const started = new Date().toISOString();
if (!jsonOutput) console.log(`dotnet: ${command}`);
process.stderr.write(`dotnet: started ${started}, artifacts ${artifacts}\n`);
const child = spawn("dotnet", args, {
  cwd: HUB,
  env,
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
const progress = setInterval(() => {
  process.stderr.write(
    `dotnet: ${((Date.now() - Date.parse(started)) / 1000).toFixed(0)} s, load ${
      samples.length === 0 ? "n/a" : median(samples).toFixed(0)
    }%\n`,
  );
}, 30_000);
const code = await new Promise<number | null>((resolvePromise, reject) => {
  child.on("error", reject);
  child.on("close", resolvePromise);
});
clearInterval(progress);
running = false;
await sampler;
const loadAfter = await machineLoad(500);
if (code !== 0) {
  throw new Error(
    `dotnet run exited with ${String(code)}\n${stderr.trim()}\n${stdout.slice(-4000)}`,
  );
}

const results = join(artifacts, "results");
const csv = readdirSync(results)
  .filter((name) => name.endsWith("-report.csv"))
  .map((name) => join(results, name))
  .sort()
  .at(-1);
if (csv === undefined) throw new Error(`no BenchmarkDotNet CSV report under ${results}`);
const loadMedian = median(samples);
const loadMax = samples.length === 0 ? 0 : Math.max(...samples);
const rows = parseReport(csv).map((row) => ({
  ...row,
  allLoad: loadMedian,
  loaded: loadMedian > 15,
}));

const report: DotnetRun = {
  node: process.version,
  started,
  hub: HUB,
  commit,
  sdk,
  runtime,
  command,
  artifacts,
  loadBefore,
  loadAfter,
  loadMedian,
  loadMax,
  rows,
};

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `hub ${commit.slice(0, 8)}, .NET SDK ${sdk}, ${runtime}, load before ${loadBefore.toFixed(
      0,
    )}%, during median ${loadMedian.toFixed(0)}% (max ${loadMax.toFixed(0)}%), after ${loadAfter.toFixed(
      0,
    )}%`,
  );
  console.log("op  ns/op      bytes/op  load  status  method");
  for (const row of rows) {
    console.log(
      `${row.op}  ${(row.ns as number).toFixed(2).padStart(8)}  ${String(
        row.heapBytes ?? "n/a",
      ).padStart(8)}  ${String(Math.round(row.allLoad ?? 0)).padStart(4)}%  ${
        row.loaded ? "LOADED" : "final "
      }  C# NepDate 2.0.7`,
    );
  }
  console.log(`report ${csv}`);
}
