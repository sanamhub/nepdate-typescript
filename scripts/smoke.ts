// Runs the README examples against locally installed tarballs, for the release smoke job
// (T7-01). The README is the source: a broken example breaks this script.
//
//   node scripts/smoke.ts --mode core --project <clean project with nepdate-core installed>
//   node scripts/smoke.ts --mode patro --project <clean project with both packages installed>
//   node scripts/smoke.ts --mode picker --project <clean project with core and picker installed>
//
// The picker has no README example that runs without a DOM, so its mode checks the main entry in
// plain Node and the two files the build adds after tsc (ADR-0015).
//
// The project must already have the tarballs installed. This script never installs, publishes or
// reads a registry; the workflow installs the uploaded tarballs, and a local run can do the same
// with `npm pack` and `npm install <tarball>`.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface Block {
  readonly index: number;
  readonly code: string;
}

function tsBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const pattern = /^```ts\r?\n([\s\S]*?)^```$/gm;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    blocks.push({ index, code: match[1] ?? "" });
    index++;
  }
  return blocks;
}

function argument(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`missing --${name}`);
  return value;
}

function runNode(file: string, project: string, label: string): void {
  const result = spawnSync(process.execPath, [file], { cwd: project, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${label} exited with ${String(result.status)}`);
  }
}

function packageVersion(project: string, name: string): string {
  const path = join(project, "node_modules", name, "package.json");
  if (!existsSync(path)) throw new Error(`${name} is not installed in ${project}`);
  const manifest = JSON.parse(readFileSync(path, "utf8")) as { version?: unknown };
  return typeof manifest.version === "string" ? manifest.version : "unknown";
}

// The expected range comes from the generated tables' source data. A literal here would hide a
// data change from the smoke check.
function coverageRange(): { start: string; end: string } {
  const dir = join(ROOT, "shared", "data", "patro");
  const years = readdirSync(dir)
    .filter((name) => /^\d{4}\.json$/.test(name))
    .sort();
  if (years.length === 0) throw new Error(`no patro year files under ${dir}`);
  const days = (name: string): Record<string, unknown> => {
    const data = JSON.parse(readFileSync(join(dir, name), "utf8")) as {
      days?: Record<string, unknown>;
    };
    return data.days ?? {};
  };
  const first = Object.keys(days(years[0] as string)).sort();
  const last = Object.keys(days(years.at(-1) as string)).sort();
  if (first.length === 0 || last.length === 0) throw new Error("a patro year file has no days");
  return { start: first[0] as string, end: last.at(-1) as string };
}

// The main entry must load where there is no DOM (Node, SSR): the elements extend an empty class
// there and defineElements() does nothing. The standalone file must not import anything, the rule
// gate 12 applies to the build.
function pickerSmoke(project: string): void {
  const dist = join(project, "node_modules", "nepdate-datepicker", "dist");
  for (const name of ["theme.css", "nepdate-datepicker.js"]) {
    if (!existsSync(join(dist, name))) throw new Error(`nepdate-datepicker has no dist/${name}`);
  }
  const standalone = readFileSync(join(dist, "nepdate-datepicker.js"), "utf8");
  if (/\bfrom\s*["']|\bimport\s*["'(]/.test(standalone)) {
    throw new Error("nepdate-datepicker dist/nepdate-datepicker.js imports a module");
  }
  const check = join(project, "picker-check.mjs");
  writeFileSync(
    check,
    [
      'import { defineElements, monthGrid } from "nepdate-datepicker";',
      'if (typeof globalThis.customElements !== "undefined") {',
      '  console.error("smoke: this check needs a runtime without customElements");',
      "  process.exit(1);",
      "}",
      "const rows = monthGrid(2081, 4).length;",
      "if (rows !== 6) {",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: this is generated code.
      "  console.error(`smoke: monthGrid(2081, 4) has ${rows} rows, expected 6`);",
      "  process.exit(1);",
      "}",
      'if (typeof defineElements !== "function") {',
      '  console.error("smoke: defineElements is not a function");',
      "  process.exit(1);",
      "}",
      "defineElements();",
      'console.log("smoke: picker entry loads without a DOM, monthGrid(2081, 4) has 6 rows");',
      "",
    ].join("\n"),
  );
  runNode(check, project, "picker check");
  console.log(
    `smoke: picker ${packageVersion(project, "nepdate-datepicker")} with core ${packageVersion(
      project,
      "nepdate-core",
    )} ok, theme.css and a standalone file with no import`,
  );
}

const mode = argument("mode");
const project = resolve(argument("project"));
const readme = resolve(process.env.SMOKE_README ?? join(ROOT, "README.md"));
if (mode !== "core" && mode !== "patro" && mode !== "picker") {
  throw new Error(`unknown mode ${mode}`);
}
if (!existsSync(join(project, "package.json"))) {
  throw new Error(`${project} has no package.json; create a clean project first`);
}
if (mode === "picker") {
  pickerSmoke(project);
  process.exit(0);
}
const blocks = tsBlocks(readFileSync(readme, "utf8"));
const block =
  mode === "core"
    ? blocks.find(
        (candidate) =>
          candidate.code.includes('from "nepdate-core"') &&
          !candidate.code.includes("nepdate-patro") &&
          !candidate.code.includes("npm:"),
      )
    : blocks.find((candidate) => candidate.code.includes("nepdate-patro"));
if (block === undefined) throw new Error(`README has no ${mode} TypeScript example`);

const example = join(project, "example.mjs");
writeFileSync(example, `${block.code}\n`);
console.log(`smoke: ${mode} example is README ts block ${block.index}`);
runNode(example, project, `${mode} example`);

if (mode === "core") {
  if (existsSync(join(project, "node_modules", "nepdate-patro"))) {
    throw new Error("the core-only project installed nepdate-patro");
  }
  console.log(`smoke: core ${packageVersion(project, "nepdate-core")} ok, no nepdate-patro`);
} else {
  const coverage = join(project, "coverage-check.mjs");
  const expected = coverageRange();
  writeFileSync(
    coverage,
    [
      'import { coverage } from "nepdate-patro";',
      "const range = coverage();",
      "const start = range.start.toJSON();",
      "const end = range.end.toJSON();",
      `const expected = ${JSON.stringify(expected)};`,
      "if (start !== expected.start || end !== expected.end) {",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: this is generated code.
      "  console.error(`smoke: coverage ${start}..${end}, expected ${expected.start}..${expected.end}`);",
      "  process.exit(1);",
      "}",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: this is generated code.
      "console.log(`smoke: coverage ${start}..${end}`);",
      "",
    ].join("\n"),
  );
  runNode(coverage, project, "coverage check");
  console.log(
    `smoke: patro ${packageVersion(project, "nepdate-patro")} with core ${packageVersion(
      project,
      "nepdate-core",
    )} ok, data range ${expected.start}..${expected.end}`,
  );
}
