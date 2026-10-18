// Runnable TSDoc examples (T9-03). Every `@example` on a public declaration is executed against
// the built packages, and every `// =>` line is compared with node:util.isDeepStrictEqual. The
// docs gate calls checkExamples; the unit tests call the smaller functions.
//
// The allow-list below is the only place where an example may omit a result comment.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "typescript";
import { PACKAGES, type PackageSource } from "./api-surface.ts";

const ROOT = resolve(import.meta.dirname, "..");
const RESULT_MARKER = "// =>";
const NON_EXPRESSION =
  /^(?:const|let|var|return|if|else|for|while|do|switch|function|class|import|export|try|catch|throw)\b/;

// The only examples that cannot have a deterministic result. Each entry has a reason comment.
export const ALLOW_LIST = [
  {
    label: "nepdate:NepaliDate.today",
    reason: "today() reads the clock, so its date changes between runs.",
  },
] as const;

export interface DeclarationExamples {
  readonly label: string;
  readonly required: boolean;
  readonly examples: readonly string[];
}

export interface ExampleRun {
  readonly errors: string[];
  readonly examples: number;
  readonly assertions: number;
  readonly skipped: string[];
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some((m) => m.kind === kind) ?? false)
  );
}

function isHidden(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  return (
    ts
      .getModifiers(node)
      ?.some(
        (modifier) =>
          modifier.kind === ts.SyntaxKind.PrivateKeyword ||
          modifier.kind === ts.SyntaxKind.ProtectedKeyword,
      ) ?? false
  );
}

function exampleText(tag: ts.JSDocTag): string {
  if (typeof tag.comment === "string") return tag.comment.trim();
  if (Array.isArray(tag.comment)) {
    return tag.comment
      .map((part) => part.text)
      .join("")
      .trim();
  }
  return "";
}

function examplesOf(node: ts.Node): string[] {
  return ts
    .getJSDocTags(node)
    .filter((tag) => tag.tagName.text === "example")
    .map(exampleText)
    .filter((text) => text !== "");
}

function isFactory(member: ts.ClassElement, className: string): boolean {
  if (!ts.isMethodDeclaration(member) || !hasModifier(member, ts.SyntaxKind.StaticKeyword)) {
    return false;
  }
  return new RegExp(`\\b${className}\\b`).test(member.type?.getText() ?? "");
}

function add(
  declarations: DeclarationExamples[],
  label: string,
  required: boolean,
  examples: string[],
): void {
  if (!required && examples.length === 0) return;
  declarations.push({ label, required, examples });
}

export function collectExamples(
  sources: readonly PackageSource[] = PACKAGES,
  root = process.cwd(),
): DeclarationExamples[] {
  const program = ts.createProgram(
    sources.map((source) => resolve(root, source.entry)),
    {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      skipLibCheck: true,
      noEmit: true,
    },
  );
  const checker = program.getTypeChecker();
  const declarations: DeclarationExamples[] = [];

  for (const source of sources) {
    const sourceFile = program.getSourceFile(resolve(root, source.entry));
    if (sourceFile === undefined) throw new Error(`cannot read ${source.entry}`);
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (moduleSymbol === undefined) continue;
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const symbol =
        (exported.flags & ts.SymbolFlags.Alias) !== 0
          ? checker.getAliasedSymbol(exported)
          : exported;
      const declaration = symbol.declarations?.find(
        (candidate) => !ts.isExportSpecifier(candidate),
      );
      if (declaration === undefined) continue;

      if (ts.isFunctionDeclaration(declaration) && declaration.name !== undefined) {
        add(declarations, `${source.name}:${declaration.name.text}`, true, examplesOf(declaration));
      } else if (ts.isClassDeclaration(declaration) && declaration.name !== undefined) {
        const className = declaration.name.text;
        add(declarations, `${source.name}:${className}`, true, examplesOf(declaration));
        for (const member of declaration.members) {
          if (isHidden(member)) continue;
          const named = member as ts.NamedDeclaration;
          if (named.name === undefined || ts.isPrivateIdentifier(named.name)) continue;
          const name = named.name.getText();
          const isStatic = hasModifier(member, ts.SyntaxKind.StaticKeyword);
          const label = `${source.name}:${className}${isStatic ? "." : "#"}${name}`;
          add(declarations, label, isFactory(member, className), examplesOf(member));
        }
      } else if (
        (ts.isInterfaceDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration)) &&
        declaration.name !== undefined
      ) {
        add(
          declarations,
          `${source.name}:${declaration.name.text}`,
          false,
          examplesOf(declaration),
        );
      }
    }
  }
  return declarations;
}

export function coverageErrors(
  declarations: readonly DeclarationExamples[],
  allowList: ReadonlyArray<{ readonly label: string }> = ALLOW_LIST,
): string[] {
  const errors: string[] = [];
  const allowed = new Set(allowList.map((entry) => entry.label));
  const labels = new Set(declarations.map((declaration) => declaration.label));
  for (const declaration of declarations) {
    if (declaration.required && declaration.examples.length === 0) {
      errors.push(`${declaration.label} has no @example`);
    }
    for (const example of declaration.examples) {
      if (!example.includes(RESULT_MARKER) && !allowed.has(declaration.label)) {
        errors.push(`${declaration.label} has an @example with no ${RESULT_MARKER} result`);
      }
    }
  }
  for (const entry of allowList) {
    const declaration = declarations.find((candidate) => candidate.label === entry.label);
    if (declaration === undefined || !labels.has(entry.label)) {
      errors.push(`allow-list entry ${entry.label} has no example`);
    } else if (declaration.examples.every((example) => example.includes(RESULT_MARKER))) {
      // Once every example of an entry has a result, the entry hides nothing and must go.
      errors.push(
        `allow-list entry ${entry.label} is stale: every example has a ${RESULT_MARKER} result`,
      );
    }
  }
  return errors;
}

function prelude(): string {
  return [
    'import { isDeepStrictEqual } from "node:util";',
    'import { DateRange, FiscalYear, NepDateError, NepaliDate, monthName, monthShortName, toNepaliDigits, weekdayName, weekdayShortName } from "nepdate";',
    'import { coverage, info, publicHolidays } from "nepdate-patro";',
    "",
    "function check(actual, expected, label) {",
    "  if (!isDeepStrictEqual(actual, expected)) {",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: this is generated code.
    "    console.error(`example ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);",
    "    process.exitCode = 1;",
    "  }",
    "}",
    "",
  ].join("\n");
}

export function compileExample(
  label: string,
  example: string,
): { code: string; assertions: number } {
  const lines = example.split(/\r?\n/);
  const output: string[] = [];
  let assertions = 0;
  lines.forEach((line, index) => {
    const marker = line.indexOf(RESULT_MARKER);
    if (marker < 0) {
      output.push(line);
      return;
    }
    const before = line.slice(0, marker).trim();
    const expected = line.slice(marker + RESULT_MARKER.length).trim();
    if (before === "" || expected === "") {
      throw new Error(
        `${label}:${index + 1}: a ${RESULT_MARKER} line needs an expression and a value`,
      );
    }
    const expression = before.endsWith(";") ? before.slice(0, -1) : before;
    if (NON_EXPRESSION.test(expression) || expression === "}") {
      throw new Error(`${label}:${index + 1}: ${RESULT_MARKER} must follow a single expression`);
    }
    output.push(
      `check((${expression}), (${expected}), ${JSON.stringify(`${label}:${index + 1}`)});`,
    );
    assertions++;
  });
  return { code: `${prelude()}${output.join("\n")}\n`, assertions };
}

export function runExamples(
  declarations: readonly DeclarationExamples[],
  workRoot = ROOT,
): ExampleRun {
  const errors: string[] = [];
  const skipped: string[] = [];
  let examples = 0;
  let assertions = 0;
  const base = join(workRoot, ".readme-check");
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, "examples-"));
  try {
    for (const declaration of declarations) {
      declaration.examples.forEach((example, index) => {
        const label = `${declaration.label} example ${index + 1}`;
        let compiled: { code: string; assertions: number };
        try {
          compiled = compileExample(label, example);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
          return;
        }
        const file = join(dir, `example-${examples}.mjs`);
        writeFileSync(file, compiled.code);
        const result = spawnSync(process.execPath, [file], {
          cwd: workRoot,
          encoding: "utf8",
          timeout: 10_000,
        });
        examples++;
        assertions += compiled.assertions;
        if (compiled.assertions === 0) skipped.push(label);
        if (result.status !== 0) {
          const detail = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
          errors.push(
            `${label} exited ${String(result.status)}${detail === "" ? "" : `\n${detail}`}`,
          );
        }
      });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return { errors, examples, assertions, skipped };
}

export function checkExamples(
  sources: readonly PackageSource[] = PACKAGES,
  root = ROOT,
): ExampleRun {
  const declarations = collectExamples(sources, root);
  const coverage = coverageErrors(declarations);
  if (coverage.length > 0) return { errors: coverage, examples: 0, assertions: 0, skipped: [] };
  return runExamples(declarations, root);
}
