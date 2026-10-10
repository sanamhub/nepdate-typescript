# Progress

One row per task (handover §3 step 7). The commit column names the task's own commit; the hash
is filled in by the next commit.

| Task | Status | Commit | CI last line | Notes and open questions |
|---|---|---|---|---|
| T0-01 | done | efcae6d | n/a (CI script comes in T0-03) | `npm run build` writes both `dist/index.js`; `import('nepdate-patro')` resolves the workspace; the core tarball lists `LICENSE`, `NOTICE`, `README.md`, `dist/index.js`. npm 12 blocks esbuild's postinstall; esbuild 0.28.2 runs without it |
| T0-02 | done | | n/a (CI script comes in T0-03) | two runs give identical bytes; `--check` exits 1 and names `calendar.gen.ts` after a one-character edit; output passes `biome ci` |
