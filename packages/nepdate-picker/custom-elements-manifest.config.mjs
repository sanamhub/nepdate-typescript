// Custom Elements Manifest (custom-elements.json) for editors, Storybook and framework tooling.
// scripts/picker-assets.ts runs the analyzer on the sources after each build. The manifest names the
// published files, so every source path ("src/input.ts", "./input.js", "/src/input.js") becomes
// the dist JavaScript ("dist/input.js").

const toDist = (path) => `dist/${path.replace(/^\.?\/?(?:src\/)?/, "").replace(/\.ts$/, ".js")}`;

function rewritePaths(node) {
  if (Array.isArray(node)) {
    for (const item of node) rewritePaths(item);
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if ((key === "path" || key === "module") && typeof value === "string")
        node[key] = toDist(value);
      else rewritePaths(value);
    }
  }
}

export default {
  globs: ["src/calendar.ts", "src/input.ts", "src/index.ts"],
  outdir: ".",
  // package.json names the manifest already; the build must not rewrite it.
  packagejson: false,
  plugins: [
    {
      name: "dist-paths",
      packageLinkPhase({ customElementsManifest }) {
        rewritePaths(customElementsManifest.modules);
      },
    },
  ],
};
