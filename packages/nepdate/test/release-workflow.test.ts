// The release workflow keeps its permissions, pins, shell inputs and smoke job in the right places.
// This is the TypeScript counterpart of the Python port's test_release_workflow.py (T7-02).

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const WORKFLOW = join(ROOT, ".github", "workflows", "release.yml");
const SHA = /@[0-9a-f]{40}$/;
const EXPRESSION = "${{";

function indent(line: string): number {
  return line.length - line.trimStart().length;
}

function block(lines: readonly string[], start: number): string[] {
  const base = indent(lines[start] as string);
  const result = [lines[start] as string];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== "" && indent(line) <= base) break;
    result.push(line);
  }
  return result;
}

function job(lines: readonly string[], name: string): string[] {
  const index = lines.indexOf(`  ${name}:`);
  return index < 0 ? [] : block(lines, index);
}

function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

export function verifyProblems(text: string): string[] {
  const lines = text.split(/\r?\n/).filter((line) => !line.trimStart().startsWith("#"));
  const found: string[] = [];
  const verify = job(lines, "verify").join("\n");
  if (verify === "") {
    found.push("release workflow must have a verify job");
    return found;
  }
  if (!verify.includes("needs: publish")) found.push("verify must need publish");
  if (!verify.includes("permissions:\n      contents: read")) {
    found.push("verify must set contents: read");
  }
  if (verify.includes("id-token")) found.push("verify must not request id-token");
  if (!verify.includes("runs-on: ubuntu-latest")) found.push("verify must run on ubuntu-latest");
  // biome-ignore lint/suspicious/noTemplateCurlyInString: this is workflow text, not a template.
  if (!verify.includes("VERSION: ${{ needs.publish.outputs.version }}")) {
    found.push("verify must read the publish version");
  }
  if (!verify.includes('"nepdate@$VERSION"') || !verify.includes('"nepdate-patro@$VERSION"')) {
    found.push("verify must install both exact versions");
  }
  if (!verify.includes("SECONDS + 600") || !verify.includes("sleep")) {
    found.push("verify must retry the install for up to 10 minutes");
  }
  if (
    !verify.includes("NepaliDate.of(2081, 2, 15)") ||
    !verify.includes("toGregorian") ||
    !verify.includes("toJSON") ||
    !verify.includes(".long(") ||
    !verify.includes("info(date)")
  ) {
    found.push("verify must run the README quick start and info()");
  }
  if (verify.includes("secrets.")) found.push("verify must not read a secret");
  return found;
}

export function problems(text: string): string[] {
  // A rule must be met by live YAML: a commented-out key or step does not count.
  const lines = text.split(/\r?\n/).filter((line) => !line.trimStart().startsWith("#"));
  const found: string[] = [];

  const permissionsAt = lines.indexOf("permissions:");
  const top = permissionsAt < 0 ? "" : block(lines, permissionsAt).join("\n");
  if (!top.includes("contents: read")) found.push("default permissions must be contents: read");

  for (const [index, line] of lines.entries()) {
    const match = /\brun:\s*(.*)$/.exec(line);
    if (match === null) continue;
    const base = indent(line);
    if ((match[1] as string).includes(EXPRESSION)) {
      found.push(`line ${index + 1}: expression inside run`);
    }
    if ((match[1] as string).trim() === "|") {
      for (const inner of lines.slice(index + 1)) {
        if (inner.trim() !== "" && indent(inner) <= base) break;
        if (inner.includes(EXPRESSION)) {
          found.push(`line ${index + 1}: expression inside run`);
          break;
        }
      }
    }
  }

  for (const [index, line] of lines.entries()) {
    const match = /\buses:\s*(\S+)/.exec(line);
    if (match === null) continue;
    const target = match[1] as string;
    if (!target.startsWith("./") && !SHA.test(target)) {
      found.push(`line ${index + 1}: action is not pinned by SHA`);
    }
  }

  const publish = job(lines, "publish").join("\n");
  if (!publish.includes("environment: production")) {
    found.push("publish must use the production environment");
  }
  if (!publish.includes("contents: write") || !publish.includes("id-token: write")) {
    found.push("publish needs contents: write and id-token: write");
  }
  if (!publish.includes("github.event_name == 'push'") || !publish.includes("refs/tags/v")) {
    found.push("publish must run only on a tag push");
  }
  if (!publish.includes("fetch-depth: 0")) {
    found.push("publish checkout must fetch full history");
  }
  if (!publish.includes("git fetch --no-tags origin main")) {
    found.push("publish must fetch origin/main");
  }
  // biome-ignore lint/suspicious/noTemplateCurlyInString: this is workflow text, not a template.
  if (!publish.includes("COMMIT_SHA: ${{ github.sha }}")) {
    found.push("publish must pass github.sha through env");
  }
  const mainCheck = publish.indexOf("merge-base --is-ancestor");
  const firstPublish = publish.indexOf("npm publish");
  if (mainCheck < 0) {
    found.push("publish must verify the tag is on origin/main");
  } else if (firstPublish >= 0 && mainCheck > firstPublish) {
    found.push("publish must check main before publishing");
  }
  // biome-ignore lint/suspicious/noTemplateCurlyInString: this is workflow text, not a template.
  if (count(publish, "NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}") < 2) {
    found.push("both publish steps need NODE_AUTH_TOKEN");
  }
  if (count(publish, "unset NODE_AUTH_TOKEN") < 2) {
    found.push("both publish steps must unset an empty NODE_AUTH_TOKEN");
  }
  const needs = /needs:\s*\[(.*?)\]/.exec(publish);
  if (
    needs === null ||
    !needs[1]?.includes("pack") ||
    !needs[1]?.includes("smoke") ||
    !needs[1]?.includes("mutation")
  ) {
    found.push("publish must need pack, smoke and mutation");
  }
  if (publish.includes("npm pack")) {
    found.push("publish must not rebuild the tarballs");
  }
  const checksumAt = publish.indexOf("sha256sum -c SHA256SUMS");
  if (checksumAt < 0) {
    found.push("publish must verify the tarball checksums before publishing");
  } else if (firstPublish >= 0 && checksumAt > firstPublish) {
    found.push("publish must verify the tarball checksums before publishing");
  }

  const pack = job(lines, "pack").join("\n");
  if (!pack.includes("scripts/tarball-check.ts") || !pack.includes("--sums")) {
    found.push("pack must check the tarball contents and write SHA256SUMS");
  }
  if (!pack.includes("path: release-tarballs/") || !pack.includes("name: release-tarballs")) {
    found.push("pack must upload the tarballs and SHA256SUMS");
  }

  const mutation = job(lines, "mutation").join("\n");
  if (mutation === "") {
    found.push("release workflow must have a mutation job");
  } else {
    if (!mutation.includes("needs: pack")) found.push("mutation must need pack");
    if (mutation.includes("environment:")) found.push("mutation must not use an environment");
    if (mutation.includes("secrets.")) found.push("mutation must not read a secret");
    if (!mutation.includes("npm run mutation:force")) {
      found.push("mutation must run the mutation suite");
    }
    if (!mutation.includes("npm run mutation:check")) {
      found.push("mutation must check the floor and equivalents");
    }
  }

  const smoke = job(lines, "smoke").join("\n");
  if (smoke === "") {
    found.push("release workflow must have a smoke job");
  } else {
    if (!smoke.includes("needs: pack")) found.push("smoke must need pack");
    if (smoke.includes("environment:")) found.push("smoke must not use an environment");
    if (smoke.includes("secrets.")) found.push("smoke must not read a secret");
    if (!smoke.includes("actions/download-artifact")) {
      found.push("smoke must download the packed tarballs");
    }
    if (!smoke.includes("--mode core") || !smoke.includes("--mode patro")) {
      found.push("smoke must run both README examples");
    }
    if (!smoke.includes("nepdate-patro")) {
      found.push("smoke must install the patro tarball");
    }
    if (!smoke.includes("scripts/smoke.ts")) {
      found.push("smoke must use scripts/smoke.ts");
    }
  }
  if (!/^\s{2}pack:/m.test(text)) found.push("release workflow must have a pack job");
  found.push(...verifyProblems(text));
  return found;
}

const SHIPPED = readFileSync(WORKFLOW, "utf8");

describe("release workflow", () => {
  it("satisfies every rule", () => {
    expect(problems(SHIPPED)).toEqual([]);
  });

  it("reports a missing main check", () => {
    const withoutCheck = SHIPPED.replace(/^.*merge-base --is-ancestor.*$/gm, "");
    expect(problems(withoutCheck)).toContain("publish must verify the tag is on origin/main");
  });

  it("does not accept a rule that is only met inside a comment", () => {
    const commented = SHIPPED.replace(/^(\s*)fetch-depth: 0$/m, "$1# fetch-depth: 0");
    expect(commented).not.toEqual(SHIPPED);
    expect(problems(commented)).toContain("publish checkout must fetch full history");
  });

  it("reports a missing mutation job", () => {
    const without = SHIPPED.replace(/^ {2}mutation:[\s\S]*?^ {2}publish:/m, "  publish:");
    expect(without).not.toEqual(SHIPPED);
    expect(problems(without)).toContain("release workflow must have a mutation job");
  });

  it("reports every other rule in one negative example", () => {
    const bad = `on:
  workflow_dispatch:
permissions:
  contents: write
jobs:
  pack:
    outputs:
      version: \${{ steps.version.outputs.version }}
  smoke:
    needs: build
    environment: production
    env:
      TOKEN: \${{ secrets.NPM_TOKEN }}
    permissions:
      contents: read
  mutation:
    environment: production
    env:
      TOKEN: \${{ secrets.NPM_TOKEN }}
    steps:
      - run: npm ci
  publish:
    if: github.event_name == 'workflow_dispatch'
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v7
      - run: echo "\${{ inputs.version }}"
      - run: npm publish
      - run: git fetch --no-tags origin main && git merge-base --is-ancestor "$COMMIT_SHA" origin/main
`;
    const found = problems(bad);
    for (const message of [
      "default permissions",
      "not pinned",
      "expression inside run",
      "tag push",
      "check main before publishing",
      "fetch full history",
      "pass github.sha",
      "NODE_AUTH_TOKEN",
      "unset an empty",
      "need pack, smoke and mutation",
      "mutation must need pack",
      "mutation must not use an environment",
      "mutation must not read a secret",
      "run the mutation suite",
      "check the floor and equivalents",
      "smoke must need pack",
      "smoke must not use an environment",
      "smoke must not read a secret",
      "download the packed tarballs",
      "both README examples",
      "install the patro tarball",
      "use scripts/smoke.ts",
      "check the tarball contents",
      "upload the tarballs",
      "verify job",
    ]) {
      expect(
        found.some((candidate) => candidate.includes(message)),
        message,
      ).toBe(true);
    }
  });

  it("reports a missing tarball check", () => {
    const without = SHIPPED.replace(/^.*scripts\/tarball-check\.ts.*$/gm, "");
    expect(without).not.toEqual(SHIPPED);
    expect(problems(without)).toContain(
      "pack must check the tarball contents and write SHA256SUMS",
    );
  });

  it("reports a publish job that rebuilds the tarballs", () => {
    const rebuilt = SHIPPED.replace(
      "      - name: Verify the checked tarballs",
      "      - name: Rebuild\n        run: npm pack -w nepdate\n      - name: Verify the checked tarballs",
    );
    expect(rebuilt).not.toEqual(SHIPPED);
    expect(problems(rebuilt)).toContain("publish must not rebuild the tarballs");
  });

  it("reports a missing verify job", () => {
    const without = SHIPPED.replace(/^ {2}verify:[\s\S]*$/m, "");
    expect(without).not.toEqual(SHIPPED);
    expect(problems(without)).toContain("release workflow must have a verify job");
  });

  it("reports a verify job with the wrong needs", () => {
    const wrong = SHIPPED.replace("  verify:\n    needs: publish", "  verify:\n    needs: pack");
    expect(wrong).not.toEqual(SHIPPED);
    expect(problems(wrong)).toContain("verify must need publish");
  });

  it("reports an id-token permission on verify", () => {
    const start = SHIPPED.indexOf("  verify:");
    const block = SHIPPED.slice(start).replace(
      "    permissions:\n      contents: read",
      "    permissions:\n      contents: read\n      id-token: write",
    );
    const bad = SHIPPED.slice(0, start) + block;
    expect(bad).not.toEqual(SHIPPED);
    expect(problems(bad)).toContain("verify must not request id-token");
  });
});
