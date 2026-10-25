# Contributing

Bug reports, fixes and documentation improvements are welcome. For a new feature or an API change,
open an issue first so the design can be agreed before you write code.

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems as
described in [SECURITY.md](SECURITY.md), not in a public issue.

## Scope

The shared calendar and patro data, the spec and the golden vectors live in the hub
([`sanamhub/nepdate`](https://github.com/sanamhub/nepdate)) and are copied into `shared/`
read-only. A wrong date, holiday or tithi is a data issue: report it in the hub, not here. Never
edit `shared/` or a `*.gen.ts` file by hand: change `scripts/codegen.ts` and run `npm run codegen`.

## Setup

Node 24 for development (Node 22.12 is the floor for users). Run every npm command from the
repository root.

```sh
npm ci
npm test
```

The browser suites (`npm run test:browser -w nepdate-patro` and `-w nepdate-datepicker`) need the
Playwright browsers: `npx playwright install chromium firefox webkit`.

## Gates

`npm run ci` runs every gate in [ADR-0004](docs/adr/0004-testing-and-quality-gates.md) in order and
stops at the first failure. The last line reads `ci: 16/16 gates passed`. The mutation run
(`npm run mutation`, then `npm run mutation:check`) is slow and has its own workflow.

## Pull requests

- Keep a pull request to one change.
- Add or update a test for any behaviour change. The shared vector suites must keep passing, and a
  skipped parity row names its deviation from `shared/spec/PARITY.md`.
- Zero runtime `dependencies` in every package; `nepdate-core` never imports `nepdate-patro`.
- Public API changes go in `docs/API.md` and `docs/api-snapshot.json` (`node scripts/api-check.ts
  --write`) in the same commit.
- Add a line to the `Unreleased` section of [CHANGELOG.md](CHANGELOG.md) for anything a user would
  notice.
- A significant design decision gets an ADR in `docs/adr/`. Accepted ADRs are not edited; a later
  ADR supersedes an earlier one.
- CI must pass.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, imperative,
lower case, no trailing period. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `build`,
`ci`, `perf`. The body says why, not what.

## Releases

Releasing and rolling back are described in
[`docs/runbooks/release.md`](docs/runbooks/release.md).

By contributing you agree that your contribution is licensed under the MIT license
([LICENSE](LICENSE)).
