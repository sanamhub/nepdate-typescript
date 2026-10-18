# Contributing

This is the TypeScript port of the NepDate family: the npm packages `nepdate` and `nepdate-patro`.
Behaviour is fixed by the shared spec in `shared/spec/` and decisions by the ADRs in `docs/adr/`,
so most changes follow a task in `docs/plan/`. The rules for agents, which also apply to people,
are in [`AGENTS.md`](AGENTS.md).

## Data and spec changes go to the hub

`shared/` is a read-only copy of [`sanamhub/nepdate`](https://github.com/sanamhub/nepdate). A wrong
month length, holiday or tithi, or a question about the spec, goes there as an issue. Never edit
`shared/` here, and never edit a `*.gen.ts` file by hand: change `scripts/codegen.ts` and run
`npm run codegen`.

## Checks

Node 24 for development (Node 22.12 is the floor for users). From the repository root:

```bash
npm ci
npm run ci
```

The last line reads `ci: 10/10 gates passed`.

- Zero runtime `dependencies` in both packages; `nepdate` never imports `nepdate-patro`.
- No export beyond [`docs/API.md`](docs/API.md).
- Never weaken, skip or delete a test to get CI green. A skipped parity row names its deviation
  from `shared/spec/PARITY.md`.

## Commits and PRs

- [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, with the
  task ID first when the change follows one (`feat(nepdate): serial conversion`).
- One task per PR. Fill in the PR template, including "What to look at first".
- Prose, comments and commit messages follow
  [`.claude/skills/writing-style/SKILL.md`](.claude/skills/writing-style/SKILL.md): no em dashes,
  no filler, exact numbers and IDs, and no AI attribution lines.

By contributing you agree that your contribution is licensed under the MIT license
([LICENSE](LICENSE)).
