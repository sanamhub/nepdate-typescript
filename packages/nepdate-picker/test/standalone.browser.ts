import { expect, test } from "vitest";

// dist/nepdate-picker.js is for a page with no bundler and no import map (ADR-0015). CI builds it
// before the browser job runs this file; locally, `npm run build` first.
test("the standalone file registers both elements without loading the core separately", async () => {
  const url = new URL("../dist/nepdate-picker.js", import.meta.url).href;
  await import(/* @vite-ignore */ url);
  expect(customElements.get("nepdate-calendar")).toBeDefined();
  expect(customElements.get("nepdate-input")).toBeDefined();

  const loaded = performance.getEntriesByType("resource").map((entry) => entry.name);
  expect(loaded.some((name) => name.includes("/packages/nepdate/"))).toBe(false);

  const form = document.createElement("form");
  form.innerHTML = '<nepdate-input name="dob" value="2081-04-15"></nepdate-input>';
  document.body.append(form);
  expect(new FormData(form).get("dob")).toBe("2081-04-15");
  form.remove();
});
