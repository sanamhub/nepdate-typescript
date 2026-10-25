# ADR-0004: Testing and quality gates

- Status: Accepted
- Date: 2026-09-25
- Updated: 2026-10-07 (hub ADR-0004: separate gates for `nepdate` and `nepdate-patro`)
- Deciders: Sanam Pakuwal

## Decision

`npm run ci` (`node scripts/ci.ts`, from the repository root) runs these gates in order, stopping
at the first failure. The core gates (3 to 6) run before anything in `nepdate-patro` is built, so
the core builds and tests on its own.

| # | Gate | Command or check |
|---|---|---|
| 1 | lint + format | `biome ci .` |
| 2 | generated code | `node scripts/codegen.ts --check` |
| 3 | core types | `tsc -p packages/nepdate/tsconfig.json` (`noEmit`, ADR-0001 §5) |
| 4 | core tests | `npm test -w nepdate` (`vitest run --coverage`, v8 provider, ≥ 90 % lines of `packages/nepdate/src/`; org target 80 %) |
| 5 | core build + shape | `tsc -p packages/nepdate/tsconfig.build.json`, then `publint packages/nepdate` and `attw --pack packages/nepdate --profile esm-only` |
| 6 | core isolation + size | see below |
| 7 | patro types | `tsc -p packages/nepdate-patro/tsconfig.json` (needs the core `dist/` from gate 5) |
| 8 | patro tests | `npm test -w nepdate-patro` (≥ 90 % lines of `packages/nepdate-patro/src/`) |
| 9 | patro build + shape | `tsc -p packages/nepdate-patro/tsconfig.build.json`, `publint packages/nepdate-patro`, `attw --pack packages/nepdate-patro --profile esm-only` |
| 10 | docs | `node scripts/docs-check.ts`: README examples run, every export has a doc comment |

Gate 6 (`scripts/ci.ts` does these itself, no extra tool):
- `packages/nepdate/package.json` has no `nepdate-patro` key in `dependencies`,
  `devDependencies`, `peerDependencies` or `optionalDependencies`.
- No `.js` file under `packages/nepdate/dist/` contains the string `nepdate-patro` (so no import
  of it, static or dynamic).
- `npm pack -w nepdate --pack-destination <temp dir>` produces a tarball; no file in it contains
  the string `World Day Against Human Trafficking` (PORT-PLAN phase 4). The README in the tarball may name
  `nepdate-patro`; it must not contain event names.
- `esbuild packages/nepdate/dist/index.js --bundle --minify --format=esm`, gzipped, is under 8 KB.
  Over the limit: report the measured size to the maintainer; don't drop features to fit.

Tests:
- **Vectors:** every file in `shared/spec/vectors/`, read with `node:fs` from the repository root
  (`shared/spec/vectors/` is three levels above `packages/<name>/test/`).
- **Exhaustive:** every serial 0..=109211 round-trips BS → Gregorian → BS.
- **Time zones:** the edge functions run under `TZ=America/Los_Angeles`, `TZ=Asia/Kathmandu` and
  `TZ=Pacific/Kiritimati` (CI sets `TZ` per job) and give the same core results.
- **Runtimes:** a smoke test imports both built packages in Node 22 and 24, Deno 2 and Bun, and in
  a browser via Vitest browser mode (Chromium).
- **Negative numbers:** `addMonths` with negative `n` and weekday maths across the epoch.

CI: `ubuntu-latest` (all runtimes), `windows-latest` and `macos-latest` (Node 24). Actions pinned by
SHA, `permissions: contents: read`. Benchmarks are not run per PR.
