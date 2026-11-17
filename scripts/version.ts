// Prints the version the core and patro packages declare, after checking they agree (hub ADR-0004
// §3) and that the patro requires exactly that core version as its peer (ADR-0020). The date
// picker is a UI component outside the SDK line (hub ADR-0007 decision 6).
import { readFileSync } from "node:fs";

interface Manifest {
  readonly version?: unknown;
  readonly peerDependencies?: Record<string, string>;
}

function read(file: string): Manifest {
  const manifest = JSON.parse(readFileSync(file, "utf8")) as Manifest;
  if (typeof manifest.version !== "string" || manifest.version === "") {
    console.error(`version: ${file} has no version`);
    process.exit(1);
  }
  return manifest;
}

const core = read("packages/nepdate/package.json").version as string;
const patroManifest = read("packages/nepdate-patro/package.json");
const patro = patroManifest.version as string;
if (core !== patro) {
  console.error(`version: nepdate-core is ${core} but nepdate-patro is ${patro}`);
  process.exit(1);
}
const peer = patroManifest.peerDependencies?.["nepdate-core"];
if (peer !== core) {
  console.error(
    `version: nepdate-patro requires nepdate-core ${String(peer)}, expected exactly ${core}`,
  );
  process.exit(1);
}
console.log(core);
