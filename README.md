# nepdate-typescript

Bikram Sambat (Nepali calendar) for TypeScript and JavaScript. Part of the NepDate family: shared
data and spec live in the hub [`sanamhub/nepdate`](https://github.com/sanamhub/nepdate); the C#
original is [NepDate](https://github.com/RajuPrasai/NepDate).

- Two npm packages from this repository, always the same version (names to confirm before T0, see
  `docs/competitors.md`):
  - `nepdate`: dates, conversion, arithmetic, formatting, parsing. ESM only, types included, zero
    dependencies, no event data.
  - `nepdate-patro`: the patro (पात्रो, the Nepali almanac): tithi, public holidays and events
    (BS 2077-01-01 to 2084-08-20 today). Needs `nepdate` as a peer dependency. Install it only if
    you show tithi, holidays or events.
- Pure TypeScript, no `Date` in the core (no time zone bugs), no WASM. Node 22.12+, Deno, Bun and
  current browsers.
- BS 1901-01-01 to 2199-12-30 (AD 1844-04-11 to 2143-04-15), the widest range on npm. Same results
  as C# NepDate and every other port, proved by the shared vectors.

**Status:** phase T0 (repository and CI) done; next: T1. Progress: [docs/plan/PROGRESS.md](docs/plan/PROGRESS.md).

## Where to start

| You are | Read |
|---|---|
| an AI agent implementing a phase | [AGENTS.md](AGENTS.md) → [docs/plan/00-ROADMAP.md](docs/plan/00-ROADMAP.md) |
| reviewing the API | [docs/API.md](docs/API.md) |
| comparing with other npm packages | [docs/competitors.md](docs/competitors.md) |
| wondering "why is it like this?" | [docs/adr/README.md](docs/adr/README.md) |
| looking for the algorithm or data | [shared/spec/README.md](shared/spec/README.md) (changes go to the hub) |

## Layout

```
shared/                   hub copy: data/, spec/, VERSION (hub commit)
package.json              private root: npm workspaces, devDependencies, scripts   (phase T0)
packages/nepdate/         npm package nepdate: src/, test/ (vitest)                 (phase T0)
packages/nepdate-patro/   npm package nepdate-patro: src/, test/                    (phase T0 skeleton, T4)
scripts/                  codegen.ts, ci.ts, release-check.ts, docs-check.ts (run with node)
bench/                    mitata benchmarks vs competitors (own devDependencies)    (phase T5)
docs/                     API.md, competitors.md, adr/, plan/, runbooks/
```

## License

MIT ([LICENSE](LICENSE)). Calendar data from NepDate by Raju Prasai and contributors, MIT
([shared/data/NOTICE](shared/data/NOTICE)). Not affiliated with the Government of Nepal.
