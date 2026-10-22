# AGENTS.md: rules for AI coding agents (TypeScript port)

You are implementing a planned project. Follow the plan; don't redesign it.

## 0. Before writing any code

1. Read `README.md`, this file, every ADR in `docs/adr/`, and `docs/API.md`.
2. Open `docs/plan/00-ROADMAP.md`, find your phase, read that phase file and the spec sections it
   lists under "Read first". Check its preconditions; if one is unmet, stop and say so.

## 1. Sources of truth (in priority order)

1. `shared/spec/*.md` + `shared/spec/vectors/*`: behaviour. Vectors win over prose (report the
   disagreement).
2. `docs/adr/*`: decisions. 3. `docs/plan/*`: tasks and acceptance criteria. 4. `docs/API.md`: the
   exported surface.

`shared/` is a read-only copy of the hub. **Never edit it.** A data or spec problem is reported to
the human as a hub issue. Never use the C# NepDate docs as a source (`shared/spec/PARITY.md` §1).

## 2. Hard rules

- Zero runtime `dependencies` in both packages. `@nepdate/patro` has exactly one peer dependency,
  `@nepdate/core` (ADR-0001 §1). Dev tools in the root `devDependencies`; competitor packages only in
  `bench/package.json`.
- `packages/nepdate` never imports, depends on or contains anything from `@nepdate/patro` (hub
  ADR-0004; checked by CI gate 6, ADR-0004).
- No export beyond `docs/API.md`.
- **No `Date` in the core.** Conversions use integer day arithmetic; `Date` appears only in the
  `fromJSDate`/`toJSDate`/`today` edge functions, always through `Date.UTC` or explicit
  `Intl.DateTimeFormat` with a `timeZone`. Never `Date.parse` or `new Date(string)`.
- Integer maths (ADR-0002 §4): in `src/`, division is `(a / b) | 0` and remainder is `a % b`, and
  only on operands that the code has already proven to be in `[0, 2^31)` (range-check first, or
  shift the value, as in Hinnant's era shift). If an operand can be negative, fix that before
  dividing; don't reach for `Math.floor` in a hot path. Tests and scripts may use `Math.floor`.
- Strict parsing matches ASCII `0-9` and U+0966–U+096F explicitly; never `\d` alone.
- No top-level `await` (it would break `require()` of the ESM build). No side effects at import
  (`"sideEffects": false`): building the module's own tables at load (ADR-0002 §5, §7) is allowed;
  touching globals, I/O or timers is not.
- Don't edit `*.gen.ts` by hand. Change `scripts/codegen.ts` and run `npm run codegen`.
- Run every npm command from the repository root (`npm test -w @nepdate/core`, not `cd packages/...`).
- Parity tests may skip rows **only** for deviations in `shared/spec/PARITY.md`, with a comment
  naming the D-ID. Don't weaken or delete a test to make CI pass.
- No features outside the plan. Secrets never go in code, logs or commits.

## 3. How to work

- One task ID at a time (`T1-03`). Test first, see it fail, then implement.
- Stop at the end of every phase: work through the phase file's "Checkpoint" list yourself, put the
  results in the PR, and wait for the human's review before starting the next phase.
- Run `npm run ci` before saying you're done; paste its last line in the PR.
- PR description: task IDs, what changed and why, how tested, "What to look at first" (2–3 bullets).

## 4. Writing

All prose follows [`.claude/skills/writing-style/SKILL.md`](.claude/skills/writing-style/SKILL.md),
for every agent. TSDoc on every export: what it does, what it returns, `@throws` when it can.
**No AI attribution** in commits or PRs.
