import { expect, test } from "vitest";
import { FiscalYear } from "../src/index.js";

test("label pads a next year below ten and not ten itself", () => {
  expect(new FiscalYear(2108).label()).toBe("2108/09");
  expect(new FiscalYear(2109).label()).toBe("2109/10");
  expect(new FiscalYear(2099).label()).toBe("2099/00");
});
