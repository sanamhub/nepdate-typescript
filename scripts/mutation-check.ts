// Compares the Stryker reports with the floor and the equivalent-mutant list (T8-04). Exits 1 when
// the score is below the floor or when a survived or no-coverage mutant is not in
// docs/mutation/equivalent.md. The score formula is in ADR-0007.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type Summary, summarize } from "./mutation-summary.ts";

const KEY = /(packages\/[^#\s]+\.ts)#([A-Za-z0-9_-]+)/;

export interface CheckResult {
  readonly ok: boolean;
  readonly score: number;
  readonly floor: number;
  readonly survivors: number;
  readonly equivalent: number;
  readonly untriaged: readonly string[];
  readonly errors: readonly string[];
}

/** The `file#id` keys listed in the first cell of the equivalent table, or in a bullet. */
export function equivalentIds(markdown: string): Set<string> {
  const ids = new Set<string>();
  for (const line of markdown.split(/\r?\n/)) {
    const cells = line.startsWith("|") ? line.split("|") : [];
    const candidates = cells.length > 1 ? [cells[1] as string] : [line.replace(/^[-*]\s*/, "")];
    for (const candidate of candidates) {
      const match = KEY.exec(candidate.replaceAll("`", ""));
      if (match !== null) ids.add(`${match[1] as string}#${match[2] as string}`);
    }
  }
  return ids;
}

export function checkSummary(summary: Summary, floor: number, markdown: string): CheckResult {
  const equivalent = equivalentIds(markdown);
  const untriaged = summary.survivors
    .filter((survivor) => !survivor.static)
    .map((survivor) => `${survivor.file}#${survivor.id}`)
    .filter((key) => !equivalent.has(key));
  const errors: string[] = [];
  if (summary.counts.score < floor) {
    errors.push(`mutation score ${summary.counts.score.toFixed(2)}% is below the floor ${floor}%`);
  }
  if (untriaged.length > 0) {
    errors.push(`${untriaged.length} survivor(s) have no equivalent entry`);
    for (const key of untriaged.slice(0, 20)) errors.push(`  ${key}`);
    if (untriaged.length > 20) errors.push(`  ... and ${untriaged.length - 20} more`);
  }
  return {
    ok: errors.length === 0,
    score: summary.counts.score,
    floor,
    survivors: summary.survivors.filter((survivor) => !survivor.static).length,
    equivalent: equivalent.size,
    untriaged,
    errors,
  };
}

export function readFloor(path: string): number {
  const data = JSON.parse(readFileSync(path, "utf8")) as { floor?: unknown };
  if (typeof data.floor !== "number" || !Number.isFinite(data.floor)) {
    throw new Error(`${path} has no numeric floor`);
  }
  return data.floor;
}

function argument(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`missing --${name}`);
  return value;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const summary = summarize(
    [
      { name: "nepdate", path: argument("core") },
      { name: "nepdate-patro", path: argument("patro") },
    ],
    {
      date: "",
      commit: "",
      wallSeconds: 0,
      concurrency: 0,
      strykerSummary: "",
    },
  );
  const result = checkSummary(
    summary,
    readFloor(argument("floor")),
    readFileSync(argument("equivalent"), "utf8"),
  );
  console.log(
    `mutation-check: score ${result.score.toFixed(2)}% (floor ${result.floor}%), ` +
      `${result.survivors} survivor(s), ${result.equivalent} equivalent key(s)`,
  );
  for (const message of result.errors) console.error(`mutation-check: ${message}`);
  if (!result.ok) process.exitCode = 1;
}
