// Prints the version the core and patro packages declare, after checking they agree (hub ADR-0004
// §3). The date picker is a UI component outside the SDK line (hub ADR-0007 decision 6).
import { readFileSync } from "node:fs";

function versionOf(file: string): string {
  const manifest = JSON.parse(readFileSync(file, "utf8")) as { version?: unknown };
  if (typeof manifest.version !== "string" || manifest.version === "") {
    console.error(`version: ${file} has no version`);
    process.exit(1);
  }
  return manifest.version;
}

const core = versionOf("packages/nepdate/package.json");
const patro = versionOf("packages/nepdate-patro/package.json");
if (core !== patro) {
  console.error(`version: nepdate-core is ${core} but nepdate-patro is ${patro}`);
  process.exit(1);
}
console.log(core);
