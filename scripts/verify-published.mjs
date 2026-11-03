// Installs published versions from the public npm registry, the way a user installs them, and
// checks them: the installed versions, the README quick start, one patro lookup and one picker
// month grid. The SDK line and the picker line release separately (ADR-0018), so a check names the
// line it verifies: the core and patro at one version, the picker and the core it peers on, or both
// lines at the latest versions that fit together.
//
//   node scripts/verify-published.mjs --kind sdk --version 0.1.0-rc.1 [--manager npm] [--wait 15]
//   node scripts/verify-published.mjs --kind picker --version 0.1.0-beta.2 --core-version 0.1.0-rc.1
//   node scripts/verify-published.mjs --kind all [--manager pnpm]
//   node scripts/verify-published.mjs --kind sdk --resolve
//   node scripts/verify-published.mjs --kind all --metadata
//
// --resolve prints the latest version of the line, or for a picker with --core-version the picker
// that peers on it, so a workflow can pass the result to the later jobs. --metadata reads the
// registry document and confirms that each version is listed, not deprecated, and that its tarball
// answers a HEAD request; it downloads no package file.
//
// The manager is the one a user would choose. Yarn means Yarn Berry through corepack, with the
// linker written out. Only npm checks the registry signatures, because npm audit signatures reads
// the lockfile npm itself wrote.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const REGISTRY = "https://registry.npmjs.org";
const USER_AGENT = "nepdate-verify-published";
const MANAGERS = ["npm", "pnpm", "yarn-node-modules", "yarn-pnp", "bun"];
const KINDS = ["sdk", "picker", "all"];
// Yarn 1 cannot read packageManager or nodeLinker, so corepack fetches Yarn Berry 4.
const YARN_VERSION = "4.18.1";
const VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$/;
const WINDOWS = process.platform === "win32";

class VerifyError extends Error {}

function fail(message) {
  throw new VerifyError(message);
}

function sleep(seconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
}

// npm and corepack are .cmd shims on Windows, which spawnSync starts only through a shell. Their
// JavaScript entry points sit next to node in the same install, so they run under node directly
// and no shell ever sees an argument. bun and node are real executables.
function windowsCommand(command, args) {
  const nodeDir = dirname(process.execPath);
  if (command === "npm") {
    return [process.execPath, [join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"), ...args]];
  }
  if (command === "corepack") {
    return [
      process.execPath,
      [join(nodeDir, "node_modules", "corepack", "dist", "corepack.js"), ...args],
    ];
  }
  if (command === "bun" || command === "node") return [command, args];
  fail(`${command} has no Windows entry point here; use corepack`);
}

function spawnIn(command, args, options) {
  if (!WINDOWS) return spawnSync(command, args, options);
  const [file, fileArgs] = windowsCommand(command, args);
  return spawnSync(file, fileArgs, options);
}

function run(command, args, cwd) {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnIn(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" },
  });
  if (result.error !== undefined) fail(`${command} did not start: ${result.error.message}`);
  return result.status ?? 1;
}

function commandExists(command) {
  // On Windows pnpm is reached through corepack, which windowsCommand knows how to start.
  if (WINDOWS && command === "pnpm") return false;
  return spawnIn(command, ["--version"], { stdio: "ignore" }).status === 0;
}

async function registryDocument(name) {
  const url = `${REGISTRY}/${name}`;
  let last = "no response";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
      });
      if (response.ok) return await response.json();
      last = `answered ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  fail(`${url} ${last}`);
}

async function latestVersion(name) {
  const document = await registryDocument(name);
  const version = document["dist-tags"]?.latest;
  if (typeof version !== "string" || version === "") {
    fail(`npm publishes no latest dist-tag for ${name}`);
  }
  return version;
}

// npm compares prerelease identifiers one by one: numbers as numbers, strings as strings, and a
// shorter list is lower when the shared part is equal.
function comparePrerelease(left, right) {
  const a = left === "" ? [] : left.split(".");
  const b = right === "" ? [] : right.split(".");
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if (a[index] === undefined) return -1;
    if (b[index] === undefined) return 1;
    const aNumber = /^\d+$/.test(a[index]) ? Number(a[index]) : null;
    const bNumber = /^\d+$/.test(b[index]) ? Number(b[index]) : null;
    if (aNumber !== null && bNumber !== null) {
      if (aNumber !== bNumber) return aNumber - bNumber;
    } else if (aNumber !== null) {
      return -1;
    } else if (bNumber !== null) {
      return 1;
    } else if (a[index] !== b[index]) {
      return a[index] < b[index] ? -1 : 1;
    }
  }
  return 0;
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (match === null) fail(`cannot read the version ${version}`);
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? "",
  };
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] - b.numbers[index];
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

// The picker publishes a caret or tilde range on the core. A prerelease joins the range only on the
// tuple that carries one (ADR-0018 decision 5), so the tuple is compared as well.
function rangeAdmitsVersion(range, version) {
  const match = /^([~^])?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(range.trim());
  if (match === null) fail(`cannot read the peer range ${range}`);
  const operator = match[1] ?? "";
  const bound = parseVersion(match[2]);
  const candidate = parseVersion(version);
  if (compareVersions(version, match[2]) < 0) return false;
  if (operator === "") return compareVersions(version, match[2]) === 0;
  if (candidate.prerelease !== "" && candidate.numbers.join(".") !== bound.numbers.join(".")) {
    return false;
  }
  if (operator === "~") {
    return candidate.numbers[0] === bound.numbers[0] && candidate.numbers[1] === bound.numbers[1];
  }
  if (bound.numbers[0] !== 0) return candidate.numbers[0] === bound.numbers[0];
  if (bound.numbers[1] !== 0) return candidate.numbers[1] === bound.numbers[1];
  return candidate.numbers[1] === 0 && candidate.numbers[2] === bound.numbers[2];
}

// The picker line trails the SDK line: pre-releases never move its latest dist-tag (ADR-0018
// decision 8), so a check that resolves both lines takes the newest picker whose peer range admits
// the resolved core.
async function pickerForCore(core) {
  const document = await registryDocument("nepdate-datepicker");
  const versions = document.versions ?? {};
  const compatible = Object.keys(versions).filter((version) => {
    const peer = versions[version]?.peerDependencies?.["nepdate-core"];
    return typeof peer !== "string" || rangeAdmitsVersion(peer, core);
  });
  if (compatible.length === 0) {
    fail(`no nepdate-datepicker release accepts nepdate-core ${core}`);
  }
  const latest = document["dist-tags"]?.latest;
  if (typeof latest === "string" && compatible.includes(latest)) return latest;
  compatible.sort(compareVersions);
  return compatible[compatible.length - 1];
}

// The package versions a check installs. An empty input means the newest that fits, so a scheduled
// run follows each line without being told a version and still installs a picker that accepts the
// core.
async function versionsFor(options) {
  if (options.kind === "sdk") {
    const version = options.version === "" ? await latestVersion("nepdate-core") : options.version;
    return { "nepdate-core": version, "nepdate-patro": version };
  }
  if (options.kind === "picker") {
    const core =
      options.coreVersion === "" ? await latestVersion("nepdate-core") : options.coreVersion;
    const picker = options.version === "" ? await pickerForCore(core) : options.version;
    return { "nepdate-core": core, "nepdate-datepicker": picker };
  }
  const core =
    options.coreVersion === "" ? await latestVersion("nepdate-core") : options.coreVersion;
  const picker = options.pickerVersion === "" ? await pickerForCore(core) : options.pickerVersion;
  return { "nepdate-core": core, "nepdate-patro": core, "nepdate-datepicker": picker };
}

function checkSource(versions) {
  const names = Object.keys(versions);
  const imports = ['import { readFileSync } from "node:fs";'];
  imports.push('import { createRequire } from "node:module";');
  imports.push('import { dirname, join } from "node:path";');
  if (names.includes("nepdate-core")) {
    imports.push('import { NepaliDate } from "nepdate-core";');
  }
  if (names.includes("nepdate-patro")) {
    imports.push('import { info } from "nepdate-patro";');
  }
  if (names.includes("nepdate-datepicker")) {
    imports.push('import { monthGrid } from "nepdate-datepicker";');
  }
  const checks = [];
  if (names.includes("nepdate-core")) {
    checks.push(`
const date = NepaliDate.of(2081, 2, 15);
const gregorian = date.toGregorian();
if (gregorian.year !== 2024 || gregorian.month !== 5 || gregorian.day !== 28) {
  throw new Error("toGregorian returned " + JSON.stringify(gregorian));
}
if (date.toJSON() !== "2081-02-15") {
  throw new Error("toJSON returned " + date.toJSON());
}
if (date.long({ weekday: true }) !== "Tuesday, Jestha 15, 2081") {
  throw new Error("long returned " + date.long({ weekday: true }));
}`);
  }
  if (names.includes("nepdate-patro")) {
    checks.push(`
const day = info(NepaliDate.of(2081, 2, 15));
if (!day.isPublicHoliday || day.events[0]?.en !== "Republic Day") {
  throw new Error("info did not return Republic Day");
}`);
  }
  if (names.includes("nepdate-datepicker")) {
    checks.push(`
if (monthGrid(2081, 4).length !== 6) {
  throw new Error("monthGrid(2081, 4) did not return 6 rows");
}`);
  }
  const checked = [];
  if (names.includes("nepdate-core")) checked.push("quick start");
  if (names.includes("nepdate-patro")) checked.push("patro lookup");
  if (names.includes("nepdate-datepicker")) checked.push("picker grid");
  return `${imports.join("\n")}

const expected = ${JSON.stringify(versions)};
const require = createRequire(import.meta.url);
for (const [name, version] of Object.entries(expected)) {
  const entry = require.resolve(name);
  const manifest = JSON.parse(readFileSync(join(dirname(entry), "..", "package.json"), "utf8"));
  if (manifest.name !== name) {
    throw new Error(name + " resolved to " + manifest.name);
  }
  if (manifest.version !== version) {
    throw new Error(name + " is " + manifest.version + ", expected " + version);
  }
}
${checks.join("\n")}
console.log("verify-published: versions and ${checked.join(", ")} passed");
`;
}

// npm has no yank flag: a version is gone when it is unpublished, and a deprecated version is the
// closest thing to a yanked one, so the daily check treats both as failures.
async function checkMetadata(versions) {
  for (const [name, version] of Object.entries(versions)) {
    const document = await registryDocument(name);
    const entry = document.versions?.[version];
    if (entry === undefined) fail(`npm does not list ${name} ${version}`);
    if (typeof entry.deprecated === "string" && entry.deprecated !== "") {
      fail(`npm marks ${name} ${version} deprecated: ${entry.deprecated}`);
    }
    const tarball =
      typeof entry.dist?.tarball === "string"
        ? entry.dist.tarball
        : `${REGISTRY}/${name}/-/${name}-${version}.tgz`;
    await headOk(tarball);
    console.log(`verify-published: ${name} ${version} is listed and its tarball answers 200`);
  }
}

async function headOk(url) {
  let problem = "no response";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        headers: { "user-agent": USER_AGENT },
      });
      if (response.status === 200) return;
      problem = `answered ${response.status}`;
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  fail(`${url} ${problem}`);
}

function writeProject(dir, manager, versions) {
  const manifest = {
    name: "verify-published",
    version: "0.0.0",
    private: true,
    type: "module",
  };
  if (manager.startsWith("yarn")) {
    manifest.packageManager = `yarn@${YARN_VERSION}`;
    // Yarn installs what package.json lists; yarn add writes a range, and the check needs exact.
    manifest.dependencies = versions;
  }
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  if (manager === "yarn-node-modules") {
    writeFileSync(join(dir, ".yarnrc.yml"), "nodeLinker: node-modules\n");
  }
  if (manager === "yarn-pnp") {
    writeFileSync(join(dir, ".yarnrc.yml"), "nodeLinker: pnp\npnpEnableEsmLoader: true\n");
  }
}

function install(dir, manager, versions) {
  const specs = Object.entries(versions).map(([name, version]) => `${name}@${version}`);
  if (manager === "npm") {
    return run("npm", ["install", "--no-audit", "--no-fund", "--save-exact", ...specs], dir);
  }
  if (manager === "pnpm") {
    // Actions runners ship corepack but not always a pnpm on PATH.
    return commandExists("pnpm")
      ? run("pnpm", ["add", ...specs], dir)
      : run("corepack", ["pnpm", "add", ...specs], dir);
  }
  if (manager.startsWith("yarn")) {
    // CI enables immutable installs, and a fresh project has no lockfile to freeze.
    return run("corepack", ["yarn", "install", "--no-immutable"], dir);
  }
  return run("bun", ["add", ...specs], dir);
}

function installWithRetries(dir, manager, versions, waitMinutes) {
  const deadline = Date.now() + waitMinutes * 60 * 1000;
  for (;;) {
    if (install(dir, manager, versions) === 0) return;
    const left = deadline - Date.now();
    if (left <= 0) fail(`${manager} could not install the versions within ${waitMinutes} minutes`);
    const pause = Math.min(30, Math.ceil(left / 1000));
    console.log(`verify-published: install failed, retrying in ${pause}s`);
    sleep(pause);
  }
}

function check(dir, manager, versions) {
  // The signature check reads the lockfile and node_modules npm wrote, so it is npm only.
  if (manager === "npm" && run("npm", ["audit", "signatures"], dir) !== 0) {
    fail("npm audit signatures reported a package that does not match the registry");
  }
  writeFileSync(join(dir, "check.mjs"), checkSource(versions));
  const command =
    manager === "bun"
      ? ["bun", ["check.mjs"]]
      : manager === "yarn-pnp"
        ? // Plug'n'Play has no node_modules, so the runtime only resolves through yarn.
          ["corepack", ["yarn", "node", "check.mjs"]]
        : ["node", ["check.mjs"]];
  if (run(command[0], command[1], dir) !== 0) fail(`the ${manager} check failed`);
  console.log(
    `verify-published: ok, ${manager} installed ${Object.entries(versions)
      .map(([name, version]) => `${name}@${version}`)
      .join(", ")} and the checks passed`,
  );
}

function parseArguments(argv) {
  const options = {
    mode: "install",
    kind: "all",
    version: "",
    coreVersion: "",
    pickerVersion: "",
    manager: "npm",
    wait: 15,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--resolve") {
      options.mode = "resolve";
    } else if (argument === "--metadata") {
      options.mode = "metadata";
    } else if (argument === "--kind") {
      index += 1;
      options.kind = argv[index] ?? "";
    } else if (argument === "--version") {
      index += 1;
      options.version = argv[index] ?? "";
    } else if (argument === "--core-version") {
      index += 1;
      options.coreVersion = argv[index] ?? "";
    } else if (argument === "--picker-version") {
      index += 1;
      options.pickerVersion = argv[index] ?? "";
    } else if (argument === "--manager") {
      index += 1;
      options.manager = argv[index] ?? "";
    } else if (argument === "--wait") {
      index += 1;
      options.wait = Number(argv[index] ?? "");
    } else if (argument.startsWith("-")) {
      fail(`unknown argument '${argument}'`);
    } else {
      // A bare version still works for the SDK line, the shape older runbooks used.
      if (options.version !== "") fail(`unexpected argument '${argument}'`);
      options.version = argument;
    }
  }
  if (!KINDS.includes(options.kind)) {
    fail(`'${options.kind}' is not one of ${KINDS.join(", ")}`);
  }
  if (!MANAGERS.includes(options.manager)) {
    fail(`'${options.manager}' is not one of ${MANAGERS.join(", ")}`);
  }
  if (!Number.isFinite(options.wait) || options.wait < 0) {
    fail("--wait needs a number of minutes");
  }
  for (const value of [options.version, options.coreVersion, options.pickerVersion]) {
    if (value !== "" && !VERSION_PATTERN.test(value)) {
      fail(`'${value}' is not a version like 0.1.0 or 0.1.0-beta.1`);
    }
  }
  if (options.mode === "resolve" && options.kind === "all") {
    fail("--resolve needs --kind sdk or --kind picker");
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.mode === "resolve") {
    if (options.kind === "picker" && options.coreVersion !== "") {
      console.log(await pickerForCore(options.coreVersion));
    } else {
      const name = options.kind === "picker" ? "nepdate-datepicker" : "nepdate-core";
      console.log(await latestVersion(name));
    }
    return;
  }
  const versions = await versionsFor(options);
  if (options.mode === "metadata") {
    await checkMetadata(versions);
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "nepdate-verify-published-"));
  console.log(
    `verify-published: ${options.manager} install of ${Object.entries(versions)
      .map(([name, version]) => `${name}@${version}`)
      .join(", ")} in ${dir}`,
  );
  try {
    writeProject(dir, options.manager, versions);
    installWithRetries(dir, options.manager, versions, options.wait);
    check(dir, options.manager, versions);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`verify-published: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
