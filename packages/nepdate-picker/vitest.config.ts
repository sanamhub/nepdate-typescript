import { defineConfig, type ViteUserConfig } from "vitest/config";

// The DOM-free part (grid.ts) and the entry load run in Node. The elements are tested in a real
// browser by vitest.browser.config.ts.
const config: ViteUserConfig = defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/grid.ts"],
      thresholds: { lines: 100, branches: 95 },
    },
  },
});

export default config;
