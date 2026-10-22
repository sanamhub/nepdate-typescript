// Runs the README examples against locally installed tarballs, for the release smoke job
// (T7-01). The README is the source: a broken example breaks this script.
//
//   node scripts/smoke.ts --mode core --project <clean project with @nepdate/core installed>
//   node scripts/smoke.ts --mode patro --project <clean project with both packages installed>
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

const mode = argument("mode");
const project = resolve(argument("project"));
const readme = resolve(process.env.SMOKE_README ?? join(ROOT, "README.md"));
if (mode !== "core" && mode !== "patro") throw new Error(`unknown mode ${mode}`);
if (!existsSync(join(project, "package.json"))) {
  throw new Error(`${project} has no package.json; create a clean project first`);
}
const blocks = tsBlocks(readFileSync(readme, "utf8"));
const block =
  mode === "core"
    ? blocks.find(
        (candidate) =>
          candidate.code.includes('from "@nepdate/core"') &&
          !candidate.code.includes("@nepdate/patro") &&
          !candidate.code.includes("npm:"),
      )
    : blocks.find((candidate) => candidate.code.includes("@nepdate/patro"));
if (block === undefined) throw new Error(`README has no ${mode} TypeScript example`);

const example = join(project, "example.mjs");
writeFileSync(example, `${block.code}\n`);
console.log(`smoke: ${mode} example is README ts block ${block.index}`);
runNode(example, project, `${mode} example`);

if (mode === "core") {
  if (existsSync(join(project, "node_modules", "@nepdate/patro"))) {
    throw new Error("the core-only project installed @nepdate/patro");
  }
  console.log(`smoke: core ${packageVersion(project, "@nepdate/core")} ok, no @nepdate/patro`);
} else {
  const coverage = join(project, "coverage-check.mjs");
  const expected = coverageRange();
  writeFileSync(
    coverage,
    [
      'import { coverage } from "@nepdate/patro";',
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
    `smoke: patro ${packageVersion(project, "@nepdate/patro")} with core ${packageVersion(
      project,
      "@nepdate/core",
    )} ok, data range ${expected.start}..${expected.end}`,
  );
}
