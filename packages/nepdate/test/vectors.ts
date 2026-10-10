import { readFileSync } from "node:fs";

/** One row of a vector file, keyed by the names in its header line. */
export type Row = Readonly<Record<string, string>>;

/**
 * Reads `shared/spec/vectors/<file>` (TSV, or CSV when the name ends in `.csv`). Lines starting
 * with `#` are comments; the first other line is the header.
 */
export function readVectors(file: string): Row[] {
  const url = new URL(`../../../shared/spec/vectors/${file}`, import.meta.url);
  const separator = file.endsWith(".csv") ? "," : "\t";
  const lines = readFileSync(url, "utf8")
    .split("\n")
    .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line))
    .filter((line) => line !== "" && !line.startsWith("#"));
  const [header, ...body] = lines;
  if (header === undefined) throw new Error(`${file} has no header line`);
  const names = header.split(separator);
  return body.map((line, i) => {
    const cells = line.split(separator);
    if (cells.length !== names.length) {
      throw new Error(`${file} row ${i + 1}: ${cells.length} cells, header has ${names.length}`);
    }
    const row: Record<string, string> = {};
    names.forEach((name, j) => {
      row[name] = cells[j] as string;
    });
    return row;
  });
}
