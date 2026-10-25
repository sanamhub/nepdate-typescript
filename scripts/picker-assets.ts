// Builds the picker files that tsc does not emit (ADR-0015), after
// `tsc -p packages/nepdate-picker/tsconfig.build.json` and the core's build:
//   - dist/theme.css, copied from src.
//   - dist/nepdate-picker.js, the standalone file: the elements and the core in one module that
//     registers both elements, for a page with no bundler and no import map. The npm entries keep
//     the core as a peer; this file is for a <script> tag, a CDN or a copied wwwroot file.

import { copyFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const picker = fileURLToPath(new URL("../packages/nepdate-picker/", import.meta.url));
const { version } = JSON.parse(readFileSync(`${picker}package.json`, "utf8")) as {
  version: string;
};

copyFileSync(`${picker}src/theme.css`, `${picker}dist/theme.css`);

buildSync({
  entryPoints: [`${picker}dist/define.js`],
  outfile: `${picker}dist/nepdate-picker.js`,
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2022",
  // The MIT notice the bundled copy of the core needs, in one line.
  banner: {
    js: `/*! nepdate-picker ${version} with nepdate-core. MIT License. https://github.com/sanamhub/nepdate-typescript */`,
  },
  legalComments: "none",
  logLevel: "warning",
});
