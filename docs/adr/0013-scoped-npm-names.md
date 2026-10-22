# ADR-0013: Scoped npm names

- Status: Accepted
- Date: 2026-10-22
- Deciders: Sanam Pakuwal
- Amends: the package names in ADR-0001 and ADR-0005

## Context

ADR-0001 named the packages `nepdate` and `nepdate-patro`. On 2026-10-07 the registry had neither
name. The first 0.1.0-beta.1 publish (run 39754182889) was refused with "403 Forbidden: Package name
too similar to existing package nep-date". npm's similarity check ignores punctuation, so no
unscoped `nepdate` is possible. Nothing was published.

## Decision

The packages are published under the `nepdate` npm organization:

| Package | Was | npm name | Tarball |
|---|---|---|---|
| Core | `nepdate` | `@nepdate/core` | `nepdate-core-X.Y.Z.tgz` |
| Patro | `nepdate-patro` | `@nepdate/patro` | `nepdate-patro-X.Y.Z.tgz` |

The patro's peer dependency is `"@nepdate/core": "~X.Y.Z"`. The workspace directories stay
`packages/nepdate` and `packages/nepdate-patro`. Benchmark row labels and mutation report labels
keep the short names, because they name the implementation, not the npm package.

## Consequences

- Imports change to `from "@nepdate/core"` and `from "@nepdate/patro"`. No version was ever
  published under the old names, so no user has to migrate.
- A scope needs `--access public` on the first publish, which the release workflow already passes.
- The org keeps both names under one owner, and later packages can join it without another name
  check.
- The other ports keep their registry names (crates.io `nepdate`, PyPI `nepdate-core`, Maven
  `io.github.sanamhub:nepdate`). The hub's Packages table lists each.
