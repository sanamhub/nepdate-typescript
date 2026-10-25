// The generated tables use only part of the base64 alphabet and few padding shapes, so
// the hand-written decoder is checked against Buffer for every alphabet character and for inputs
// with no padding, one "=" and two "=".

import { expect, test } from "vitest";
import { decodeBase64 } from "../src/build.js";

test("decodeBase64 matches Buffer for every length from 0 to 40 bytes", () => {
  for (let length = 0; length <= 40; length++) {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 73 + length * 29) & 0xff);
    const text = Buffer.from(bytes).toString("base64");
    expect(Array.from(decodeBase64(text)), text).toEqual(Array.from(bytes));
  }
});

test("decodeBase64 decodes the whole alphabet", () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  expect(Array.from(decodeBase64(alphabet))).toEqual(Array.from(Buffer.from(alphabet, "base64")));
});

test("RFC 4648 vectors", () => {
  const text = (value: string): string => new TextDecoder().decode(decodeBase64(value));
  expect(text("")).toBe("");
  expect(text("Zg==")).toBe("f");
  expect(text("Zm8=")).toBe("fo");
  expect(text("Zm9v")).toBe("foo");
  expect(text("Zm9vYg==")).toBe("foob");
  expect(text("Zm9vYmE=")).toBe("fooba");
  expect(text("Zm9vYmFy")).toBe("foobar");
});
