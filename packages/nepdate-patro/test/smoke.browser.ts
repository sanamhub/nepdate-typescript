import { expect, test } from "vitest";

test("both built packages load in the browser", async () => {
  const core = await import("nepdate");
  const patro = await import("nepdate-patro");
  expect(core).toBeTypeOf("object");
  expect(patro).toBeTypeOf("object");
});
