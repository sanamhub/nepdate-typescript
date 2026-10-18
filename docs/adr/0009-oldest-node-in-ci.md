# ADR-0009: Test the oldest supported Node

- Status: Accepted
- Date: 2026-10-18
- Deciders: Sanam Pakuwal

## Context

Both packages declare `"engines": { "node": ">=22.12" }` (ADR-0001 §3), but the CI matrix tested
Node 24, and the `runtimes` job only imported both packages on Node 22.12. A successful import does
not exercise conversion, parsing, formatting, the patro data or the packed tarballs. The floor could
break without a red job.

Node 22.12 does not strip TypeScript types by default. That arrived in Node 22.18, which is why the
development scripts, `npm run ci` included, run on Node 24 (ADR-0001 §9). The tests also spawn
`node scripts/release-check.ts` and `node scripts/release-version.ts`, so the Node 22.12 job needs
the `--experimental-strip-types` flag for the test process and its children. The flag is a tooling
need, not a package runtime need: the shipped files are JavaScript.

## Decision

1. **Add an `oldest-node` job.** It runs on `ubuntu-latest`, installs Node `22.12.0` (the exact
   floor, not a floating `22` or `22.12`), and runs `npm ci`, `npm run build`, `npm test` and
   `node scripts/packed-smoke.ts`. It does not run `npm run ci`: the gate script needs TypeScript
   stripping for every script it spawns, and the main matrix already runs every gate on Node 24.
   The job has `permissions: contents: read`, and its `checkout` and `setup-node` actions are the
   same SHA-pinned versions as the rest of the file.

2. **Set `NODE_OPTIONS` for the job.** The job exports
   `--experimental-strip-types --disable-warning=ExperimentalWarning`. `npm test` runs both suites;
   the core test suite spawns the release scripts, and those child processes inherit the flag.
   The warning is disabled because every Vitest worker would otherwise print it. Tests still run
   on Node 22.12, not on a newer runtime.

3. **Build before test.** `nepdate-patro` tests import the `nepdate` package name, which resolves
   through the workspace to `packages/nepdate/dist/`. A fresh clone has no `dist/`, so the job
   builds both packages before `npm test`. The main CI gets the same order from gates 5 and 9.

4. **Keep one packed-smoke path.** The pack, clean-project install and both `scripts/smoke.ts` modes
   move from gate 11 into `scripts/packed-smoke.ts`. Gate 11 and the `oldest-node` job call the same
   script. The generated example files are `.mjs`, so Node 22.12 runs the README examples without a
   flag; `packed-smoke.ts` adds the flag only when it starts `smoke.ts` on a Node without default
   stripping.

5. **Leave the engine range alone.** Node 22.12.0 passes both test suites and both smoke modes, so
   `engines.node` stays `>=22.12`. The floor is now tested, and the README says `Node 22.12.0 and
   later`. If a future dependency or runtime API raises the floor, `engines.node` and a new ADR must
   change together.

## Consequences

- A pull request now runs one more job, about the length of one test pass plus a packed install.
- The `npm ci` on Node 22.12 prints `EBADENGINE` warnings from development-only packages (Babel 8
  and `@inquirer`, pulled in by test and mutation tooling) whose own floor is Node 22.18. They do
  not run in the shipped packages and do not fail the job. The package runtime is what this job
  tests.
- `npm run ci` remains a Node 24 command. The README and this ADR do not claim that contributors can
  run the gate script on 22.12 without the flag.
- The `runtimes` job still imports both built packages on Node 22.12, Deno, Bun and Node 24. It
  covers the runtimes that have no full test job.
