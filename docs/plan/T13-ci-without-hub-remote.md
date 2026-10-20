# T13: CI without the hub remote

Branch `feat/T13-ci-without-hub-remote` from `479ad34` (T12 merged after review). Read first: the
T12 review row in `docs/plan/PROGRESS.md`, ADR-0001 §7, ADR-0004, ADR-0005,
`.github/workflows/*.yml`, `scripts/ci.ts`, `packages/nepdate/test/workflows.test.ts`,
`packages/nepdate/test/ci-workflow.test.ts` and `packages/nepdate/test/workflow-rules.ts`. The
Kotlin port's ADR-0006 solves the same problem with a checksum file, but its paths and commands do
not apply here.

T12 review found that `ci.yml` and `shared-sync.yml` call reusable workflows in `sanamhub/nepdate`,
which has no GitHub remote. GitHub stops a workflow at startup when a reusable workflow does not
resolve, so the first push would run no CI job and the weekly sync would never run. The hub's
`tools/shared_sync.py --check` can verify the copy locally, but it needs a hub checkout, which CI
does not have.

This phase deletes both calls and replaces the shared check with a SHA-256 manifest that needs no
network, as gate 1 of `npm run ci`. ADR-0012 records the decision and the weaker guarantee. The
phase changes scripts, tests, workflows and docs. No package, API or runtime change is planned. No
benchmark or mutation job runs. Creating the remote, pushing, branch protection, the `production`
environment and publishes stay out of scope; they remain T0-05 and T0-06.

## T13-00 Plan

AC:
- `docs/plan/T13-ci-without-hub-remote.md` has testable criteria for T13-01, T13-02 and T13-03.
- `docs/plan/00-ROADMAP.md` has a T13 row pointing here.
- `docs/plan/PROGRESS.md` has a T13 plan row and a pending row for each task and the checkpoint.
- This commit contains only plan and progress documents.

Work:
- Add this file, the roadmap row and the PROGRESS rows, and commit before the code.

## T13-01 Shared checksum gate

AC:
- `scripts/shared.sha256` starts with `# hub ` followed by the trimmed `shared/VERSION`, then one
  line per regular file under `shared/data` and `shared/spec`, sorted by path, in the form
  `<64 lowercase hex><two spaces><path>`. `shared/VERSION` and `__pycache__` are not entries. The
  manifest lists 31 files today.
- `scripts/shared-sums.ts` checks by default:
  - `shared/VERSION` is exactly one full 40-character lowercase hex commit;
  - the manifest header equals that commit;
  - every manifest line is well formed and names a path under `shared/data/` or `shared/spec/`;
  - the manifest paths and the files on disk are the same set;
  - every SHA-256 matches the file bytes.

  It prints every problem, names the path for a missing, extra or changed file, and exits 1. On
  success it prints `shared-sums: shared/ matches hub <sha> (<n> files)` and exits 0.
- Raw bytes are hashed. `.gitattributes` keeps `shared/` at `eol=lf`, so the same tree gives the
  same hash on Windows and Linux.
- `node scripts/shared-sums.ts --write <hub checkout>` runs the hub check first:
  `py <hub>/tools/shared_sync.py . --check` on Windows and `python3 ...` elsewhere, from the
  repository root. A nonzero exit prints the hub output, exits 1 and leaves `scripts/shared.sha256`
  byte-identical. On success it rewrites the manifest from the current `shared/` and prints the
  file count. `SHARED_PYTHON` overrides the interpreter for tests.
- `scripts/shared-sums.test.ts` uses temporary directories to cover a matching tree, a missing
  file, an extra file, one changed byte, a bad header, a bad `VERSION`, a malformed digest, a
  successful write and a refused write. It never writes the real manifest.
- `scripts/ci.ts` adds `shared tree` as gate 1 and runs `node scripts/shared-sums.ts`. The last
  line becomes `ci: 13/13 gates passed`. `scripts/shared-sums.test.ts` is in the `node --test`
  list in gate 9, so `tsconfig.tools.json` type-checks it and the test runs in CI.
- `npm run ci` passes and no file under `shared/` changes.

Work:
- Add the manifest and the checker. Generate the manifest with `--write ../nepdate`, which first
  proves the local copy equals the hub at `shared/VERSION`.
- Add the gate and its tests. Keep the check dependency-free, like the other scripts.

## T13-02 Remove the reusable workflow calls

AC:
- `.github/workflows/ci.yml` has exactly the jobs `browser`, `ci`, `oldest-node`, `runtimes`,
  `temporal` and `time-zones`. No job has a `uses` key, and no job is `shared-check`. A comment
  above the jobs says the shared check is gate 1 and that the hub reusable workflow returns when
  the hub has a GitHub remote (ADR-0012).
- `.github/workflows/shared-sync.yml` and `packages/nepdate/test/shared-sync-workflow.test.ts` are
  deleted. `DEDICATED_TESTS` has exactly the three remaining workflows, and the discovery test
  asserts those three file names exactly.
- `packages/nepdate/test/workflow-rules.ts` exports `remoteReusableProblems`, and
  `sharedWorkflowProblems` calls it. A job-level `uses` that does not start with `./` fails with
  `job <name> calls a non-local reusable workflow; the hub has no GitHub remote (ADR-0012)`. A
  local `./` reusable workflow is not rejected by this rule.
- `packages/nepdate/test/ci-workflow.test.ts` expects the six jobs. The old `secrets: inherit`
  control anchored on `shared-check` is replaced with one that adds `secrets: inherit` to the
  `ci` job, and the secret rule still fails. A job-set control re-adds a job named `shared-check`
  and asserts the job-set message.
- `docs/adr/0012-ci-without-hub-remote.md` records the decision:
  - context: the hub has no GitHub remote, so the two reusable calls cannot resolve;
  - decision: the `shared.sha256` gate runs first; `ci.yml` has no `shared-check`; there is no
    `shared-sync.yml`; syncing stays local with the hub tool, `--write` and `npm run codegen`;
    the reusable workflows return in a new ADR when the hub has a remote;
  - consequences: CI runs again on a push; the checksum proves `shared/` has not changed since the
    manifest was written for `shared/VERSION`, not that it equals the hub; a hand-edited `shared/`
    and a hand-rewritten manifest would pass CI, so any manifest change without a `shared/VERSION`
    change is a review failure.
- `docs/adr/README.md` lists ADR-0012 as Accepted.
- ADR-0001, ADR-0004 and ADR-0005 are not edited. ADR-0012 supersedes the reusable-workflow
  sentence in ADR-0001 §7 and the weekly sync line in ADR-0005.
- `npx vitest run test/workflows.test.ts test/ci-workflow.test.ts --root packages/nepdate
  --coverage.enabled=false` passes.

Work:
- Remove the job and the workflow, delete the dedicated test, and update the map and exact file
  list.
- Add the non-local reusable workflow rule and its control. Write ADR-0012 and its index row.
- If a workflow test finds a real defect, stop and report it before changing the workflow.

## T13-03 Controls and checkpoint

AC:
- The checksum tests show each failure path: a missing file, an extra file, a changed byte, a bad
  header, a bad `VERSION`, a malformed digest, and a write refused after the hub check fails. The
  changed-file failure names its path, and the refused write leaves the manifest byte-identical.
- The workflow controls show:
  - a job-level `uses: sanamhub/nepdate/.github/workflows/shared-check.yml@<40-hex>` fails the
    non-local reusable rule with its message;
  - re-adding a job named `shared-check` fails the exact job-set rule;
  - adding `secrets: inherit` to the `ci` job fails the secret rule;
  - adding an unmapped `shared-sync.yml` fails the coverage rule with its file name.
- The checksum controls exercise the real check, so they need no disabled rule. For the non-local
  reusable rule and the exact job-set rule, disable the rule once, watch its control fail, and
  restore the test file by SHA-256. The checkpoint lists the results and the restored hashes.
- A real `git clone` into `E:\temp\nepdate-t13-check` at the T13-03 commit runs `npm ci` and
  `npm run ci`. The last line is `ci: 13/13 gates passed`, and PROGRESS records the core and patro
  test counts, the workflow test counts, the 87 API entries and the file count in the manifest.
- PROGRESS has a done row for T13-01, T13-02 and T13-03, and a checkpoint row with the evidence.
- No package, API or runtime change. No benchmark or mutation run. No tag, publish, remote,
  setting or secret change.

Work:
- Add the controls and run them. Record the results in PROGRESS and the checkpoint. Do not commit
  a temporary mutation script.

## Checkpoint

The implementation agent stops after T13-03. The reviewer checks:

- [ ] `scripts/shared.sha256` has 31 file lines under its header, and `node scripts/shared-sums.ts`
      passes against `shared/VERSION`.
- [ ] A changed, missing or extra file fails the gate, and `--write` refuses to run when the hub
      check fails.
- [ ] `ci.yml` has six jobs and no `uses`; `shared-sync.yml` and its test are gone; the map and
      discovery test list exactly three workflows.
- [ ] The non-local reusable rule fails on a remote `uses`, and the other workflow controls fail
      as listed.
- [ ] ADR-0012 is Accepted and indexed, and no accepted ADR was edited.
- [ ] A real `git clone` into `E:\temp\nepdate-t13-check` runs `npm ci && npm run ci`; the last
      line is pasted in PROGRESS and the checkpoint report.
- [ ] No tag, publish, remote, setting or secret change. No benchmark or mutation run. No package,
      API or runtime change; the API snapshot still reports 87 entries.
