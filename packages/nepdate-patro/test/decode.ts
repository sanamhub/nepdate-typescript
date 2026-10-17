// Decoders for the base64 typed arrays of tables.gen.ts, for the tests only. They read
// little-endian values, as the generator writes them, so they do not depend on the host's order.

function view(text: string): DataView {
  const buffer = Buffer.from(text, "base64");
  return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/** The bytes of a base64 `Uint8Array` table. */
export function decodeBytes(text: string): Uint8Array {
  const data = view(text);
  const out = new Uint8Array(data.byteLength);
  for (let i = 0; i < out.length; i++) out[i] = data.getUint8(i);
  return out;
}

/** The values of a base64 `Int32Array` table. */
export function decodeInt32(text: string): Int32Array {
  const data = view(text);
  const out = new Int32Array(data.byteLength / 4);
  for (let i = 0; i < out.length; i++) out[i] = data.getInt32(i * 4, true);
  return out;
}

/** The values of a base64 `Uint16Array` table. */
export function decodeUint16(text: string): Uint16Array {
  const data = view(text);
  const out = new Uint16Array(data.byteLength / 2);
  for (let i = 0; i < out.length; i++) out[i] = data.getUint16(i * 2, true);
  return out;
}
