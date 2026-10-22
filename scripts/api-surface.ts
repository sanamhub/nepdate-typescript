// Canonical public API surface (T9-02). The snapshot reader follows the re-export aliases in each
// package's built `dist/index.d.ts` and records one canonical line per public item. The same
// canonical form is parsed from the TypeScript fences in docs/API.md, so the snapshot and the
// contract are compared as signatures, not names in prose.
//
// Run `node scripts/api-check.ts --write` after a deliberate surface change.

import { resolve } from "node:path";
import ts from "typescript";

export interface PackageSource {
  readonly name: string;
  readonly entry: string;
}

export type Surface = Record<string, string[]>;

export interface Snapshot {
  readonly format: 1;
  readonly packages: Surface;
}

export const SNAPSHOT_FORMAT = 1;

export const PACKAGES: readonly PackageSource[] = [
  { name: "@nepdate/core", entry: "packages/nepdate/dist/index.d.ts" },
  { name: "@nepdate/patro", entry: "packages/nepdate-patro/dist/index.d.ts" },
];

const printer = ts.createPrinter({ removeComments: true });

function canonical(node: ts.Node): string {
  // Printed without comments, so a TSDoc line on an option property does not change the surface.
  // A trailing semicolon before a closing brace is optional, so drop it and compare the type shape.
  return printer
    .printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
    .replace(/\s+/g, " ")
    .trim()
    .replace(/;\s*}/g, " }");
}

// A declaration kind the reader does not know would otherwise vanish from the surface, so an
// added export could never fail the gate. Fail loudly instead and extend the reader.
function unsupported(node: ts.Node, where: string): never {
  throw new Error(
    `api-surface: unsupported ${ts.SyntaxKind[node.kind]} in ${where}: ${node.getText().slice(0, 80)}`,
  );
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some((m) => m.kind === kind) ?? false)
  );
}

function isExported(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword);
}

// Private members are not surface. Protected members are, because a subclass can call them.
function isHidden(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.PrivateKeyword);
}

function parameterText(parameter: ts.ParameterDeclaration): string {
  const rest = parameter.dotDotDotToken === undefined ? "" : "...";
  const optional = parameter.questionToken === undefined ? "" : "?";
  const type = parameter.type === undefined ? "" : `: ${canonical(parameter.type)}`;
  return `${rest}${parameter.name.getText()}${optional}${type}`;
}

function signature(
  name: string,
  parameters: ts.NodeArray<ts.ParameterDeclaration>,
  returnType: ts.TypeNode | undefined,
  typeParameters: ts.NodeArray<ts.TypeParameterDeclaration> | undefined,
): string {
  const generics =
    typeParameters === undefined || typeParameters.length === 0
      ? ""
      : `<${typeParameters.map((parameter) => canonical(parameter)).join(", ")}>`;
  const result = returnType === undefined ? "" : `: ${canonical(returnType)}`;
  return `${name}${generics}(${parameters.map(parameterText).join(", ")})${result}`;
}

function heritage(declaration: ts.ClassDeclaration | ts.InterfaceDeclaration): string {
  const clauses = declaration.heritageClauses ?? [];
  return clauses
    .map(
      (clause) =>
        `${clause.token === ts.SyntaxKind.ExtendsKeyword ? "extends" : "implements"} ${clause.types
          .map((type) => canonical(type))
          .join(", ")}`,
    )
    .join(" ");
}

function classMember(member: ts.ClassElement): string | undefined {
  if (isHidden(member)) return undefined;
  const named = member as ts.NamedDeclaration;
  if (named.name !== undefined && ts.isPrivateIdentifier(named.name)) return undefined;
  const name = ts.isConstructorDeclaration(member) ? "constructor" : (named.name?.getText() ?? "");
  const staticPrefix = `${hasModifier(member, ts.SyntaxKind.ProtectedKeyword) ? "protected " : ""}${
    hasModifier(member, ts.SyntaxKind.StaticKeyword) ? "static " : ""
  }`;

  if (ts.isConstructorDeclaration(member)) {
    return signature(name, member.parameters, undefined, undefined);
  }
  if (ts.isPropertyDeclaration(member)) {
    const readonly = hasModifier(member, ts.SyntaxKind.ReadonlyKeyword) ? "readonly " : "";
    const optional = member.questionToken === undefined ? "" : "?";
    const type = member.type === undefined ? "" : `: ${canonical(member.type)}`;
    return `${staticPrefix}${readonly}${name}${optional}${type}`;
  }
  if (ts.isMethodDeclaration(member)) {
    const optional = member.questionToken === undefined ? "" : "?";
    return `${staticPrefix}${signature(
      `${name}${optional}`,
      member.parameters,
      member.type,
      member.typeParameters,
    )}`;
  }
  if (ts.isGetAccessorDeclaration(member)) {
    return `${staticPrefix}get ${name}()${member.type === undefined ? "" : `: ${canonical(member.type)}`}`;
  }
  if (ts.isSetAccessorDeclaration(member)) {
    return `${staticPrefix}set ${name}(${member.parameters.map(parameterText).join(", ")})`;
  }
  if (ts.isIndexSignatureDeclaration(member)) {
    return `[${member.parameters.map(parameterText).join(", ")}]: ${canonical(member.type)}`;
  }
  if (ts.isSemicolonClassElement(member)) return undefined;
  return unsupported(member, "a class");
}

function declarationEntries(declaration: ts.Node): string[] {
  if (ts.isFunctionDeclaration(declaration) && declaration.name !== undefined) {
    return [
      `export function ${signature(
        declaration.name.text,
        declaration.parameters,
        declaration.type,
        declaration.typeParameters,
      )}`,
    ];
  }
  if (ts.isTypeAliasDeclaration(declaration)) {
    const type = canonical(declaration.type).replace(/^\|\s*/, "");
    return [`export type ${declaration.name.text} = ${type}`];
  }
  if (ts.isClassDeclaration(declaration) && declaration.name !== undefined) {
    const name = declaration.name.text;
    const heritageText = heritage(declaration);
    const entries = [`export class ${name}${heritageText === "" ? "" : ` ${heritageText}`}`];
    for (const member of declaration.members) {
      const entry = classMember(member);
      if (entry !== undefined) entries.push(`${name} ${entry}`);
    }
    return entries;
  }
  if (ts.isInterfaceDeclaration(declaration)) {
    const heritageText = heritage(declaration);
    const entries = [
      `export interface ${declaration.name.text}${heritageText === "" ? "" : ` ${heritageText}`}`,
    ];
    for (const member of declaration.members) {
      if (ts.isPropertySignature(member) && member.name !== undefined) {
        const readonly = hasModifier(member, ts.SyntaxKind.ReadonlyKeyword) ? "readonly " : "";
        const optional = member.questionToken === undefined ? "" : "?";
        const type = member.type === undefined ? "" : `: ${canonical(member.type)}`;
        entries.push(
          `${declaration.name.text} ${readonly}${member.name.getText()}${optional}${type}`,
        );
      } else if (ts.isMethodSignature(member) && member.name !== undefined) {
        entries.push(
          `${declaration.name.text} ${signature(
            member.name.getText(),
            member.parameters,
            member.type,
            member.typeParameters,
          )}`,
        );
      } else {
        unsupported(member, `interface ${declaration.name.text}`);
      }
    }
    return entries;
  }
  if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name)) {
    const list = declaration.parent;
    const keyword =
      ts.isVariableDeclarationList(list) && (list.flags & ts.NodeFlags.Const) !== 0
        ? "const"
        : "let";
    const type = declaration.type === undefined ? "" : `: ${canonical(declaration.type)}`;
    return [`export ${keyword} ${declaration.name.text}${type}`];
  }
  if (ts.isVariableStatement(declaration)) {
    return declaration.declarationList.declarations.flatMap(declarationEntries);
  }
  return unsupported(declaration, "the exports");
}

function sourceEntries(checker: ts.TypeChecker, sourceFile: ts.SourceFile): string[] {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (moduleSymbol === undefined) return [];
  const entries: string[] = [];
  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    const symbol =
      (exported.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(exported) : exported;
    // Every declaration counts, so each overload of a function is its own entry.
    const declarations = (symbol.declarations ?? []).filter(
      (candidate) => !ts.isExportSpecifier(candidate),
    );
    if (declarations.length === 0)
      unsupported(exported.declarations?.[0] ?? sourceFile, "the exports");
    for (const declaration of declarations) entries.push(...declarationEntries(declaration));
  }
  return entries;
}

export function readLiveSurface(
  sources: readonly PackageSource[] = PACKAGES,
  root = process.cwd(),
): Surface {
  const paths = sources.map((source) => resolve(root, source.entry));
  const program = ts.createProgram(paths, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    skipLibCheck: true,
    noEmit: true,
  });
  const checker = program.getTypeChecker();
  const surface: Surface = {};
  for (const [index, source] of sources.entries()) {
    const path = paths[index] as string;
    const sourceFile =
      program.getSourceFile(path) ??
      program.getSourceFiles().find((candidate) => resolve(candidate.fileName) === path);
    if (sourceFile === undefined) throw new Error(`cannot read ${source.entry}`);
    surface[source.name] = [...new Set(sourceEntries(checker, sourceFile))].sort();
  }
  return surface;
}

// The docs/API.md fences are parsed as TypeScript rather than matched line by line. A paragraph
// that names an export without a declaration produces no entry.
export function readDocumentedSurface(markdown: string): Surface {
  const surface: Surface = {};
  const blockPattern = /^```ts\r?\n([\s\S]*?)^```$/gm;
  for (const match of markdown.matchAll(blockPattern)) {
    const code = match[1] ?? "";
    const name = /^\/\/ "(@nepdate\/(?:core|patro))"/m.exec(code)?.[1];
    if (name === undefined) continue;
    const sourceFile = ts.createSourceFile(`${name}.d.ts`, code, ts.ScriptTarget.ES2022, true);
    const entries: string[] = [];
    for (const statement of sourceFile.statements) {
      if (isExported(statement)) entries.push(...declarationEntries(statement));
    }
    surface[name] = [...new Set([...(surface[name] ?? []), ...entries])].sort();
  }
  return surface;
}

function difference(left: ReadonlySet<string>, right: ReadonlySet<string>): string[] {
  return [...left].filter((item) => !right.has(item)).sort();
}

// Snapshot and live surface must be equal. A documented addition still fails here until the
// snapshot is written, which is the point of the committed contract.
export function staleSnapshotErrors(live: Surface, snapshot: Surface): string[] {
  const errors: string[] = [];
  const packages = [...new Set([...Object.keys(live), ...Object.keys(snapshot)])].sort();
  for (const name of packages) {
    const liveSet = new Set(live[name] ?? []);
    const snapshotSet = new Set(snapshot[name] ?? []);
    const missing = difference(liveSet, snapshotSet);
    const extra = difference(snapshotSet, liveSet);
    if (missing.length === 0 && extra.length === 0) continue;
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing ${missing.join(", ")}`);
    if (extra.length > 0) parts.push(`stale ${extra.join(", ")}`);
    errors.push(
      `docs/api-snapshot.json is out of date for ${name}: ${parts.join("; ")}. Run node scripts/api-check.ts --write.`,
    );
  }
  return errors;
}

// Every live item needs its declaration signature in docs/API.md, and every documented item needs
// a live counterpart. Names that appear only in prose are not in this set.
export function documentedErrors(live: Surface, documented: Surface): string[] {
  const errors: string[] = [];
  const packages = [...new Set([...Object.keys(live), ...Object.keys(documented)])].sort();
  for (const name of packages) {
    const liveSet = new Set(live[name] ?? []);
    const documentedSet = new Set(documented[name] ?? []);
    for (const item of difference(liveSet, documentedSet)) {
      errors.push(`docs/API.md has no declaration for ${name}: ${item}`);
    }
    for (const item of difference(documentedSet, liveSet)) {
      errors.push(`docs/API.md declares an item that is not in ${name}: ${item}`);
    }
  }
  return errors;
}

export function snapshotText(surface: Surface): string {
  const packages: Surface = {};
  for (const name of Object.keys(surface).sort()) {
    packages[name] = [...new Set(surface[name] ?? [])].sort();
  }
  const snapshot: Snapshot = { format: SNAPSHOT_FORMAT, packages };
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function readSnapshot(text: string): Surface {
  const parsed = JSON.parse(text) as { format?: unknown; packages?: unknown };
  if (
    parsed.format !== SNAPSHOT_FORMAT ||
    typeof parsed.packages !== "object" ||
    parsed.packages === null
  ) {
    throw new Error(
      "docs/api-snapshot.json has an unknown format; run node scripts/api-check.ts --write",
    );
  }
  const surface: Surface = {};
  for (const [name, entries] of Object.entries(parsed.packages)) {
    if (!Array.isArray(entries) || entries.some((entry) => typeof entry !== "string")) {
      throw new Error(
        `docs/api-snapshot.json has an invalid ${name} entry; run node scripts/api-check.ts --write`,
      );
    }
    surface[name] = entries as string[];
  }
  return surface;
}

export function entryCount(surface: Surface): number {
  return Object.values(surface).reduce((sum, entries) => sum + entries.length, 0);
}
