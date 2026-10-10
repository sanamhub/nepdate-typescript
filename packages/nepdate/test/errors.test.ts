import { expect, test } from "vitest";
import { NepDateError } from "../src/index.js";

test("NepDateError is a RangeError named NepDateError with a kind", () => {
  const error = new NepDateError("invalid-day", "day 33 is outside 1..32 for 2081-4");
  expect(error).toBeInstanceOf(RangeError);
  expect(error.name).toBe("NepDateError");
  expect(error.kind).toBe("invalid-day");
  expect(String(error)).toBe("NepDateError: day 33 is outside 1..32 for 2081-4");
});
