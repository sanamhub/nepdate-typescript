// A module that throws while it is imported fails its test files at collection, and the
// Stryker Vitest runner drops those files instead of counting a failure. This test imports the
// entry point inside a test, so an import-time throw (a static mutant that breaks a table build)
// is a failed test and the mutant is killed.

import { expect, test } from "vitest";

test("the package entry imports without throwing", async () => {
  const entry = await import("../src/index.js");
  expect(Object.keys(entry).length).toBeGreaterThan(0);
});
