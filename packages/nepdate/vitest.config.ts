import { defineConfig, type ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Print console output of passing tests too, so CI logs show the exhaustive count.
    silent: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      thresholds: { lines: 90 },
    },
  },
});

export default config;
