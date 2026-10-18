# T9: Oldest Node, public API snapshot, runnable examples

Branch `feat/T9-api-minnode` from `67a7627` (T8 merged after review). Read first: the T8 review
row in `docs/plan/PROGRESS.md`, ADR-0007, `docs/mutation/equivalent.md`, ADR-0001, ADR-0004,
`docs/API.md`, `scripts/ci.ts` and `scripts/docs-check.ts`.

T8 closed the mutation gaps and left the benchmark work parked. This phase tests the runtime floor
that both packages promise, freezes the public TypeScript surface in a committed snapshot, and makes
every public example runnable. No package API or behaviour changes. Mutation testing and benchmarks
are not run: the machine is shared and loaded, and the reviewer runs quiet benchmark passes.

## T9-00 Plan

- Add this file, the T9 roadmap row and the PROGRESS rows.
- Every task below has acceptance criteria that a command, a test or the checkpoint can check.

AC:
- The roadmap has a T9 row pointing here.
- PROGRESS has rows for the plan, every task and the checkpoint.

## T9-01 Oldest Node

- Install Node 22.12.0, the exact floor in both `engines.node` fields, under
  `D:\devcache\t9\node22`; keep its npm cache under `D:\devcache\t9\npm`. Nothing goes under `C:`.
- With that Node and npm, run `npm ci`, build both packages, run both test suites and run the packed
  smoke from `scripts/smoke.ts` in both modes. The packages are installed from local tarballs only.
- Move the pack, clean-project install and smoke steps out of gate 11 into
  `scripts/packed-smoke.ts`, so gate 11, the new CI job and the local Node 22.12 run use one path.
  The generated example files become `.mjs`, because the README examples are plain JavaScript and
  Node 22.12 cannot run `.ts` or `.mts` without a flag.
- Add an `oldest-node` job to `.github/workflows/ci.yml`: `ubuntu-latest`, Node `22.12.0`, the
  SHA-pinned `checkout` and `setup-node` actions already used by the file, `contents: read`, and
  only the tests, build and packed smoke. It does not run `npm run ci`, because the repo scripts
  need TypeScript stripping that Node 22.12 only has behind `--experimental-strip-types`.
- README states the supported Node range as 22.12 and later, and names 22.12.0 as the tested floor.
- If Node 22.12.0 fails: fix the code, or raise `engines.node` to the oldest passing version in a
  new ADR. Do not edit an old ADR.
- ADR-0009 records the floor job, the `--experimental-strip-types` boundary, and why development
  and the main CI matrix stay on Node 24.

AC:
- `D:\devcache\t9\node22\node.exe --version` prints `v22.12.0`, and its npm runs `npm ci` with the
  cache on `D:`.
- Under Node 22.12.0, `npm test -w nepdate` and `npm test -w nepdate-patro` pass with the same test
  counts as Node 24 apart from skips that the run prints.
- Under Node 22.12.0, `scripts/packed-smoke.ts` packs both packages, installs them offline in clean
  projects and passes both `scripts/smoke.ts` modes.
- `ci.yml` has an `oldest-node` job pinned to `22.12.0` that runs the tests and the packed smoke,
  with `contents: read` and SHA-pinned actions.
- README states 22.12 and later and names 22.12.0 as the tested floor.
- ADR-0009 records the job and the TypeScript-stripping boundary. The packages' public API and
  behaviour are unchanged.

## T9-02 API snapshot gate

- Add `scripts/api-surface.ts` and `scripts/api-check.ts`. The surface reader uses the TypeScript
  compiler API on `packages/nepdate/dist/index.d.ts` and
  `packages/nepdate-patro/dist/index.d.ts`, follows re-export aliases, and records:
  - exported functions and their signatures;
  - exported classes, their heritage, and every public static or instance member (properties,
    getters, methods, constructors);
  - exported interfaces with their members;
  - exported type aliases, including enum-like unions.
- The snapshot is `docs/api-snapshot.json`, with the packages in a fixed order and every entry
  sorted. The default run compares the live surface with the snapshot exactly. Any difference fails,
  and the message names `node scripts/api-check.ts --write` as the only update path. A documented
  addition with a stale snapshot still fails before the docs check runs.
- `scripts/api-check.ts --write` rewrites the snapshot and then checks it again. A second `--write`
  leaves the file byte for byte unchanged.
- The same check parses the TypeScript fences in `docs/API.md` into the same canonical entries and
  requires the documented set to equal the snapshot. Every snapshot item must have its declaration
  signature in `docs/API.md`; a name that appears only in prose does not satisfy the check, and a
  stale declaration fails. Add the missing public declarations (`NepDateError.name` and its
  constructor, and the `readonly` modifiers in `short` and `long` options) to `docs/API.md`.
- Add gate 12 to `scripts/ci.ts`, named `public api snapshot`, after the docs gate. Gate 10 already
  checks README blocks, declaration comments and prose, so the signature and snapshot check gets
  its own numbered gate.
- Add `scripts/api-surface.test.ts` with negative controls: a renamed export, a changed signature,
  an undocumented addition, a documented addition with a stale snapshot, and a name only in prose.
  Add it to the gate 9 Node test list.
- ADR-0010 records the snapshot format, the exact-match rule, the `--write` rule and gate 12.

AC:
- `node scripts/api-check.ts` passes on the committed snapshot and `docs/API.md`; it also passes
  when the snapshot is byte-for-byte the one `--write` produces.
- The snapshot contains both packages and every public export and member; its size is printed and
  recorded in PROGRESS.
- `node scripts/api-check.ts --write` is idempotent.
- A renamed export, a changed signature, an undocumented addition, a documented addition with a
  stale snapshot and a name only in prose each fail with the expected message; the unit test covers
  all five.
- `node --test scripts/api-surface.test.ts` passes in gate 9.
- `npm run ci` runs gate 12 and ends with `ci: 12/12 gates passed`.
- ADR-0010 records the gate and the update rule.

## T9-03 Runnable examples

- Every exported function, class and static factory in `docs/API.md` has at least one `@example` in
  its TSDoc. Static factories are the static methods that return their class, including
  `NepaliDate.tryParse` (a nullable return). `NepaliDate.compare`, properties and the class
  constructors are not factories.
- Extend the docs gate to find each public declaration's `@example` from the built declarations,
  run each example against the built packages, and compare every `// =>` result with
  `node:util.isDeepStrictEqual`. An example with no `// =>` result does not count unless it is on
  the commented allow-list.
- The allow-list is in `scripts/examples.ts`, keyed by declaration label, with one comment per
  entry. It starts with `NepaliDate.today`, because the clock makes the result non-deterministic.
  No other declaration may be allow-listed without a comment and a test update.
- Examples use values from `shared/data/patro` for `info`, `coverage` and `publicHolidays`; no
  invented event or tithi value.
- Fix the existing examples that have prose results or no result (`// "Jestha"` becomes
  `// => "Jestha"`, the `DateRange` loop gets a scalar result, and so on), and add examples for the
  static factories and the public functions that have none.
- Add `scripts/examples.test.ts` with negative controls: a new export without an example fails, an
  example with a wrong `// =>` value fails, and an example with no result comment does not count.
  Add it to the gate 9 Node test list.
- ADR-0010 records the `// =>` rule, the allow-list and the docs-gate extension.

AC:
- The docs gate prints the number of examples run and the number of `// =>` assertions checked, and
  fails when a required declaration has no example with a result.
- Every required label has an example; the allow-list has exactly `NepaliDate.today` and a comment.
- A wrong `// =>` value fails with the declaration label and both values.
- An example with no result comment fails unless allow-listed.
- `node --test scripts/examples.test.ts` passes with all three negative controls.
- The example count before and after the task is recorded in PROGRESS.
- `npm run ci` passes at `ci: 12/12 gates passed`.
- ADR-0010 records the example rule and the allow-list.

## Checkpoint

The implementation agent stops after T9-03. The reviewer checks:

- [ ] Node 22.12.0 runs both test suites and both packed smoke modes, and `oldest-node` is pinned to
      that exact version.
- [ ] Gate 11 and the `oldest-node` job share `scripts/packed-smoke.ts`; it installs local tarballs
      offline only.
- [ ] `docs/api-snapshot.json` is sorted, stable and exactly the live surface; `--write` is the only
      update path.
- [ ] Every snapshot item has its declaration signature in `docs/API.md`, not only a name in prose.
- [ ] Every required function, class and static factory has an example with a real `// =>` result;
      the only allow-list entry is `NepaliDate.today`.
- [ ] The three example negative controls and the five API negative controls fail when they should.
- [ ] Prose follows the writing style; no em dashes and no AI attribution.
- [ ] A fresh clone on `E:\temp` runs `npm ci && npm run ci` and ends with
      `ci: 12/12 gates passed`; the last line is pasted in PROGRESS and the checkpoint report.
- [ ] No benchmark or mutation run, and no tag, publish, remote, setting or secret change.
