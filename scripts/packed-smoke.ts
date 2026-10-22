// Packs both packages into a temporary directory, installs the tarballs offline in two clean
// projects and runs both smoke modes (T8-06, T9-01). Gate 11 and the oldest-node job share this
// path. Run from the repository root: `node scripts/packed-smoke.ts`.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

function run(command: string): void {
  console.log(`$ ${command}`);
  const result = spawnSync(command, { shell: true, stdio: ["ignore", "pipe", "inherit"] });
  if (result.status !== 0) {
    throw new Error(`${command} exited with ${String(result.status)}`);
  }
}

// Node 22.12 has type stripping behind a flag (ADR-0009). The parent may have been started with
// it, but a child does not inherit the flag unless it is passed or set in NODE_OPTIONS.
function runNode(file: string, ...args: string[]): void {
  const flags = process.features.typescript ? [] : ["--experimental-strip-types"];
  const result = spawnSync(process.execPath, [...flags, file, ...args], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${file} exited with ${String(result.status)}`);
  }
}

const temp = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "nepdate-smoke-"));
const core = join(temp, "core");
const patro = join(temp, "patro");
try {
  mkdirSync(core);
  mkdirSync(patro);
  writeFileSync(join(core, "package.json"), '{"private":true,"type":"module"}\n');
  writeFileSync(join(patro, "package.json"), '{"private":true,"type":"module"}\n');
  run(`npm pack -w @nepdate/core --pack-destination "${temp}"`);
  run(`npm pack -w @nepdate/patro --pack-destination "${temp}"`);
  const tarballs = readdirSync(temp).filter((name) => name.endsWith(".tgz"));
  const coreTar = tarballs.find((name) => name.startsWith("nepdate-core-"));
  const patroTar = tarballs.find((name) => name.startsWith("nepdate-patro-"));
  if (coreTar === undefined || patroTar === undefined) {
    throw new Error(`expected both tarballs, found ${tarballs.join(", ") || "none"}`);
  }
  const install = "--offline --no-audit --no-fund --no-package-lock --ignore-scripts";
  run(`npm install --prefix "${core}" ${install} "${join(temp, coreTar)}"`);
  run(
    `npm install --prefix "${patro}" ${install} "${join(temp, coreTar)}" "${join(temp, patroTar)}"`,
  );
  runNode(join(ROOT, "scripts", "smoke.ts"), "--mode", "core", "--project", core);
  runNode(join(ROOT, "scripts", "smoke.ts"), "--mode", "patro", "--project", patro);
  console.log("packed-smoke: core and patro ok");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
