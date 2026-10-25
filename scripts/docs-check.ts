// Gate 10 (ADR-0004): README examples run, public declarations are documented, and the prose in
// the shipped docs is clean. Run from the repository root: `node scripts/docs-check.ts`.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkExamples } from "./examples.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors: string[] = [];

function fail(message: string): void {
  errors.push(message);
}

// ---- README examples ----

interface Block {
  readonly lang: string;
  readonly code: string;
}

function codeBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const pattern = /^```(\w*)\r?\n([\s\S]*?)^```$/gm;
  for (const match of text.matchAll(pattern)) {
    blocks.push({ lang: match[1] ?? "", code: match[2] ?? "" });
  }
  return blocks;
}

const README_FILES = [
  "README.md",
  "packages/nepdate-patro/README.md",
  "packages/nepdate-picker/README.md",
];
const outDir = join(ROOT, ".readme-check");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
let blocksRun = 0;
for (const file of README_FILES) {
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;
  const blocks = codeBlocks(readFileSync(path, "utf8"));
  blocks.forEach((block, index) => {
    if (block.lang !== "ts") return;
    // The Deno block imports `npm:nepdate`; Deno is not installed in CI or on the test machine.
    if (block.code.includes("npm:")) return;
    const target = join(outDir, `${file.replaceAll("/", "-")}-${index}.ts`);
    writeFileSync(target, `${block.code}\n`);
    const result = spawnSync(process.execPath, [target], { cwd: ROOT, encoding: "utf8" });
    blocksRun++;
    if (result.status !== 0) {
      fail(
        `${file} block ${index} exited ${String(result.status)}\n${result.stdout}${result.stderr}`,
      );
    }
  });
}

// ---- TSDoc on every exported declaration ----

const DECLARATION =
  /^export (?:declare )?(?:const|function|class|interface|type|let|enum)\s+[A-Za-z_$]/;
for (const pkg of ["nepdate", "nepdate-patro", "nepdate-picker"]) {
  const dir = join(ROOT, "packages", pkg, "dist");
  if (!existsSync(dir)) {
    fail(`packages/${pkg}/dist is missing; run npm run build first`);
    continue;
  }
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".d.ts"))) {
    const lines = readFileSync(join(dir, file), "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!DECLARATION.test(line)) return;
      let above = index - 1;
      while (above >= 0 && (lines[above] as string).trim() === "") above--;
      if (above < 0 || !(lines[above] as string).trimEnd().endsWith("*/")) {
        fail(`packages/${pkg}/dist/${file}:${index + 1} has no TSDoc comment`);
      }
    });
  }
}

// ---- Prose checks ----

function documentationFiles(): string[] {
  const files = ["README.md", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md"];
  const docsDir = join(ROOT, "docs");
  for (const name of readdirSync(docsDir).sort()) {
    if (name.endsWith(".md")) files.push(`docs/${name}`);
  }
  const runbooksDir = join(docsDir, "runbooks");
  for (const name of readdirSync(runbooksDir).sort()) {
    if (name.endsWith(".md")) files.push(`docs/runbooks/${name}`);
  }
  // packages/nepdate/README.md is a copy of the root README made by prepack, which is scanned
  // above; only the patro package carries its own README.
  for (const pkg of ["nepdate-patro", "nepdate-picker"]) {
    const path = `packages/${pkg}/README.md`;
    if (existsSync(join(ROOT, path))) files.push(path);
  }
  return files;
}

const TASK_ID = /\bT[0-9](?:-\d{2})?\b/;
const LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function checkLinks(file: string, text: string): void {
  for (const match of text.matchAll(LINK)) {
    let target = match[1] as string;
    if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
    const withoutFragment = target.split("#")[0] as string;
    if (withoutFragment === "") continue;
    const resolved = resolve(dirname(join(ROOT, file)), withoutFragment);
    if (!existsSync(resolved)) {
      fail(`${file}: link ${target} does not resolve`);
    }
  }
}

const docFiles = documentationFiles();
for (const file of docFiles) {
  const text = readFileSync(join(ROOT, file), "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.includes("\u2014")) fail(`${file}:${index + 1} has an em dash`);
    const task = TASK_ID.exec(line);
    if (task !== null) fail(`${file}:${index + 1} names task ${task[0]}`);
  });
  checkLinks(file, text);
}

// ---- Runnable TSDoc examples (T9-03) ----

let examplesRun = 0;
let assertionsRun = 0;
let skippedChecks = "";
try {
  const examples = checkExamples();
  examplesRun = examples.examples;
  assertionsRun = examples.assertions;
  if (examples.skipped.length > 0) {
    skippedChecks = `, ${examples.skipped.length} allow-listed result comparison(s) skipped (${examples.skipped.join(", ")})`;
  }
  for (const message of examples.errors) fail(message);
} catch (error) {
  fail(`examples: ${error instanceof Error ? error.message : String(error)}`);
}

for (const message of errors) console.error(`docs-check: ${message}`);
if (errors.length > 0) {
  console.error(`docs-check: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log(
  `docs-check: ${blocksRun} README blocks ran, ${docFiles.length} files scanned, declarations documented, ${examplesRun} examples ran with ${assertionsRun} // => assertions${skippedChecks}`,
);
