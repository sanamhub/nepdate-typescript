// Shared Stryker settings. The two configs differ only in their package, test config and report
// file. See docs/adr/0007-mutation-testing.md for the scope and the score rule.

import { join } from "node:path";

const TEMP_ROOT =
  process.platform === "win32" ? "D:\\devcache\\stryker" : join(process.cwd(), ".stryker-tmp");

export function strykerConfig(pkg, name) {
  return {
    // The core and patro sources are the only production code in scope. Generated tables are
    // written by scripts/codegen.ts and are covered by the codegen gate, not by mutation.
    mutate: [`packages/${pkg}/src/**/*.ts`, `!packages/${pkg}/src/**/*.gen.ts`],
    testRunner: "vitest",
    vitest: {
      configFile: `packages/${pkg}/vitest.stryker.config.ts`,
      // Stryker runs from the repository root; the package config's `include` is relative to the
      // package, so point Vitest at the package directory for test discovery.
      dir: `packages/${pkg}`,
      // The tests import the source through `../src/*.js`, which `vitest related` does not map
      // back to the `.ts` files in the sandbox, so Stryker runs the project's tests and uses the
      // per-test coverage analysis to pick the covering tests for each mutant.
      related: false,
    },
    concurrency: 2,
    // Static mutants (hit while a module is imported) are measured. The runner drops a test file
    // that fails at import instead of counting a failure, so each package has
    // test/entry-load.test.ts, which imports the entry inside a test; an import-time throw is then
    // a failed test. Static mutants run the whole suite, which makes them the slow part of a run.
    ignoreStatic: false,
    tempDirName: join(TEMP_ROOT, `${name}-tmp`),
    cleanTempDir: "always",
    incremental: true,
    incrementalFile: join(TEMP_ROOT, `${name}-incremental.json`),
    reporters: ["clear-text", "progress", "json"],
    jsonReporter: { fileName: `reports/mutation/${name}.json` },
    thresholds: { high: 90, low: 80, break: null },
    ignorePatterns: ["bench/node_modules", "docs", "reports", ".readme-check"],
  };
}
