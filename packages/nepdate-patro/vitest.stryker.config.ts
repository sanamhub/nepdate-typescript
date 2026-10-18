// Vitest settings for the Stryker runs only (T8). The patro suite is small; the longer timeout
// keeps a shared machine from turning a slow worker into a failed dry run.

import type { Plugin } from "vite";
import { mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

// The Stryker 10 vitest runner builds its per-mutant test-name filter with names joined by " ",
// but Vitest 5 matches against names joined by " > " (stryker-js#6210). Nothing matched, so every
// test was skipped and a run with zero tests was reported as survived. This widens each space in
// the pattern to accept either joiner; it selects a superset of the covering tests, never a subset.
// Remove it once the Stryker pins move past stryker-js#6214.
const WIDEN_TEST_NAME_PATTERN = {
  name: "stryker-vitest5-test-name-pattern",
  configureVitest({
    project,
  }: {
    project: { config: { testNamePattern?: RegExp | string } };
  }): void {
    let pattern = project.config.testNamePattern;
    Object.defineProperty(project.config, "testNamePattern", {
      enumerable: true,
      configurable: true,
      get: () => pattern,
      set: (value: RegExp | string) => {
        pattern =
          value instanceof RegExp
            ? new RegExp(value.source.replaceAll(" ", "(?: > | )"), value.flags)
            : value;
      },
    });
  },
} as unknown as Plugin;

export default mergeConfig(base, {
  plugins: [WIDEN_TEST_NAME_PATTERN],
  test: {
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
