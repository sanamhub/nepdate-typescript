import { expect, test } from "vitest";
import * as patro from "../src/index.js";

test("the package loads", () => {
  expect(patro).toBeTypeOf("object");
});
