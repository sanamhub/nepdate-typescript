// The hub's patro counts, vendored as shared/spec/vectors/patro-summary.json. The generator and the
// tests read the same file (ADR-0017), so a data change moves the numbers in the summary, not here.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface PatroSummary {
  readonly schema: number;
  readonly first_year: number;
  readonly last_year: number;
  readonly first_day: string;
  readonly last_day: string;
  readonly first_serial: number;
  readonly last_serial: number;
  readonly days: number;
  readonly tithi_first_day: string;
  readonly tithi_last_day: string;
  readonly tithi_first_serial: number;
  readonly tithi_days: number;
  readonly tithi_names: number;
  readonly holidays: number;
  readonly event_days: number;
  readonly events: number;
  readonly event_names: number;
  readonly names: number;
  readonly name_bytes: number;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** The counts the hub generated from data/patro/ for the vendored shared/ tree. */
export const SUMMARY: PatroSummary = JSON.parse(
  readFileSync(join(ROOT, "shared", "spec", "vectors", "patro-summary.json"), "utf8"),
) as PatroSummary;
