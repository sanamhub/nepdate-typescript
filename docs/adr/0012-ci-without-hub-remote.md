# ADR-0012: CI without the hub remote

- Status: Accepted
- Date: 2026-10-21
- Deciders: Sanam Pakuwal
- Supersedes: the reusable-workflow sentence in ADR-0001 §7 and the weekly `shared-sync` line in
  ADR-0005, until the hub has a GitHub remote

## Context

ADR-0001 §7 has CI call the hub's reusable `shared-check` workflow, and ADR-0005 has a weekly
`shared-sync` workflow. Both are `uses: sanamhub/nepdate/.github/workflows/...`, and the hub has no
GitHub remote yet. GitHub fails a workflow at startup when a reusable workflow cannot resolve, so
`ci.yml` would run no job on the first push and `shared-sync` would never run.

The hub's `tools/shared_sync.py` can check a spoke's `shared/` against a local hub checkout, but a
GitHub runner does not have that checkout. Removing the reusable job without a replacement would
leave the vendored data unguarded.

## Decision

1. **Shared check from a vendored manifest.** `scripts/shared.sha256` lists every file under
   `shared/data` and `shared/spec` with its SHA-256, under a `# hub <sha>` line. The line must equal
   `shared/VERSION`. `node scripts/shared-sums.ts` compares the manifest with the tree and is gate 1
   of `npm run ci`.
2. **Sums are written only after the hub check.** `node scripts/shared-sums.ts --write <hub>`
   runs the hub's `tools/shared_sync.py . --check` first and writes `scripts/shared.sha256` only
   when it passes. Syncing stays local: run the hub tool, run `--write`, then `npm run codegen`.
3. **No `shared-check` job.** `ci.yml` has no reusable-workflow job. The local gate covers the same
   files.
4. **No `shared-sync` workflow.** The file is deleted rather than kept failing every week. The
   local commands in decision 2 replace it.
5. **The reusable workflows return in a new ADR.** When the hub is on GitHub, a later ADR restores
   `shared-check` and `shared-sync` with pinned commits, and the manifest goes.

## Consequences

- CI runs every job on a push or pull request again.
- The manifest check is weaker than the hub's: it proves `shared/` has not changed since the
  manifest was written for `shared/VERSION`, not that it equals the hub. A hand-edited `shared/`
  with a hand-written manifest would pass; review of a manifest change without a `VERSION` change
  catches it.
- The weekly sync no longer runs by itself. The maintainer syncs from a hub checkout, as before the
  hub has a remote.
