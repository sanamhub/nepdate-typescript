// Runs every CI gate of ADR-0004 in order and stops at the first failure. Run from the
// repository root: `npm run ci`. The last line is the summary that PROGRESS.md quotes.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

const CORE = "packages/nepdate";
const PATRO = "packages/nepdate-patro";
const PICKER = "packages/nepdate-picker";
const EVENT_SENTINEL = "World Day Against Human Trafficking";
const CORE_GZIP_LIMIT = 8 * 1024;
const PATRO_GZIP_LIMIT = 28 * 1024;
// ADR-0015: the picker without the core (its peer) was 5,383 B gzip when it was added.
const PICKER_GZIP_LIMIT = 6 * 1024;
// The standalone file carries the core too: 10,447 B gzip when it was added.
const STANDALONE_GZIP_LIMIT = 11 * 1024;

class GateError extends Error {}

function run(command: string): string {
  console.log(`$ ${command}`);
  const result = spawnSync(command, { shell: true, stdio: ["ignore", "pipe", "inherit"] });
  const out = result.stdout?.toString() ?? "";
  process.stdout.write(out);
  if (result.status !== 0) throw new GateError(`${command} exited with ${result.status}`);
  return out;
}

// Like run, but keeps stdout off the console (used for the esbuild bundle).
function capture(command: string): Buffer {
  console.log(`$ ${command}`);
  const result = spawnSync(command, {
    shell: true,
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new GateError(`${command} exited with ${result.status}`);
  return result.stdout;
}

function buildAndShape(pkg: string, afterBuild?: () => void, attwFlags = ""): void {
  rmSync(join(pkg, "dist"), { recursive: true, force: true });
  run(`npx tsc -p ${pkg}/tsconfig.build.json`);
  afterBuild?.();
  run(`npx publint ${pkg}`);
  run(`npx attw --pack ${pkg} --profile esm-only${attwFlags}`);
}

function jsFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".js"))
    .map((f) => join(dir, f));
}

function coreIsolation(): void {
  const manifest = JSON.parse(readFileSync(`${CORE}/package.json`, "utf8")) as Record<
    string,
    unknown
  >;
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    const deps = manifest[field] as Record<string, string> | undefined;
    if (deps !== undefined && "nepdate-patro" in deps) {
      throw new GateError(`${CORE}/package.json names nepdate-patro in ${field}`);
    }
  }
  console.log("core manifest names no nepdate-patro");

  for (const file of jsFiles(`${CORE}/dist`)) {
    if (readFileSync(file, "utf8").includes("nepdate-patro")) {
      throw new GateError(`${file} contains the string nepdate-patro`);
    }
  }
  console.log("core dist/ has no reference to nepdate-patro");

  const temp = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "nepdate-ci-"));
  try {
    run(`npm pack -w nepdate-core --pack-destination "${temp}"`);
    const tarballs = readdirSync(temp).filter((f) => f.endsWith(".tgz"));
    if (tarballs.length !== 1)
      throw new GateError(`expected one tarball, found ${tarballs.length}`);
    // A tar archive stores every file's bytes unchanged, so searching the whole archive
    // finds the string in any file.
    const tar = gunzipSync(readFileSync(join(temp, tarballs[0] as string)));
    if (tar.includes(EVENT_SENTINEL)) {
      throw new GateError(`the core tarball contains "${EVENT_SENTINEL}"`);
    }
    console.log(`core tarball has no event data (${tarballs[0]})`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  const bundle = capture(`npx esbuild ${CORE}/dist/index.js --bundle --minify --format=esm`);
  const gzipped = gzipSync(bundle, { level: 9 }).length;
  console.log(`core bundle: ${bundle.length} B minified, ${gzipped} B gzip`);
  if (gzipped >= CORE_GZIP_LIMIT) {
    throw new GateError(`core bundle is ${gzipped} B gzip, limit ${CORE_GZIP_LIMIT} B`);
  }
}

function patroSize(): void {
  // The 26,349 B measured in T4 is the package alone; the core is its peer, so external it.
  const bundle = capture(
    `npx esbuild ${PATRO}/dist/index.js --bundle --minify --format=esm --external:nepdate-core`,
  );
  const gzipped = gzipSync(bundle, { level: 9 }).length;
  console.log(
    `patro bundle: ${bundle.length} B minified, ${gzipped} B gzip (limit ${PATRO_GZIP_LIMIT} B)`,
  );
  if (gzipped > PATRO_GZIP_LIMIT) {
    throw new GateError(`patro bundle is ${gzipped} B gzip, limit ${PATRO_GZIP_LIMIT} B`);
  }
}

function pickerSize(): void {
  const bundle = capture(
    `npx esbuild ${PICKER}/dist/index.js --bundle --minify --format=esm --external:nepdate-core`,
  );
  const gzipped = gzipSync(bundle, { level: 9 }).length;
  console.log(
    `picker bundle: ${bundle.length} B minified, ${gzipped} B gzip (limit ${PICKER_GZIP_LIMIT} B)`,
  );
  if (gzipped > PICKER_GZIP_LIMIT) {
    throw new GateError(`picker bundle is ${gzipped} B gzip, limit ${PICKER_GZIP_LIMIT} B`);
  }
}

// dist/nepdate-datepicker.js must load from a plain <script type="module">: no import left in it, so
// no bare "nepdate-core" that a browser without an import map cannot resolve.
function pickerStandalone(): void {
  const file = readFileSync(`${PICKER}/dist/nepdate-datepicker.js`);
  const text = file.toString("utf8");
  if (/\bfrom\s*["']|\bimport\s*["'(]/.test(text)) {
    throw new GateError("dist/nepdate-datepicker.js still imports a module");
  }
  const gzipped = gzipSync(file, { level: 9 }).length;
  console.log(
    `picker standalone: ${file.length} B minified, ${gzipped} B gzip (limit ${STANDALONE_GZIP_LIMIT} B)`,
  );
  if (gzipped > STANDALONE_GZIP_LIMIT) {
    throw new GateError(`picker standalone is ${gzipped} B gzip, limit ${STANDALONE_GZIP_LIMIT} B`);
  }
}

// Packed smoke (T8-06): the pack, offline install and both smoke modes live in
// scripts/packed-smoke.ts so gate 11 and the oldest-node job run one path (T9-01).
const gates: [name: string, body: () => void][] = [
  ["shared tree", () => run("node scripts/shared-sums.ts")],
  ["lint + format", () => run("npx biome ci .")],
  ["generated code", () => run("node scripts/codegen.ts --check")],
  ["core types", () => run(`npx tsc -p ${CORE}/tsconfig.json`)],
  ["core tests", () => run("npm test -w nepdate-core")],
  ["core build + shape", () => buildAndShape(CORE)],
  ["core isolation + size", coreIsolation],
  ["patro types", () => run(`npx tsc -p ${PATRO}/tsconfig.json`)],
  ["patro tests", () => run("npm test -w nepdate-patro")],
  // Before gate 10: its script tests run the @examples, which import the built picker.
  ["picker types", () => run(`npx tsc -p ${PICKER}/tsconfig.json`)],
  ["picker tests", () => run("npm test -w nepdate-datepicker")],
  [
    "picker build + shape + size",
    () => {
      // The package's build script also runs picker-assets: theme.css and the standalone file.
      buildAndShape(
        PICKER,
        () => run("node scripts/picker-assets.ts"),
        // A stylesheet has no types to resolve.
        " --exclude-entrypoints ./theme.css",
      );
      pickerSize();
      pickerStandalone();
    },
  ],
  [
    "patro build + shape + tool types",
    () => {
      buildAndShape(PATRO);
      patroSize();
      // The bench package is separate from the root workspaces, and its type imports need the
      // built packages, so install it here, after both builds.
      // --ignore-scripts: the competitors are third-party code; none needs an install script today
      // (the lockfile has no hasInstallScript entry), and a future bump must not run one here.
      run("npm ci --prefix bench --ignore-scripts --no-audit --no-fund");
      run("npx tsc -p tsconfig.tools.json");
      run("node --test bench/report.test.ts bench/load.test.ts scripts/mutation-check.test.ts");
      run(
        "node --test scripts/api-surface.test.ts scripts/examples.test.ts scripts/data-status.test.ts scripts/release-notes.test.ts scripts/shared-sums.test.ts scripts/tarball-check.test.ts",
      );
    },
  ],
  ["docs", () => run("node scripts/docs-check.ts")],
  ["packed smoke", () => run("node scripts/packed-smoke.ts")],
  ["public api snapshot", () => run("node scripts/api-check.ts")],
];

for (const [index, [name, body]] of gates.entries()) {
  const n = index + 1;
  console.log(`\n== gate ${n}: ${name}`);
  try {
    body();
  } catch (error) {
    console.error(error instanceof GateError ? error.message : error);
    console.log(`ci: failed at gate ${n} (${name})`);
    process.exit(1);
  }
}
console.log(`ci: ${gates.length}/${gates.length} gates passed`);
