import { expect, test } from "vitest";
import { toNepaliDigits } from "../src/index.js";

test("toNepaliDigits keeps a negative sign and pads the digits", () => {
  expect(toNepaliDigits(-5)).toBe("-५");
  expect(toNepaliDigits(-5, 3)).toBe("-००५");
});
