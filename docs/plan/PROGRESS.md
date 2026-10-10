# Progress

One row per task (handover §3 step 7). The commit column names the task's own commit; the hash
is filled in by the next commit.

| Task | Status | Commit | CI last line | Notes and open questions |
|---|---|---|---|---|
| T0-01 | done | efcae6d | n/a (CI script comes in T0-03) | `npm run build` writes both `dist/index.js`; `import('nepdate-patro')` resolves the workspace; the core tarball lists `LICENSE`, `NOTICE`, `README.md`, `dist/index.js`. npm 12 blocks esbuild's postinstall; esbuild 0.28.2 runs without it |
| T0-02 | done | 08aab1e | n/a (CI script comes in T0-03) | two runs give identical bytes; `--check` exits 1 and names `calendar.gen.ts` after a one-character edit; output passes `biome ci` |
| T0-04 | done | 1464693 | n/a (committed before T0-03) | `readVectors` returns 7176 rows for `month-boundaries.csv`; `catalogRows("1")` returns 113 rows. `checkCatalog` also fails on a case whose id matches no row. Open question: the ADRs list no `@types/node`, so `test/node.d.ts` declares the three Node APIs the tests use; swap it for `@types/node` if approved |
| T0-03 | done | | `ci: 9/9 gates passed` | fails at gate 1 on an unformatted file and at gate 6 with `nepdate-patro` in the core `dependencies` (both tried, then reverted). Gate 6 searches the gunzipped tarball for the event string, so it needs no `tar` tool. Core bundle today: 0 B gzip limit check passes |
