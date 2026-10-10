import { playwright } from "@vitest/browser-playwright";
import { defineConfig, type ViteUserConfig } from "vitest/config";

// Browser smoke test (ADR-0004, runtimes): imports both built packages in Chromium. CI runs it
// after `npm run build`; it is not one of the `npm run ci` gates.
const config: ViteUserConfig = defineConfig({
  test: {
    include: ["test/**/*.browser.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});

export default config;
