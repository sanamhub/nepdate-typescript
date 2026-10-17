import { test } from "vitest";
import { type Row, readVectors } from "./vectors.js";

/**
 * How one C# catalogue row is covered (docs/plan/00-ROADMAP.md, "C# test catalogue"):
 * - a function: the C# assertions translated to this port's API;
 * - `{ deviation }`: PARITY says the port behaves differently, so the row is skipped with that id;
 * - `{ pending }`: the row needs the API of a later task, named in the marker (PORT-PLAN, "C# test
 *   catalogue"). That task removes the marker.
 */
export type CatalogCase =
  | (() => void)
  | { readonly deviation: `D-${string}` }
  | { readonly pending: string };

let catalog: Row[] | undefined;

/** The rows of `csharp-tests/catalog.tsv` whose `phase` column equals one of `tags`. */
export function catalogRows(...tags: string[]): Row[] {
  catalog ??= readVectors("csharp-tests/catalog.tsv");
  return catalog.filter((row) => tags.includes(row.phase as string));
}

/**
 * Declares one Vitest test per catalogue row tagged with one of `tags`, named exactly after the
 * row's id. Pass `file` to keep the rows of one C# test file (the patro and interop rows share
 * phase 4 but live in different packages). A row without an entry in `cases`, and an entry
 * without a row, fail with the id.
 */
export function checkCatalog(
  tags: string | string[],
  cases: Record<string, CatalogCase>,
  file?: string,
): void {
  const rows = catalogRows(...(Array.isArray(tags) ? tags : [tags])).filter(
    (row) => file === undefined || row.file === file,
  );
  const ids = new Set(rows.map((row) => row.id as string));
  for (const id of ids) {
    const entry = cases[id];
    if (entry === undefined) {
      test(id, () => {
        throw new Error(`catalogue row ${id} has no case`);
      });
    } else if (typeof entry === "function") {
      test(id, entry);
    } else if ("deviation" in entry) {
      test(id, (ctx) => ctx.skip(entry.deviation));
    } else {
      test(id, (ctx) => ctx.skip(`pending ${entry.pending}`));
    }
  }
  for (const id of Object.keys(cases)) {
    if (!ids.has(id)) {
      test(`stale case ${id}`, () => {
        throw new Error(`case ${id} matches no catalogue row tagged ${String(tags)}`);
      });
    }
  }
}
