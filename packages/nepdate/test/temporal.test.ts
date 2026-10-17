import { expect, test } from "vitest";
import { NepaliDate } from "../src/index.js";

// Temporal is in Node 26 and Deno, not Node 24, and no polyfill is allowed in devDependencies.
// The test shapes the little of the API it uses, so it compiles against the es2022 type library.
interface PlainDateLike {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  toString(): string;
}
interface TemporalStatic {
  readonly PlainDate: {
    from(
      value: string | { readonly year: number; readonly month: number; readonly day: number },
    ): PlainDateLike;
  };
}
const Temporal = (globalThis as { Temporal?: TemporalStatic }).Temporal;

test("Temporal.PlainDate is accepted and returned (skipped without Temporal)", (ctx) => {
  if (Temporal === undefined) {
    ctx.skip("globalThis.Temporal is not available on this runtime");
    return;
  }
  const fromTemporal = NepaliDate.fromGregorian(Temporal.PlainDate.from("2024-07-30"));
  expect(fromTemporal.toJSON()).toBe("2081-04-15");
  expect(Temporal.PlainDate.from(NepaliDate.of(2081, 4, 15).toGregorian()).toString()).toBe(
    "2024-07-30",
  );
});
