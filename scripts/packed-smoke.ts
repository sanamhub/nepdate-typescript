// Packs the three packages into a temporary directory, installs the tarballs offline in three
// clean projects and runs the three smoke modes (ADR-0009). The CI gate and the
// oldest-node job share this path. Run from the repository root: `node scripts/packed-smoke.ts`.

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
const picker = join(temp, "picker");
try {
  for (const project of [core, patro, picker]) {
    mkdirSync(project);
    writeFileSync(join(project, "package.json"), '{"private":true,"type":"module"}\n');
  }
  run(`npm pack -w nepdate-core --pack-destination "${temp}"`);
  run(`npm pack -w nepdate-patro --pack-destination "${temp}"`);
  run(`npm pack -w nepdate-datepicker --pack-destination "${temp}"`);
  const tarballs = readdirSync(temp).filter((name) => name.endsWith(".tgz"));
  const coreTar = tarballs.find((name) => name.startsWith("nepdate-core-"));
  const patroTar = tarballs.find((name) => name.startsWith("nepdate-patro-"));
  const pickerTar = tarballs.find((name) => name.startsWith("nepdate-datepicker-"));
  if (coreTar === undefined || patroTar === undefined || pickerTar === undefined) {
    throw new Error(`expected the three tarballs, found ${tarballs.join(", ") || "none"}`);
  }
  const install = "--offline --no-audit --no-fund --no-package-lock --ignore-scripts";
  run(`npm install --prefix "${core}" ${install} "${join(temp, coreTar)}"`);
  run(
    `npm install --prefix "${patro}" ${install} "${join(temp, coreTar)}" "${join(temp, patroTar)}"`,
  );
  run(
    `npm install --prefix "${picker}" ${install} "${join(temp, coreTar)}" "${join(temp, pickerTar)}"`,
  );
  runNode(join(ROOT, "scripts", "smoke.ts"), "--mode", "core", "--project", core);
  runNode(join(ROOT, "scripts", "smoke.ts"), "--mode", "patro", "--project", patro);
  runNode(join(ROOT, "scripts", "smoke.ts"), "--mode", "picker", "--project", picker);
  console.log("packed-smoke: core, patro and picker ok");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
