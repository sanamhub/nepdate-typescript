# ADR-0020: The patro requires exactly the same core version

- Status: Accepted
- Date: 2026-11-17
- Deciders: Sanam Pakuwal
- Amends: ADR-0001 §1 and ADR-0005 (the `~X.Y.Z` peer range)

## Context

`nepdate-core` and `nepdate-patro` are released together under one version, and the patro reads
internals of the core that are not part of the public API. ADR-0001 let the patro accept any patch
of the same minor (`~X.Y.Z`). A newer patch of the core could then run against an older patro, a
pair that was never tested. The other SDKs already pin their patro package to the exact core
version.

## Decision

1. `nepdate-patro` keeps `nepdate-core` as a peer dependency, so an app has one shared copy of the
   core, and the peer is the exact version: `"nepdate-core": "X.Y.Z"`.
2. `scripts/version.ts`, which feeds the CI `version` job, fails when the patro peer differs from the
   core version.
3. `scripts/release-check.ts` and `scripts/tarball-check.ts` expect the exact version in the
   manifest and in the packed tarball.
4. The picker keeps its own version line and its own peer range (ADR-0018). This ADR does not
   change it.

## Consequences

- A version bump must change the patro peer in the same commit as both `version` fields. CI fails
  until it does.
- An app that upgrades `nepdate-core` must upgrade `nepdate-patro` to the same version. npm reports
  the conflict as a peer dependency error.
