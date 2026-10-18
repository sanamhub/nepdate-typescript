# ADR-0010: Public API snapshot and runnable examples

- Status: Accepted
- Date: 2026-10-18
- Deciders: Sanam Pakuwal

## Context

`docs/API.md` is the contract, but nothing compared it with the built declarations. A renamed
parameter, a changed return type or a new class member could ship while the contract still showed
the old text. The docs gate checked that every declaration had a comment, not that the comment or
the signature was still true. The same gap applied to TSDoc examples: several existed, but nothing
ran them, and some had prose results or no result at all.

Two checks close the gap. One freezes the public TypeScript surface in a committed snapshot and
compares the contract's declarations with it. The other runs every public example and compares each
`// =>` result with the real value. Neither changes the packages' API or behaviour.

## Decision

### Public API snapshot

1. **Read the built entry points.** `scripts/api-surface.ts` uses the TypeScript compiler API on
   `packages/nepdate/dist/index.d.ts` and `packages/nepdate-patro/dist/index.d.ts`. It follows the
   re-export aliases to the declaration files and records:
   - exported functions and their signatures;
   - exported classes, their `extends` and `implements` clauses, and every public static or instance
     member (properties, getters, methods, constructors);
   - exported interfaces and their members;
   - exported type aliases, including enum-like unions.

   Private and protected members, `#private` fields and private constructors are not public surface
   and are left out. A class member is qualified with its class, for example
   `NepaliDate static of(...): NepaliDate` or `DateDiff readonly days: number`, so two classes with
   the same member name cannot collapse into one snapshot line.

2. **The snapshot is a sorted JSON document.** `docs/api-snapshot.json` has `format: 1` and a
   `packages` object with the packages in name order. Each package's entries are deduplicated and
   sorted. `node scripts/api-check.ts --write` is the only writer; a second write leaves the file
   byte for byte unchanged.

3. **The live surface must equal the snapshot exactly.** The default `node scripts/api-check.ts`
   compares the two sets and fails on a missing or extra entry. The message says to run
   `--write`. This also holds when a new export is already documented: the snapshot is the
   committed review artifact, so it must change in the same commit.

4. **`docs/API.md` is parsed as TypeScript, not as prose.** The checker parses every `ts` fence that
   starts with `// "nepdate"` or `// "nepdate-patro"`, builds the same canonical entries from the
   declarations, and requires exact equality with the live surface in both directions. A name that
   appears only in a paragraph is not a declaration. A stale signature fails. `--write` checks the
   contract before writing, so an undocumented export cannot be frozen by accident.

5. **Gate 12.** `scripts/ci.ts` adds `public api snapshot` after the packed smoke. Gate 10 already
   checks README blocks, declaration comments and prose; the snapshot needs the built `dist/` trees
   and a separate committed artifact, so it gets its own numbered gate. `scripts/api-surface.test.ts`
   is in the gate 9 Node test list and covers a rename, a signature change, an undocumented
   addition, a documented addition with a stale snapshot, and a name only in prose.

### Runnable examples

6. **The required set comes from the contract.** Every exported function, class and static factory
   in `docs/API.md` needs at least one `@example`. A static factory is a static method whose return
   type names its class, including a nullable return such as `NepaliDate.tryParse`. `compare`,
   properties and instance methods are not factories, but an `@example` on any of them is still
   run when present.

7. **Every `@example` is executed.** The docs gate reads the TSDoc tags from the built declarations,
   writes one `.mjs` file per example, imports the built packages, and runs it in a child process.
   Each line with `// =>` becomes an assertion, and the value is compared with
   `node:util.isDeepStrictEqual`, not stringified. The example file also prints the declaration
   label and both values on a mismatch. An example with no `// =>` line does not count towards the
   required set.

8. **One commented allow-list.** `scripts/examples.ts` exports the only exception:
   `nepdate:NepaliDate.today`, because the clock makes its result non-deterministic. Each entry has
   a reason comment. No other declaration may be allow-listed without changing that file and its
   test. The `today` example still runs; only its result comparison is skipped.

9. **Values come from the hub data.** The examples for `info`, `coverage` and `publicHolidays` use
   days from `shared/data/patro/`, not invented tithi, holiday or event values.

10. **The docs gate reports the counts.** It prints the number of examples run and the number of
    `// =>` assertions checked. A missing required example, a wrong value or an example without a
    result fails the gate. `scripts/examples.test.ts` covers the three negative controls: a new
    export without an example, a wrong `// =>` value, and an example with no result comment.

## Consequences

- A public API change now touches `docs/API.md`, `docs/api-snapshot.json` and the declarations in
  one commit. `--write` makes the snapshot change visible in review.
- `docs/API.md` must remain parseable TypeScript. A method signature with a body would still parse,
  but the file is a declaration list and should not gain implementations.
- Examples are executable documentation. They add a few seconds to gate 10 and cannot use a helper
  that is not imported in the generated file. Type annotations in examples are avoided because the
  generated files are `.mjs`.
- The allow-list is deliberately small. A non-deterministic example is a review question, not a
  silent skip.
