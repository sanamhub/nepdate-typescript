# T12: Parsed tests for every workflow

Branch `feat/T12-workflow-coverage` from `89f5489` (T11 merged after review). Read first: the T11
review row in `docs/plan/PROGRESS.md`, `docs/adr/0004-testing-and-quality-gates.md` §Time zones,
`docs/adr/0009-oldest-node-in-ci.md`, `.github/workflows/*.yml`, `packages/nepdate/test/workflow-yaml.ts`,
`packages/nepdate/test/release-workflow.test.ts` and `packages/nepdate/test/mutation-workflow.test.ts`.

T11 put `release.yml` and `mutation.yml` on the parsed YAML helper. `ci.yml` still has no test, and a
new workflow file can land without a test. This phase gives every workflow a parsed test and puts
the shared pin and expression rules in one place.

The phase changes tests and adds one workflow test file. No workflow behaviour, package, API or
runtime change is planned. A test that finds a real defect stops the phase for a report before the
workflow is edited. No benchmark or mutation job runs.

## T12-00 Plan

AC:
- `docs/plan/T12-workflow-coverage.md` has testable criteria for T12-01, T12-02 and T12-03.
- `docs/plan/00-ROADMAP.md` has a T12 row pointing here.
- `docs/plan/PROGRESS.md` has a T12 plan row, a row per task and a checkpoint row.
- This commit contains only plan and progress documents.

Work:
- Add this file, the roadmap row and the PROGRESS rows, and commit before the code.

## T12-01 CI workflow test

AC:
- `packages/nepdate/test/ci-workflow.test.ts` parses `.github/workflows/ci.yml` with
  `parseWorkflow`.
- The triggers are exactly `push` with `branches: [main]` and `pull_request`. A
  `pull_request_target` or `workflow_run` key fails.
- Workflow permissions are exactly `contents: read`. No job has a `write` permission, an `id-token`
  key or an `environment` key. No value anywhere contains `secrets.`.
- The job set is exactly `ci`, `oldest-node`, `temporal`, `time-zones`, `runtimes`, `browser` and
  `shared-check`.
- The `ci` matrix is exactly `os: [ubuntu-latest, windows-latest, macos-latest]`, `fail-fast` is
  false, and the last `ci` step runs `npm run ci`.
- The `oldest-node` setup-node version equals the lowest `engines.node` floor in
  `packages/nepdate/package.json` and `packages/nepdate-patro/package.json`, compared as a version
  (so `22.12` and `22.12.0` match). A bumped floor fails until the workflow follows.
- The `oldest-node` `NODE_OPTIONS` contains `--experimental-strip-types` and
  `--disable-warning=ExperimentalWarning`, and its build, test and packed-smoke steps appear in that
  order.
- The `temporal` setup-node version is `26`.
- The `time-zones` matrix is exactly the three zones in ADR-0004: `America/Los_Angeles`,
  `Asia/Kathmandu` and `Pacific/Kiritimati`.
- Every job with steps has a positive numeric `timeout-minutes`. The reusable-workflow job has no
  steps of its own, so the called workflow owns its timeout.
- `npx vitest run test/ci-workflow.test.ts --root packages/nepdate --coverage.enabled=false` passes.

Work:
- Add the test with the rules above. Read the job set and versions from the files, not from memory.
- If a rule fails on the real file, stop and report the defect before editing the workflow.

## T12-02 Every workflow file

AC:
- `packages/nepdate/test/workflows.test.ts` discovers every `*.yml` and `*.yaml` file in
  `.github/workflows` with a directory listing. It does not use a hand-written file list.
- One map names the dedicated test file for each workflow. The map has an entry for
  `ci-workflow.test.ts`, `mutation-workflow.test.ts`, `release-workflow.test.ts` and the new
  `shared-sync-workflow.test.ts`. A workflow with no entry fails with its file name, and a map entry
  with no file or no test fails.
- `packages/nepdate/test/shared-sync-workflow.test.ts` parses `shared-sync.yml` and checks its
  triggers, top-level and job permissions, single job, pinned reusable workflow, `with.regenerate`
  and the `SYNC_APP_PRIVATE_KEY` secret reference.
- The generic rules run on every discovered file: every non-local `uses` is a 40-hex pin with a
  non-empty trailing version comment; every `actions/checkout` sets `persist-credentials: false`
  unless its job is in a short commented allow-list; no `${{ }}` appears in a `run` unless the exact
  expression is in a commented allow-list; every workflow has top-level permissions.
- The checkout allow-list is empty with a comment that no job needs persisted credentials. A stale
  entry, a job with no checkout or a checkout that already sets false, fails.
- The run expression allow-list is empty with a comment that every value reaches a run through
  `env`. An entry that does not appear in a run fails.
- `packages/nepdate/test/workflow-rules.ts` owns the pin and expression rules and the checkout and
  top-permission checks. `release-workflow.test.ts` and `mutation-workflow.test.ts` call it instead
  of keeping their own pin and expression loops.
- Every failure message that exists at `89f5489` is still produced with the same text. The message
  strings are extracted before and after and diffed, and the checkpoint says the diff is empty.
- `npx vitest run test/workflows.test.ts test/shared-sync-workflow.test.ts --root packages/nepdate
  --coverage.enabled=false` passes.

Work:
- Add `workflow-rules.ts`, move the pin and expression loops there, and import them from the release
  and mutation tests.
- Add `workflows.test.ts` and `shared-sync-workflow.test.ts`. Keep the map and both allow-lists in
  one place, with a comment on each entry.
- Keep every existing release, mutation and T10 rule. No workflow change unless a rule finds a real
  defect; stop and report before editing.

## T12-03 Negative controls

AC:
- `ci-workflow.test.ts` has controls that edit the real `ci.yml` text in memory:
  - add `pull_request_target`; the trigger rule fails;
  - add `contents: write` to the `ci` job; the permission rule fails;
  - change the `oldest-node` setup-node version to `22.11`; the engine-floor rule fails.
- `workflows.test.ts` has controls that edit the real files or the real maps in memory:
  - add `new.yml` to the discovered file list; the coverage rule fails with `new.yml`;
  - change one pinned `uses` to `@v7`; the pin rule fails;
  - remove one `persist-credentials: false`; the checkout rule fails;
  - put `${{ github.event.pull_request.title }}` in a `run`; the expression rule fails;
  - pass `${{ matrix.os }}` as an allow-list entry when no run contains it; the stale-entry rule
    fails.
- Each matching rule is disabled once. The control fails, then the file returns to its prior
  SHA-256. The checkpoint lists all eight results.
- `npm run ci` passes after the restores.

Work:
- Add the eight controls and run the disable-once check with a temporary script. Do not commit the
  script or any mutated workflow.

## Checkpoint

The implementation agent stops after T12-03. The reviewer checks:

- [ ] Every workflow file has a parsed dedicated test, and the map fails on an unmapped file.
- [ ] `ci-workflow.test.ts` checks the triggers, permissions, job set, matrix, last step, engine
      floor, `NODE_OPTIONS`, step order, temporal version, time zones and timeouts.
- [ ] `workflow-rules.ts` owns the pin and expression rules, and the release and mutation tests call
      it. The message-string diff against `89f5489` is empty.
- [ ] The eight controls fail when their rule is removed, and each restored file matches its prior
      SHA-256.
- [ ] No workflow behaviour, package, API or runtime change. Gate 12 still reports 87 entries.
- [ ] A real `git clone` into `E:\temp\nepdate-t12-check` runs `npm ci && npm run ci`; the last line
      is pasted in PROGRESS and the checkpoint report.
- [ ] No tag, publish, remote, setting or secret change. No benchmark or mutation run.
