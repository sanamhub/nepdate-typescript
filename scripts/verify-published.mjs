// Installs one published version of nepdate-core, nepdate-patro and nepdate-datepicker from the
// public npm registry, the way a user installs them, and checks it: the installed versions, the
// README quick start, one patro lookup and one picker month grid.
//
//   node scripts/verify-published.mjs 0.1.0-beta.1 [--manager npm] [--wait 15]
//   node scripts/verify-published.mjs latest --manager pnpm
//   node scripts/verify-published.mjs latest --resolve
//   node scripts/verify-published.mjs latest --metadata
//
// latest is the version a plain `npm install nepdate-core` picks: npm's dist-tag latest, which
// points at a pre-release while the package has no stable release. The resolved version is printed
// before anything is installed. --resolve prints it alone and exits, so a workflow can pass it to
// the later jobs. --metadata reads the registry document and confirms that the version is listed,
// not deprecated, and that its tarball answers a HEAD request; it downloads no package file.
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
const PACKAGES = ["nepdate-core", "nepdate-patro", "nepdate-datepicker"];
const MANAGERS = ["npm", "pnpm", "yarn-node-modules", "yarn-pnp", "bun"];
// Yarn 1 cannot read packageManager or nodeLinker, so corepack fetches Yarn Berry 4.
const YARN_VERSION = "4.18.1";
const VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$/;
const WINDOWS = process.platform === "win32";

// The quick start from the README plus the two calls the release check makes, run from the project
// the manager just installed into.
const CHECK = `import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { NepaliDate } from "nepdate-core";
import { info } from "nepdate-patro";
import { monthGrid } from "nepdate-datepicker";

const expected = process.argv[2];
const require = createRequire(import.meta.url);
for (const name of ${JSON.stringify(PACKAGES)}) {
  const entry = require.resolve(name);
  const manifest = JSON.parse(readFileSync(join(dirname(entry), "..", "package.json"), "utf8"));
  if (manifest.name !== name) {
    throw new Error(name + " resolved to " + manifest.name);
  }
  if (manifest.version !== expected) {
    throw new Error(name + " is " + manifest.version + ", expected " + expected);
  }
}

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
}
const day = info(date);
if (!day.isPublicHoliday || day.events[0]?.en !== "Republic Day") {
  throw new Error("info did not return Republic Day");
}
if (monthGrid(2081, 4).length !== 6) {
  throw new Error("monthGrid(2081, 4) did not return 6 rows");
}
console.log("verify-published: versions, quick start, one patro lookup and one picker grid passed");
`;

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

// npm has no yank flag: a version is gone when it is unpublished, and a deprecated version is the
// closest thing to a yanked one, so the daily check treats both as failures.
async function checkMetadata(version) {
  for (const name of PACKAGES) {
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

function writeProject(dir, manager, version) {
  const manifest = {
    name: "verify-published",
    version: "0.0.0",
    private: true,
    type: "module",
  };
  if (manager.startsWith("yarn")) {
    manifest.packageManager = `yarn@${YARN_VERSION}`;
    // Yarn installs what package.json lists; yarn add writes a range, and the check needs exact.
    manifest.dependencies = Object.fromEntries(PACKAGES.map((name) => [name, version]));
  }
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  if (manager === "yarn-node-modules") {
    writeFileSync(join(dir, ".yarnrc.yml"), "nodeLinker: node-modules\n");
  }
  if (manager === "yarn-pnp") {
    writeFileSync(join(dir, ".yarnrc.yml"), "nodeLinker: pnp\npnpEnableEsmLoader: true\n");
  }
}

function install(dir, manager, version) {
  const specs = PACKAGES.map((name) => `${name}@${version}`);
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

function installWithRetries(dir, manager, version, waitMinutes) {
  const deadline = Date.now() + waitMinutes * 60 * 1000;
  for (;;) {
    if (install(dir, manager, version) === 0) return;
    const left = deadline - Date.now();
    if (left <= 0) fail(`${manager} could not install ${version} within ${waitMinutes} minutes`);
    const pause = Math.min(30, Math.ceil(left / 1000));
    console.log(`verify-published: install failed, retrying in ${pause}s`);
    sleep(pause);
  }
}

function check(dir, manager, version) {
  // The signature check reads the lockfile and node_modules npm wrote, so it is npm only.
  if (manager === "npm" && run("npm", ["audit", "signatures"], dir) !== 0) {
    fail("npm audit signatures reported a package that does not match the registry");
  }
  writeFileSync(join(dir, "check.mjs"), CHECK);
  const command =
    manager === "bun"
      ? ["bun", ["check.mjs", version]]
      : manager === "yarn-pnp"
        ? // Plug'n'Play has no node_modules, so the runtime only resolves through yarn.
          ["corepack", ["yarn", "node", "check.mjs", version]]
        : ["node", ["check.mjs", version]];
  if (run(command[0], command[1], dir) !== 0) fail(`the ${manager} check failed`);
  console.log(`verify-published: ok, ${manager} installed ${version} and the checks passed`);
}

function parseArguments(argv) {
  const options = { mode: "install", version: "latest", manager: "npm", wait: 15 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--resolve") {
      options.mode = "resolve";
    } else if (argument === "--metadata") {
      options.mode = "metadata";
    } else if (argument === "--manager") {
      index += 1;
      options.manager = argv[index] ?? "";
    } else if (argument === "--wait") {
      index += 1;
      options.wait = Number(argv[index] ?? "");
    } else if (argument.startsWith("-")) {
      fail(`unknown argument '${argument}'`);
    } else {
      options.version = argument;
    }
  }
  if (!MANAGERS.includes(options.manager)) {
    fail(`'${options.manager}' is not one of ${MANAGERS.join(", ")}`);
  }
  if (!Number.isFinite(options.wait) || options.wait < 0) {
    fail("--wait needs a number of minutes");
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  let version = options.version;
  if (version === "latest") {
    const document = await registryDocument("nepdate-core");
    version = document["dist-tags"]?.latest;
    if (typeof version !== "string" || version === "") {
      fail("npm publishes no latest dist-tag for nepdate-core");
    }
    if (options.mode !== "resolve") console.log(`verify-published: npm latest is ${version}`);
  }
  if (options.mode === "resolve") {
    console.log(version);
    return;
  }
  if (!VERSION_PATTERN.test(version)) {
    fail(`'${version}' is not a version like 0.1.0 or 0.1.0-beta.1`);
  }
  if (options.mode === "metadata") {
    await checkMetadata(version);
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "nepdate-verify-published-"));
  console.log(`verify-published: ${options.manager} install of ${version} in ${dir}`);
  try {
    writeProject(dir, options.manager, version);
    installWithRetries(dir, options.manager, version, options.wait);
    check(dir, options.manager, version);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`verify-published: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
