// Checks the vendored copy of the hub's data and spec against scripts/shared.sha256 (ADR-0012).
// Run from the repository root:
//   node scripts/shared-sums.ts
//   node scripts/shared-sums.ts --write <hub checkout>
//
// --write runs the hub's own check first, so the sums only record a shared/ that equals the hub at
// shared/VERSION. The check itself needs no network and no hub checkout, so it can run in CI.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const MANIFEST = "scripts/shared.sha256";
const VENDORED = ["data", "spec"] as const;
const VERSION = "shared/VERSION";
const COMMIT = /^[0-9a-f]{40}$/;
const MANIFEST_LINE = /^([0-9a-f]{64}) {2}(shared\/(?:data|spec)\/.+)$/;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walk(root: string, directory: string, found: string[]): void {
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === "__pycache__") continue;
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) walk(root, path, found);
    else if (entry.isFile()) found.push(path);
  }
}

/** Paths of every regular file under shared/data and shared/spec, relative to the repository root. */
export function sharedFiles(root: string): string[] {
  const found: string[] = [];
  for (const part of VENDORED) {
    const directory = `shared/${part}`;
    if (existsSync(join(root, directory))) walk(root, directory, found);
  }
  return found.sort();
}

/** The hub commit recorded in shared/VERSION, or a throw when the file is missing or malformed. */
export function sharedVersion(root: string): string {
  const path = join(root, VERSION);
  if (!existsSync(path)) throw new Error(`${VERSION} is missing`);
  const version = readFileSync(path, "utf8").trim();
  if (!COMMIT.test(version)) {
    throw new Error(`${VERSION} is not a full 40-character hex commit: "${version}"`);
  }
  return version;
}

/** The manifest text for the current shared/ tree. */
export function manifestFor(root: string): string {
  const lines = [`# hub ${sharedVersion(root)}`];
  for (const path of sharedFiles(root)) {
    lines.push(`${hash(join(root, path))}  ${path}`);
  }
  return `${lines.join("\n")}\n`;
}

/** Writes the manifest and returns the hub version and the number of files it lists. */
export function writeManifest(
  root: string,
  manifestPath = join(root, MANIFEST),
): { version: string; files: number } {
  const version = sharedVersion(root);
  const files = sharedFiles(root);
  const lines = [`# hub ${version}`];
  for (const path of files) lines.push(`${hash(join(root, path))}  ${path}`);
  writeFileSync(manifestPath, `${lines.join("\n")}\n`, "utf8");
  return { version, files: files.length };
}

/** Every difference between the manifest text and the shared/ tree under root. */
export function manifestProblems(root: string, text: string): string[] {
  let version: string;
  try {
    version = sharedVersion(root);
  } catch (error) {
    return [message(error)];
  }

  const problems: string[] = [];
  const lines = text.split(/\r?\n/);
  const header = lines[0] ?? "";
  if (header !== `# hub ${version}`) {
    problems.push(`header is "${header}", expected "# hub ${version}"`);
  }

  const listed = new Map<string, string>();
  for (let index = 1; index < lines.length; index++) {
    const line = lines[index] as string;
    if (index === lines.length - 1 && line === "") continue;
    const match = MANIFEST_LINE.exec(line);
    if (match === null) {
      problems.push(`line ${index + 1} is malformed: "${line}"`);
      continue;
    }
    const path = match[2] as string;
    if (path.split("/").some((part) => part === "" || part === "." || part === "..")) {
      problems.push(`line ${index + 1} has an unsafe path: "${path}"`);
      continue;
    }
    if (listed.has(path)) {
      problems.push(`line ${index + 1} repeats ${path}`);
      continue;
    }
    listed.set(path, match[1] as string);
  }

  const present = new Set(sharedFiles(root));
  for (const [path, expected] of listed) {
    if (!present.has(path)) {
      problems.push(`${path} is listed but missing`);
      continue;
    }
    const actual = hash(join(root, path));
    if (actual !== expected) {
      problems.push(`${path} has SHA-256 ${actual}, expected ${expected}`);
    }
  }
  for (const path of present) {
    if (!listed.has(path)) problems.push(`${path} is present but not listed`);
  }
  return problems;
}

function usage(): never {
  console.error("usage: node scripts/shared-sums.ts [--write <hub checkout>]");
  process.exit(2);
}

function pythonCommand(): string {
  return process.env.SHARED_PYTHON ?? (process.platform === "win32" ? "py" : "python3");
}

function write(root: string, hub: string): void {
  const tool = join(hub, "tools", "shared_sync.py");
  if (!existsSync(tool)) {
    console.error(`shared-sums: hub check not found at ${tool}`);
    process.exit(1);
  }
  const python = pythonCommand();
  const result = spawnSync(python, [tool, ".", "--check"], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.error !== undefined) {
    console.error(`shared-sums: could not run ${python}: ${message(result.error)}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(
      `shared-sums: hub check failed with exit ${String(result.status)}; ${MANIFEST} was not written`,
    );
    process.exit(1);
  }
  const written = writeManifest(root);
  console.log(`shared-sums: wrote ${MANIFEST} (${written.files} files) for hub ${written.version}`);
}

const root = process.cwd();
const args = process.argv.slice(2);

if (args[0] === "--write") {
  const hub = args[1];
  if (hub === undefined || args.length !== 2) usage();
  write(root, resolve(root, hub));
} else if (args.length === 0) {
  let text: string;
  try {
    text = readFileSync(join(root, MANIFEST), "utf8");
  } catch (error) {
    console.error(`shared-sums: ${MANIFEST} is missing: ${message(error)}`);
    process.exit(1);
  }
  const problems = manifestProblems(root, text);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`shared-sums: ${problem}`);
    console.error(`shared-sums: failed with ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log(
    `shared-sums: shared/ matches hub ${sharedVersion(root)} (${sharedFiles(root).length} files)`,
  );
} else {
  usage();
}
