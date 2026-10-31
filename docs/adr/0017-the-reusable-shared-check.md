# ADR-0017: The reusable shared check, without the manifest

- Status: Accepted
- Date: 2026-10-31
- Deciders: Sanam Pakuwal
- Supersedes: ADR-0012, and restores the `shared-check` half of ADR-0001 §7

## Context

ADR-0012 replaced the hub's reusable `shared-check` workflow with a vendored manifest
(`scripts/shared.sha256`, checked by `scripts/shared-sums.ts` as gate 1 of `npm run ci`) because the
hub had no GitHub remote. The hub is now at `sanamhub/nepdate` on GitHub, so the reusable workflows
resolve and the reason for the local check is gone.

The manifest now gets in the way. `shared/` and `shared/VERSION` change on every hub sync, and the
manifest lists the SHA-256 of every vendored file. A sync pull request from the hub's `shared-sync`
workflow cannot run `node scripts/shared-sums.ts --write <hub>` (that needs a local hub checkout and
Python), so gate 1 fails on exactly the change the sync exists to make, and every sync needs a
person to rewrite the manifest by hand.

The hub workflow compares the vendored tree with the real hub at the commit in `shared/VERSION`,
which is the check this repository wants. The manifest compares the tree with a second file in the
same repository, which proves only that nobody edited `shared/` after the manifest was written.

## Decision

1. **Call the hub's `shared-check`.** `ci.yml` gets a `shared-check` job with
   `permissions: contents: read` that calls the hub's reusable workflow, pinned to commit
   `f94d67c0c85de7909cf54d7e4e96f226ca750129` (main, 2026-10-31). The called workflow fetches the
   hub at the commit in `shared/VERSION` and fails when `shared/data` or `shared/spec` differs. A
   sync pull request therefore passes once its `shared/` and `VERSION` agree, and fails when
   someone edits the vendored files.
2. **Remove the manifest.** Delete `scripts/shared.sha256`, `scripts/shared-sums.ts` and
   `scripts/shared-sums.test.ts`, and drop the `shared tree` gate from `scripts/ci.ts`. The gate
   script now runs 15 gates, and its summary line still counts the list it ran.
3. **Let the sync start CI.** Add `workflow_dispatch:` to the `on:` block of `ci.yml`. The hub's
   `shared-sync` workflow opens its pull request with `GITHUB_TOKEN`, and a pull request opened that
   way does not trigger `pull_request` workflows, so it dispatches CI instead.
4. **Keep the local check.** `py ../nepdate/tools/shared_sync.py . --check` still compares a working
   tree with a local hub checkout. This ADR removes the vendored manifest, not the local tool.

## Consequences

- Every push and pull request runs the hub's check against the hub at the commit in
  `shared/VERSION`, not against a file this repository maintains.
- A sync pull request changes `shared/` and `VERSION` only, so it can pass without hand edits.
- The reusable workflow is pinned to a full hub commit, so a hub change cannot alter this
  repository's check until the pin moves in a reviewed change.
- `npm run ci` has 15 gates; CONTRIBUTING and the release workflow comments name the new numbers.
- No `shared-sync` workflow is added here. A later change adds it against the hub.
