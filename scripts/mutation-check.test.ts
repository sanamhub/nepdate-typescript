// Tests for the mutation check (T8-04): a passing report, a below-floor report and an untriaged
// survivor. Each case writes a small Stryker-shaped report and runs the CLI.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { equivalentIds } from "./mutation-check.ts";

function mutant(id: string, status: string) {
  return {
    id,
    mutatorName: "LogicalOperator",
    status,
    replacement: "true",
    location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
  };
}

function report(file: string, mutants: ReturnType<typeof mutant>[]) {
  return { files: { [file]: { mutants } } };
}

function run(files: {
  core: ReturnType<typeof report>;
  patro: ReturnType<typeof report>;
  floor: number;
  equivalent: string;
}): { status: number | null; stdout: string; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), "mutation-check-"));
  try {
    const core = join(dir, "core.json");
    const patro = join(dir, "patro.json");
    const floor = join(dir, "floor.json");
    const equivalent = join(dir, "equivalent.md");
    writeFileSync(core, JSON.stringify(files.core));
    writeFileSync(patro, JSON.stringify(files.patro));
    writeFileSync(floor, JSON.stringify({ floor: files.floor }));
    writeFileSync(equivalent, files.equivalent);
    const result = spawnSync(
      process.execPath,
      [
        "scripts/mutation-check.ts",
        "--core",
        core,
        "--patro",
        patro,
        "--floor",
        floor,
        "--equivalent",
        equivalent,
      ],
      { encoding: "utf8" },
    );
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const PASSING = {
  core: report("packages/nepdate/src/a.ts", [
    mutant("1", "Killed"),
    mutant("2", "Killed"),
    mutant("10", "Survived"),
  ]),
  patro: report("packages/nepdate-patro/src/b.ts", [mutant("1", "Killed")]),
  floor: 75,
  equivalent: [
    "| Mutant | Diff | Proof |",
    "|---|---|---|",
    "| `packages/nepdate/src/a.ts#10` | `a` -> `b` | No input reaches this branch. |",
    "",
  ].join("\n"),
};

test("a report at the floor with every survivor listed passes", () => {
  const result = run(PASSING);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /score 75\.00% \(floor 75%\)/);
});

test("a report below the floor exits non-zero", () => {
  const result = run({ ...PASSING, floor: 80 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /below the floor 80%/);
});

test("an untriaged survivor exits non-zero", () => {
  const result = run({ ...PASSING, equivalent: "| Mutant | Diff | Proof |\n|---|---|---|\n" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /1 survivor\(s\) have no equivalent entry/);
  assert.match(result.stderr, /packages\/nepdate\/src\/a\.ts#10/);
});

test("equivalentIds reads table cells and bullets", () => {
  const ids = equivalentIds(
    [
      "| `packages/nepdate/src/a.ts#1` | x | y |",
      "- `packages/nepdate/src/b.ts#2`: proof",
      "| Mutant | Diff | Proof |",
    ].join("\n"),
  );
  assert.deepEqual([...ids].sort(), [
    "packages/nepdate/src/a.ts#1",
    "packages/nepdate/src/b.ts#2",
  ]);
});
