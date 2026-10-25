# T16: release `nepdate-picker` with the other two packages

Branch `feat/T16-picker-release` from `00d78ea` (T15 merged). Read first: ADR-0005, ADR-0011,
ADR-0015 (Consequences), `docs/runbooks/release.md`, `.github/workflows/release.yml`,
`.github/workflows/verify-published.yml`, `scripts/release-check.ts`, `scripts/tarball-check.ts`,
`scripts/smoke.ts` and `scripts/packed-smoke.ts`.

T15 added `nepdate-picker` but left the release path alone: trusted publishing needs the package to
exist on npm, so the owner publishes the first version by hand (ADR-0015, Consequences). This phase
makes the release tooling treat the picker like `nepdate-patro`: same version, a `~X.Y.Z` peer on
`nepdate-core`, packed, checked, smoke-tested, published and verified by the same workflow run.

Merge order matters. Once this phase is on `main`, a tag push publishes the picker too, and that
publish fails unless the owner has already published it once and added its trusted publisher
(T16-06). The phase changes no package code and runs no benchmark or mutation job.

## T16-00 Plan

AC:
- The roadmap has a T16 row pointing here.
- PROGRESS has rows for the plan, every task and the checkpoint.

## T16-01 release-check

AC:
- `node scripts/release-check.ts X.Y.Z` fails when `packages/nepdate-picker/package.json` has a
  different version, and names `nepdate-picker version ..., expected X.Y.Z`.
- It fails when the picker's `peerDependencies["nepdate-core"]` is not `~X.Y.Z`, and names the
  picker, not patro.
- `packages/nepdate/test/release-check.test.ts` has one negative control for each, and the passing
  and pre-release fixtures carry a picker manifest.

## T16-02 Tarball check

AC:
- `scripts/tarball-check.ts` expects exactly three tarballs: core, patro and picker. Two or four
  fail with the list it found.
- The picker tarball must have name `nepdate-picker`, the version, the `nepdate-core` peer
  `~X.Y.Z` and repository directory `packages/nepdate-picker`.
- Its members are only `package.json`, `README.md`, `LICENSE`, `dist/theme.css`,
  `dist/nepdate-picker.js` and `dist/*.js`, `dist/*.d.ts`, `dist/*.d.ts.map`. Anything else fails,
  including `src/`, `test/` and a `NOTICE`, which the picker does not ship.
- `dist/theme.css` and `dist/nepdate-picker.js` must be present.
- `scripts/tarball-check.test.ts` covers the passing picker members and each failure above.

## T16-03 Picker smoke

AC:
- `node scripts/smoke.ts --mode picker --project <dir>` runs in Node, with no DOM: it imports
  `nepdate-picker`, checks `monthGrid(2081, 4)` has 6 rows and `defineElements` is a function, and
  calls `defineElements()` without a `customElements` global.
- It fails unless the installed package has `dist/theme.css` and `dist/nepdate-picker.js`, and the
  standalone file has no `from"` or `import"` statement (the gate 12 rule).
- `scripts/packed-smoke.ts` (gate 11, and the oldest-node job) packs the picker, installs it with
  the core into a third clean project offline and runs `--mode picker`.

## T16-04 Release workflow

AC:
- The `pack` job packs `nepdate-picker` into `release-tarballs` next to the other two; publint and
  attw run on every tarball. attw on the picker uses `--exclude-entrypoints ./theme.css`, as gate 12
  does.
- The `smoke` job has a "Core plus picker" step that installs both tarballs into a clean project
  and runs `scripts/smoke.ts --mode picker`.
- The `publish` job has "Publish nepdate-picker" after "Publish nepdate-patro", with the same
  `npm view` guard, `NODE_AUTH_TOKEN` handling and
  `--provenance --access public --tag "$DIST_TAG"`.
- No new action and no changed pin.
- `release-workflow.test.ts` checks the picker pack, smoke and publish steps and the publish order,
  and a control that removes the picker publish step fails.

## T16-05 Post-publish verification

AC:
- `verify-published.yml` installs `nepdate-picker@$VERSION` exactly with the other two, compares
  its installed version, and imports it in the quick start step (`monthGrid(2081, 4)` has 6 rows).
- `verify-published-workflow.test.ts` requires all three, and a control that drops the picker from
  the install fails.

## T16-06 Runbook, release notes and changelog

AC:
- `docs/runbooks/release.md` covers three packages and has a "First publish of a new package"
  section for `nepdate-picker`: the owner runs `npm run build` and
  `npm publish ./packages/nepdate-picker --access public --tag beta` once from a clean `main` checkout
  with npm 2FA, then adds the trusted publisher with the values the core and patro use.
- `scripts/release-notes.ts` says three packages and gives the picker its own install line;
  `release-notes.test.ts` checks it.
- `CHANGELOG.md` `[Unreleased]` says the picker is released with the other two.

## Checkpoint

The implementation agent stops after T16-06. The reviewer checks:

- [ ] `npm run ci` passes, and gate 11 prints the picker smoke line.
- [ ] `node scripts/release-check.ts` and `scripts/tarball-check.ts` reject a wrong picker version,
      peer range and tarball member.
- [ ] `release.yml` diff: one pack line, one smoke step, one publish step, no pin change.
- [ ] The owner has published `nepdate-picker` once and added its trusted publisher before this
      branch merges, or the next tag waits until then.
