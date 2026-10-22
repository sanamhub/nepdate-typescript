# ADR-0014: TypeScript 7 for tsc, the 6.x API for declaration tools

- Status: Accepted
- Date: 2026-10-22
- Deciders: Sanam Pakuwal
- Amends: ADR-0001 §5 ("TypeScript 6.x as the dev dependency")

## Context

TypeScript 7 is the stable release line, with the native compiler. Its npm package has `tsc` but no
classic JS API: the package root exports only the version, and the API lives under
`typescript/unstable/*`. Two scripts use the classic API with a type checker:
`scripts/api-surface.ts` (`createProgram`, `SymbolFlags`, declaration walking) and
`scripts/examples.ts`.

## Decision

- `typescript` is 7.0.2. Every `tsc` call (type checks, both builds, the tools config) uses it.
- The two scripts import the 6.x API from the dev dependency `typescript6`, an npm alias of
  `typescript@6.0.3`. They read the built `.d.ts` files and the docs; they don't compile anything
  that ships.
- When TypeScript publishes a stable API for 7, the scripts move to it and the alias goes.

## Consequences

- The published JavaScript and declarations come from tsc 7. On 2026-10-22 its `dist/` for both
  packages was byte-identical to tsc 6.0.3's.
- Dependabot proposes both lines: `typescript` for the compiler, `typescript6` for the API.
- All 13 CI gates pass on tsc 7, including attw, publint and the API snapshot.
