import { expect, test } from "vitest";
import { NepDateError } from "../src/index.js";

test("NepDateError is an Error named NepDateError with a kind", () => {
  const error = new NepDateError("invalid-day", "day 33 is outside 1..32 for 2081-4");
  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(NepDateError);
  // Not a RangeError: a parse failure is not a numeric range failure, and a caller that catches
  // RangeError for an unrelated array index must not catch dates.
  expect(error).not.toBeInstanceOf(RangeError);
  expect(error.name).toBe("NepDateError");
  expect(error.kind).toBe("invalid-day");
  expect(String(error)).toBe("NepDateError: day 33 is outside 1..32 for 2081-4");
});
