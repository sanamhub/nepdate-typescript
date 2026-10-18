// Rehearses the two release tarballs before the pack job uploads them (T10-03). It reads the tar
// members, checks the allow-list and the manifest, and writes SHA256SUMS for the publish job.
//
//   node scripts/tarball-check.ts --version 0.1.0 --dir release-tarballs --sums release-tarballs/SHA256SUMS

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

interface Member {
  readonly name: string;
  readonly data: Buffer;
  // The tar typeflag: "0" (or "" in old tars) is a regular file, "5" a directory. Anything else
  // (links, pax headers that override the name) is rejected rather than interpreted.
  readonly type?: string;
}

interface ExpectedManifest {
  readonly name: string;
  readonly version: string;
  readonly peer: string | undefined;
}

const ALLOWED_FILES = new Set(["package.json", "LICENSE", "NOTICE", "README.md"]);

// npm runs these scripts from the consumer's install; a packed manifest must not carry any of them.
// Other script names (build, test) stay in the manifest and are never run by an install.
const LIFECYCLE_SCRIPTS = new Set([
  "preinstall",
  "install",
  "postinstall",
  "prepare",
  "preprepare",
  "postprepare",
  "prepublish",
  "prepublishOnly",
  "prepack",
  "postpack",
]);

function readString(header: Buffer, offset: number, length: number): string {
  const field = header.subarray(offset, offset + length);
  const end = field.indexOf(0);
  return field.subarray(0, end < 0 ? field.length : end).toString("utf8");
}

export function tarMembers(path: string): Member[] {
  const buffer = gunzipSync(readFileSync(path));
  const members: Member[] = [];
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) break;
    const name = readString(header, 0, 100);
    const prefix = readString(header, 345, 155);
    const size = Number.parseInt(readString(header, 124, 12).trim() || "0", 8);
    if (Number.isNaN(size) || size < 0) throw new Error(`${path}: invalid tar member size`);
    const dataStart = offset + 512;
    members.push({
      name: prefix === "" ? name : `${prefix}/${name}`,
      data: buffer.subarray(dataStart, dataStart + size),
      type: readString(header, 156, 1),
    });
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return members;
}

function manifestErrors(member: Member, expected: ExpectedManifest): string[] {
  const errors: string[] = [];
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(member.data.toString("utf8")) as Record<string, unknown>;
  } catch (error) {
    return [
      `package/package.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
  if (manifest.name !== expected.name) {
    errors.push(`package.json name ${String(manifest.name)}, expected ${expected.name}`);
  }
  if (manifest.version !== expected.version) {
    errors.push(`package.json version ${String(manifest.version)}, expected ${expected.version}`);
  }
  const peers = manifest.peerDependencies as Record<string, string> | undefined;
  if (expected.peer === undefined) {
    if (peers !== undefined && Object.keys(peers).length > 0) {
      errors.push(`package.json has peerDependencies, expected none for ${expected.name}`);
    }
  } else if (peers?.nepdate !== `~${expected.version}`) {
    errors.push(
      `package.json peerDependencies.nepdate is ${String(
        peers?.nepdate,
      )}, expected ~${expected.version}`,
    );
  }
  if (manifest.devDependencies !== undefined) {
    errors.push(`package.json has devDependencies, expected none`);
  }
  const scripts = manifest.scripts as Record<string, string> | undefined;
  for (const name of Object.keys(scripts ?? {}).sort()) {
    if (LIFECYCLE_SCRIPTS.has(name)) {
      errors.push(`package.json has the install lifecycle script ${name}, expected none`);
    }
  }
  for (const field of ["dependencies", "optionalDependencies"]) {
    const value = manifest[field] as Record<string, string> | undefined;
    if (value !== undefined && Object.keys(value).length > 0) {
      errors.push(`package.json has ${field}, expected none`);
    }
  }
  return errors;
}

export function checkMembers(members: readonly Member[], expected: ExpectedManifest): string[] {
  const errors: string[] = [];
  let manifest: Member | undefined;
  for (const member of members) {
    const type = member.type ?? "0";
    if (type !== "0" && type !== "" && type !== "5") {
      errors.push(
        `member ${member.name} has tar type ${type}, expected a regular file or directory`,
      );
      continue;
    }
    if (member.name.split("/").some((part) => part === ".." || part === ".")) {
      errors.push(`member ${member.name} has a relative path segment, expected a plain path`);
      continue;
    }
    if (type === "5" || member.name.endsWith("/")) continue;
    if (!member.name.startsWith("package/")) {
      errors.push(`unexpected member ${member.name}, expected package/ prefix`);
      continue;
    }
    const relative = member.name.slice("package/".length);
    if (relative === "package.json") {
      if (manifest !== undefined) errors.push("package/package.json appears twice");
      manifest = member;
      continue;
    }
    if (ALLOWED_FILES.has(relative) || relative.startsWith("dist/")) continue;
    errors.push(
      `unexpected member ${member.name}, expected only dist, LICENSE, NOTICE, README.md and package.json`,
    );
  }
  if (manifest === undefined) {
    errors.push("package/package.json is missing");
  } else {
    errors.push(...manifestErrors(manifest, expected));
  }
  return errors;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function run(args: readonly string[]): number {
  let version: string | undefined;
  let dir: string | undefined;
  let sums: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--version" && value !== undefined) {
      version = value;
      index++;
    } else if (argument === "--dir" && value !== undefined) {
      dir = value;
      index++;
    } else if (argument === "--sums" && value !== undefined) {
      sums = value;
      index++;
    } else if (argument === "--help" || argument === "-h") {
      console.log(
        "usage: node scripts/tarball-check.ts --version X.Y.Z --dir <dir> [--sums <file>]",
      );
      return 0;
    } else {
      console.error(`tarball-check: unknown or incomplete argument ${String(argument)}`);
      return 2;
    }
  }
  if (version === undefined || dir === undefined) {
    console.error(
      "usage: node scripts/tarball-check.ts --version X.Y.Z --dir <dir> [--sums <file>]",
    );
    return 2;
  }
  const root = resolve(dir);
  if (!existsSync(root)) {
    console.error(`tarball-check: ${root} does not exist`);
    return 1;
  }
  const tarballs = readdirSync(root)
    .filter((name) => name.endsWith(".tgz"))
    .sort();
  const core = tarballs.find(
    (name) => name.startsWith("nepdate-") && !name.startsWith("nepdate-patro-"),
  );
  const patro = tarballs.find((name) => name.startsWith("nepdate-patro-"));
  if (core === undefined || patro === undefined || tarballs.length !== 2) {
    console.error(
      `tarball-check: expected the two ${version} tarballs, found ${tarballs.join(", ") || "none"}`,
    );
    return 1;
  }
  const errors: string[] = [];
  const checks: [string, ExpectedManifest][] = [
    [core, { name: "nepdate", version, peer: undefined }],
    [patro, { name: "nepdate-patro", version, peer: "nepdate" }],
  ];
  for (const [name, expected] of checks) {
    const members = tarMembers(join(root, name));
    const found = checkMembers(members, expected);
    if (found.length === 0) {
      console.log(`tarball-check: ${name}: ${members.length} members, package.json ok`);
    } else {
      for (const error of found) errors.push(`${name}: ${error}`);
    }
  }
  if (errors.length > 0) {
    for (const error of errors) console.error(`tarball-check: ${error}`);
    return 1;
  }
  if (sums !== undefined) {
    const lines = tarballs.map((name) => `${sha256(join(root, name))}  ${name}`);
    writeFileSync(resolve(sums), `${lines.join("\n")}\n`);
    console.log(`tarball-check: wrote ${resolve(sums)}`);
  }
  console.log("tarball-check: both tarballs checked");
  return 0;
}

if (process.argv[1] !== undefined && import.meta.filename === resolve(process.argv[1])) {
  process.exitCode = run(process.argv.slice(2));
}
