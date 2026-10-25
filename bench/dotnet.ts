// Same-machine C# column (ADR-0006). Runs the hub's tools/dotnet-bench on this machine, in the same
// session as the TypeScript rows, and parses the .NET 10 rows out of BenchmarkDotNet's CSV report.
// The hub checkout defaults to ../nepdate and can be set with HUB_DIR. NuGet, build and benchmark
// caches go to DOTNET_CACHE (default: nepdate-dotnet-bench in the OS temp directory), so the hub
// checkout stays clean.
//
// Run from the repository root:
//   node bench/dotnet.ts
//   node bench/dotnet.ts --json > dotnet.json

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseReport } from "./dotnet-report.ts";
import { machineLoad } from "./load.ts";
import { outDir, writeReport } from "./out.ts";
import type { RowResult } from "./protocol.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HUB = resolve(process.env.HUB_DIR ?? join(ROOT, "..", "nepdate"));
const CACHE = resolve(process.env.DOTNET_CACHE ?? join(tmpdir(), "nepdate-dotnet-bench"));
const PROJECT = join(HUB, "tools", "dotnet-bench");
const jsonOutput = process.argv.includes("--json");
const out = outDir();

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
  writeReport(out, "dotnet", { rows });
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
writeReport(out, "dotnet", report);
