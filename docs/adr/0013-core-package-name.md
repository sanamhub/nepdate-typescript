# ADR-0013: The core package is `nepdate-core` on npm

- Status: Accepted
- Date: 2026-10-22
- Deciders: Sanam Pakuwal
- Amends: the core package name in ADR-0001 and ADR-0005

## Context

ADR-0001 named the packages `nepdate` and `nepdate-patro`. On 2026-10-07 the registry had neither
name. The first 0.1.0-beta.1 publish (run 39754182889) was refused with "403 Forbidden: Package name
too similar to existing package nep-date". npm's similarity check ignores punctuation, so no
unscoped `nepdate` is possible. Nothing was published.

A scope would avoid the check, but the npm organization `nepdate` was already taken, and a personal
or unrelated scope says nothing about the project. The Python port had the same problem on PyPI and
publishes `nepdate-core` with `nepdate-patro`.

## Decision

| Package | Was | npm name | Tarball |
|---|---|---|---|
| Core | `nepdate` | `nepdate-core` | `nepdate-core-X.Y.Z.tgz` |
| Patro | `nepdate-patro` | `nepdate-patro` (unchanged) | `nepdate-patro-X.Y.Z.tgz` |

The patro's peer dependency is `"nepdate-core": "~X.Y.Z"`. The workspace directories stay
`packages/nepdate` and `packages/nepdate-patro`. Benchmark row labels and mutation report labels
keep the short name `nepdate`, because they name the implementation, not the npm package.

## Consequences

- The core import is `from "nepdate-core"`. No version was ever published under `nepdate`, so no
  user has to migrate.
- npm and PyPI use the same two names. crates.io and Maven Central keep `nepdate`, and the hub's
  Packages table lists every registry name.
- Both names were free on 2026-10-22, but npm runs its similarity check only at publish. If it
  refuses `nepdate-core` too, the fallback is the owner's existing `snm` scope.
