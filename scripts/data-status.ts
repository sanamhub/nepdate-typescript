// Reports how far the built patro tables reach and blocks a release with short holiday data.
// The source is the built `dist/build.js` and `dist/tables.gen.js`, not shared/data/patro/*.json.
//
//   node scripts/data-status.ts
//   node scripts/data-status.ts --today 2027-06-03
//
// Public holidays are the release blocker: fewer than 183 days left fails. Tithi and events print a
// warning and still exit 0. The default --today is the current UTC date.

import { NepaliDate } from "@nepdate/core";

const GATE_DAYS = 183;
const KINDS = ["tithi", "holidays", "events"] as const;
type Kind = (typeof KINDS)[number];

interface AdDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

interface BuiltInfo {
  readonly tithi: unknown;
  readonly events: readonly unknown[];
}

interface BuiltPatro {
  readonly info: readonly BuiltInfo[];
  readonly holidays: readonly NepaliDate[];
}

interface Range {
  readonly kind: Kind;
  readonly first: NepaliDate;
  readonly last: NepaliDate;
  readonly daysLeft: number;
}

class DataError extends Error {}

function usage(): string {
  return [
    "usage: node scripts/data-status.ts [--today YYYY-MM-DD]",
    "",
    "  --today  AD date to count from (default: current UTC date)",
    "  --help   print this help",
  ].join("\n");
}

function utcToday(): AdDate {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() };
}

function parseAd(text: string): AdDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) throw new DataError(`--today ${text}: expected an AD date in YYYY-MM-DD`);
  const date: AdDate = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
  if (
    check.getUTCFullYear() !== date.year ||
    check.getUTCMonth() + 1 !== date.month ||
    check.getUTCDate() !== date.day
  ) {
    throw new DataError(`--today ${text}: not a real date`);
  }
  return date;
}

function formatAd(date: AdDate): string {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(
    date.day,
  ).padStart(2, "0")}`;
}

function adOf(date: NepaliDate): string {
  const value = date.toGregorian();
  return formatAd(value);
}

function serialOf(date: NepaliDate): number {
  return NepaliDate.MIN.daysUntil(date);
}

async function builtTables(): Promise<{ patro: BuiltPatro; coverageFirst: number }> {
  try {
    const buildModule = (await import(
      new URL("../packages/nepdate-patro/dist/build.js", import.meta.url).href
    )) as { build: () => BuiltPatro };
    const tables = (await import(
      new URL("../packages/nepdate-patro/dist/tables.gen.js", import.meta.url).href
    )) as { COVERAGE_FIRST: number };
    return { patro: buildModule.build(), coverageFirst: tables.COVERAGE_FIRST };
  } catch (error) {
    throw new DataError(
      `cannot read the built patro tables: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function ranges(patro: BuiltPatro, coverageFirst: number, today: AdDate): Range[] {
  const todaySerial = serialOf(NepaliDate.fromGregorian(today));
  const found: Partial<Record<Kind, { first: number; last: number }>> = {};

  const add = (kind: Kind, serial: number): void => {
    const current = found[kind];
    found[kind] =
      current === undefined
        ? { first: serial, last: serial }
        : { first: Math.min(current.first, serial), last: Math.max(current.last, serial) };
  };

  for (const [offset, info] of patro.info.entries()) {
    const serial = coverageFirst + offset;
    if (info.tithi !== null) add("tithi", serial);
    if (info.events.length > 0) add("events", serial);
  }
  for (const holiday of patro.holidays) add("holidays", serialOf(holiday));

  const result: Range[] = [];
  for (const kind of KINDS) {
    const range = found[kind];
    if (range === undefined) throw new DataError(`no ${kind} data in the built tables`);
    const first = NepaliDate.MIN.addDays(range.first);
    const last = NepaliDate.MIN.addDays(range.last);
    result.push({ kind, first, last, daysLeft: range.last - todaySerial });
  }
  return result;
}

async function diagnose(today: AdDate): Promise<{
  lines: string[];
  warnings: string[];
  failures: string[];
}> {
  const { patro, coverageFirst } = await builtTables();
  const lines = [`today (AD): ${formatAd(today)}`];
  const warnings: string[] = [];
  const failures: string[] = [];
  for (const range of ranges(patro, coverageFirst, today)) {
    lines.push(
      `${range.kind}: BS ${range.first.toJSON()} ..= ${range.last.toJSON()} (AD ${adOf(
        range.first,
      )} ..= ${adOf(range.last)}), ${range.daysLeft} days left`,
    );
    if (range.daysLeft >= GATE_DAYS) continue;
    const label = range.kind === "holidays" ? "public holiday" : range.kind;
    const message = `${label} data ends in ${range.daysLeft} days, less than ${GATE_DAYS}; refresh it before the release`;
    if (range.kind === "holidays") failures.push(message);
    else warnings.push(message);
  }
  return { lines, warnings, failures };
}

async function main(argv: readonly string[]): Promise<number> {
  let todayText: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      console.log(usage());
      return 0;
    }
    if (argument === "--today") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        console.error(usage());
        return 2;
      }
      todayText = value;
      index++;
      continue;
    }
    console.error(`data-status: unknown argument ${String(argument)}\n${usage()}`);
    return 2;
  }

  let today: AdDate;
  try {
    today = todayText === undefined ? utcToday() : parseAd(todayText);
  } catch (error) {
    console.error(`data-status: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }

  try {
    const report = await diagnose(today);
    for (const line of report.lines) console.log(line);
    for (const warning of report.warnings) console.log(`WARNING: ${warning}`);
    for (const failure of report.failures) console.error(`FAIL: ${failure}`);
    return report.failures.length === 0 ? 0 : 1;
  } catch (error) {
    console.error(`data-status: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
