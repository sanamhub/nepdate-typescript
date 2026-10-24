import { playwright } from "@vitest/browser-playwright";
import { defineConfig, type ViteUserConfig } from "vitest/config";

// The elements in Chromium, Firefox and WebKit (ADR-0015). CI installs the three browsers; locally
// BROWSERS=chromium runs one.
const browsers = (process.env.BROWSERS ?? "chromium,firefox,webkit").split(",") as (
  | "chromium"
  | "firefox"
  | "webkit"
)[];

const config: ViteUserConfig = defineConfig({
  test: {
    include: ["test/**/*.browser.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: browsers.map((browser) => ({ browser })),
    },
  },
});

export default config;
