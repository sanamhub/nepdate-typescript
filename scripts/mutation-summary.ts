// Reads the two Stryker JSON reports and writes the committed summary (T8-02). The score is
// Stryker's: (killed + timeout) / (killed + timeout + survived + no coverage). Runtime errors,
// compile errors and ignored mutants are outside the denominator.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type MutantStatus =
  | "Killed"
  | "Survived"
  | "NoCoverage"
  | "Timeout"
  | "RuntimeError"
  | "CompileError"
  | "Ignored"
  | "Pending";

export interface Mutant {
  readonly id: string;
  readonly mutatorName: string;
  readonly status: MutantStatus;
  readonly replacement?: string;
  readonly description?: string;
  readonly static?: boolean;
  readonly location: {
    readonly start: { readonly line: number; readonly column: number };
    readonly end: { readonly line: number; readonly column: number };
  };
}

export interface Report {
  readonly files: Record<string, { readonly mutants: readonly Mutant[] }>;
}

export interface Counts {
  readonly killed: number;
  readonly survived: number;
  readonly timeout: number;
  readonly noCoverage: number;
  readonly runtimeError: number;
  readonly compileError: number;
  readonly ignored: number;
  readonly staticMutants: number;
  readonly total: number;
  readonly valid: number;
  readonly score: number;
}

export interface Survivor {
  readonly file: string;
  readonly id: string;
  readonly status: "Survived" | "NoCoverage";
  readonly mutatorName: string;
  readonly line: number;
  readonly column: number;
  readonly replacement: string;
  readonly description: string;
  readonly static: boolean;
}

export interface FileSummary extends Counts {
  readonly file: string;
}

export interface Summary {
  readonly date: string;
  readonly commit: string;
  readonly wallSeconds: number;
  readonly concurrency: number;
  readonly strykerSummary: string;
  readonly reports: readonly {
    readonly name: string;
    readonly files: number;
    readonly counts: Counts;
  }[];
  readonly files: readonly FileSummary[];
  readonly counts: Counts;
  readonly survivors: readonly Survivor[];
}

function countsOf(mutants: readonly Mutant[]): Counts {
  let killed = 0;
  let survived = 0;
  let timeout = 0;
  let noCoverage = 0;
  let runtimeError = 0;
  let compileError = 0;
  let ignored = 0;
  let staticMutants = 0;
  for (const mutant of mutants) {
    // The Stryker 10 Vitest runner cannot reload a module evaluated at import, so static results
    // are not observable. They stay in the report but are outside the measured set.
    if (mutant.static === true) {
      staticMutants++;
      continue;
    }
    switch (mutant.status) {
      case "Killed":
        killed++;
        break;
      case "Survived":
        survived++;
        break;
      case "Timeout":
        timeout++;
        break;
      case "NoCoverage":
        noCoverage++;
        break;
      case "RuntimeError":
        runtimeError++;
        break;
      case "CompileError":
        compileError++;
        break;
      case "Ignored":
        ignored++;
        break;
      default:
        break;
    }
  }
  const valid = killed + timeout + survived + noCoverage;
  return {
    killed,
    survived,
    timeout,
    noCoverage,
    runtimeError,
    compileError,
    ignored,
    staticMutants,
    total: valid + runtimeError + compileError + ignored,
    valid,
    score: valid === 0 ? 0 : ((killed + timeout) / valid) * 100,
  };
}

export function readReport(path: string): Report {
  return JSON.parse(readFileSync(path, "utf8")) as Report;
}

export function summarize(
  reports: readonly { readonly name: string; readonly path: string }[],
  meta: {
    readonly date: string;
    readonly commit: string;
    readonly wallSeconds: number;
    readonly concurrency: number;
    readonly strykerSummary: string;
  },
): Summary {
  const files: FileSummary[] = [];
  const survivors: Survivor[] = [];
  const reportSummaries: { name: string; files: number; counts: Counts }[] = [];
  let all: Mutant[] = [];
  for (const entry of reports) {
    const report = readReport(entry.path);
    const mutants = Object.entries(report.files).flatMap(([file, result]) => {
      files.push({ file, ...countsOf(result.mutants) });
      for (const mutant of result.mutants) {
        if (mutant.status === "Survived" || mutant.status === "NoCoverage") {
          survivors.push({
            file,
            id: mutant.id,
            status: mutant.status,
            mutatorName: mutant.mutatorName,
            line: mutant.location.start.line,
            column: mutant.location.start.column,
            replacement: mutant.replacement ?? "",
            description: mutant.description ?? "",
            static: mutant.static ?? false,
          });
        }
      }
      return result.mutants;
    });
    all = all.concat(mutants);
    reportSummaries.push({
      name: entry.name,
      files: Object.keys(report.files).length,
      counts: countsOf(mutants),
    });
  }
  files.sort((a, b) => a.file.localeCompare(b.file));
  survivors.sort((a, b) =>
    a.file === b.file ? a.line - b.line || a.id.localeCompare(b.id) : a.file.localeCompare(b.file),
  );
  return { ...meta, reports: reportSummaries, files, counts: countsOf(all), survivors };
}

export function summaryMarkdown(summary: Summary): string {
  const lines: string[] = [];
  lines.push("# Mutation summary", "");
  lines.push(`- Date: ${summary.date}`);
  lines.push(`- Commit: \`${summary.commit}\``);
  lines.push(`- Wall time: ${summary.wallSeconds} s`);
  lines.push(`- Concurrency: ${summary.concurrency}`);
  lines.push(`- Stryker: ${summary.strykerSummary}`);
  lines.push("");
  lines.push(
    `Score **${summary.counts.score.toFixed(2)}%** from ${summary.counts.killed} killed, ` +
      `${summary.counts.timeout} timeout, ${summary.counts.survived} survived and ` +
      `${summary.counts.noCoverage} no coverage. ${summary.counts.staticMutants} static mutant(s) ` +
      "are excluded: the Vitest 5 runner cannot reload import-time modules.",
  );
  lines.push("");
  lines.push(
    "| File | Killed | Survived | Timeout | No coverage | Runtime | Compile | Total | Score |",
  );
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const file of summary.files) {
    lines.push(
      `| \`${file.file}\` | ${file.killed} | ${file.survived} | ${file.timeout} | ` +
        `${file.noCoverage} | ${file.runtimeError} | ${file.compileError} | ${file.total} | ` +
        `${file.score.toFixed(1)}% |`,
    );
  }
  lines.push(
    `| **total** | **${summary.counts.killed}** | **${summary.counts.survived}** | ` +
      `**${summary.counts.timeout}** | **${summary.counts.noCoverage}** | ` +
      `**${summary.counts.runtimeError}** | **${summary.counts.compileError}** | ` +
      `**${summary.counts.total}** | **${summary.counts.score.toFixed(2)}%** |`,
  );
  lines.push("");
  lines.push(`${summary.survivors.length} survivor(s) are in \`summary.json\`.`);
  return `${lines.join("\n")}\n`;
}

export function writeSummary(dir: string, summary: Summary): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(join(dir, "summary.md"), summaryMarkdown(summary));
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
      date: argument("date"),
      commit: argument("commit"),
      wallSeconds: Number(argument("wall")),
      concurrency: Number(argument("concurrency")),
      strykerSummary: argument("stryker"),
    },
  );
  writeSummary(argument("out"), summary);
  console.log(
    `mutation-summary: ${summary.counts.total} mutants, score ${summary.counts.score.toFixed(2)}%, ` +
      `${summary.survivors.length} survivor(s)`,
  );
}
