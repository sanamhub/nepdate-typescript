# T11: Parse the workflow tests

Branch `feat/T11-workflow-yaml` from `a7d0000` (T10 merged after review). Read first: the T10 review
row in `docs/plan/PROGRESS.md`, ADR-0011, `.github/workflows/release.yml`, `ci.yml`, `mutation.yml`,
`packages/nepdate/test/release-workflow.test.ts`, `packages/nepdate/test/mutation-workflow.test.ts`
and the Rust W4/W5 workflow check in `xtask/src/workflow.rs`.

T10 closed the release path, but its workflow tests still match text. A step moved to another job, a
comment, or a different indentation can make a rule pass or fail for the wrong reason. The Rust port
parses the workflow and checks the tree. This phase does the same for both workflow test files.

The phase changes tests and one root development dependency. No package API, runtime code or packed
file changes, and no workflow change is planned. The phase runs no benchmark or mutation job.

## T11-00 Plan

AC:
- `docs/plan/T11-workflow-yaml.md` exists with one section per task and testable criteria.
- `docs/plan/00-ROADMAP.md` has a T11 row pointing here.
- `docs/plan/PROGRESS.md` has a T11 plan row, a row per task and a checkpoint row.
- Each acceptance criterion names a command, a test or a checkpoint check.

Work:
- Add this file, the roadmap row and the PROGRESS rows.

## T11-01 Parse every workflow test

AC:
- The root `package.json` lists `yaml` in `devDependencies` as the exact version `2.9.1`, and
  `package-lock.json` has that version with its integrity hash.
- `node -e "require('yaml')"` prints no error from the repository root.
- `packages/nepdate/test/release-workflow.test.ts` and
  `packages/nepdate/test/mutation-workflow.test.ts` parse their workflow with `yaml` and assert on
  the returned tree. No rule is decided by `String.includes` on the workflow text, except the
  comment fixture in T11-02, which removes a live value and leaves only its comment.
- The parsed release test checks the `push` and `workflow_dispatch` triggers, every job name, the
  `needs` of `publish`, `smoke`, `mutation`, `verify` and `github-release`, the permissions of the
  workflow and each job, the `production` environment on `publish` and no environment elsewhere,
  the named steps and their order inside the job that owns them, 40-hex action pins, and no
  `${{ }}` in any `run` script.
- The parsed mutation test checks the `schedule` and `workflow_dispatch` triggers, the cron value,
  the job permissions, the named steps and their order, 40-hex action pins, no secret, and no
  `${{ }}` in any `run` script.
- Every rule in the T10 test is still checked. The messages keep the T10 wording where a test names
  it.
- `npm test -w nepdate` passes, including both workflow tests.
- `node scripts/tarball-check.ts` on the packed 0.1.0 tarballs passes and finds no `yaml` file or
  `devDependencies` in either packed manifest.
- Gate 12 still reports 87 entries.

Work:
- Add `yaml` 2.9.1 as an exact root devDependency. The package is ISC licensed, has no runtime
  dependencies and ships no install script. Its 2.9.1 release notes limit recursive merge aliases
  and simplify line unfolding in quoted strings; 2.9.0 removed the "never throw" claim for
  `parseDocument()` and fixed two call-stack cases, and 2.8.1 preserved empty block literals.
- Add `packages/nepdate/test/workflow-yaml.ts` with the parser and tree helpers: `parseWorkflow`,
  `job`, `jobs`, `steps`, `step`, `stepIndex`, `needs`, `permissions`, `triggers`, `runText`,
  `actionUses` and `stringValues`.
- Rewrite `release-workflow.test.ts` on those helpers. Keep `problems`, `verifyProblems` and
  `githubReleaseProblems`, but take a parsed workflow. Check each rule against a key, a step or a
  list, not a line.
- Rewrite `mutation-workflow.test.ts` on the same helpers.
- Run the expression scan on the decoded `run` strings. If it finds an expression, move the value
  to `env` and record the fix. No such fix is expected.
- Leave the workflows unchanged unless a parsed check finds a real violation.

## T11-02 Negative controls that text matching misses

AC:
- `release-workflow.test.ts` has a test that removes the live `fetch-depth: 0` and leaves
  `# fetch-depth: 0`; the parsed check reports `publish checkout must fetch full history` and the
  test proves the edit applied.
- A test moves the `Create the GitHub release` step from `github-release` into `publish`; the
  parsed check reports both `publish must not create the GitHub release` and
  `github-release must create the GitHub release`.
- A test adds `id-token: write` to the workflow-level permissions and removes it from `publish`;
  the parsed check reports `default permissions must be exactly contents: read` and
  `publish needs contents: read and id-token: write`.
- A test moves `Check the tarball contents and write SHA256SUMS` after `Upload the tarballs` in
  `pack`; the parsed check reports `pack must check the tarball contents before uploading`.
- Each fixture starts from the real workflow text or the parsed real tree, applies one edit, and
  asserts that the edit changed the value before checking the message.
- `npm test -w nepdate` passes. The four new tests fail when the matching rule is removed from the
  check, one at a time.

Work:
- Add the four fixtures to `release-workflow.test.ts`. Use `structuredClone` on the parsed tree for
  the step and permission edits, and a text edit for the comment fixture.
- Keep the T10 negative controls: missing main check, missing mutation job, one combined bad
  workflow, missing tarball check, publish rebuild, missing verify, wrong verify needs, verify
  `id-token`, GitHub release not needing verify, release in publish, and `contents: write` on
  publish.

## Checkpoint

The implementation agent stops after T11-02. The reviewer checks:

- [ ] Both workflow test files parse YAML. No rule is decided by text matching, except the comment
      fixture.
- [ ] Triggers, job names, needs, per-job permissions, environment, named steps and their order,
      40-hex pins and the `run` expression scan are all asserted on the parsed tree.
- [ ] The four T11-02 controls fail for the stated reason when their rule is removed, and each
      fixture proves that it changed the workflow.
- [ ] Every T10 rule is still checked, and the T10 negative controls still pass.
- [ ] `yaml` is an exact root devDependency, is absent from both packed tarballs, and gate 12 still
      reports 87 entries.
- [ ] `npm run ci` passes from a fresh clone on `E:\temp`, and its last line is pasted in PROGRESS
      and the checkpoint report.
- [ ] No tag, publish, remote, setting or secret change. No benchmark or mutation run.
