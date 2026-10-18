# Mutation summary

- Date: 2026-10-18
- Commit: `781b1c2`
- Wall time: 676 s
- Concurrency: 2
- Stryker: nepdate: All files 89.50% (1117 killed, 51 timeout, 137 survived, 0 no coverage); nepdate-patro: All files 41.77% (63 killed, 3 timeout, 90 survived, 2 no coverage)

Score **94.86%** from 1043 killed, 46 timeout, 57 survived and 2 no coverage. 364 static mutant(s) are excluded: the Vitest 5 runner cannot reload import-time modules.

| File | Killed | Survived | Timeout | No coverage | Runtime | Compile | Total | Score |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `packages/nepdate-patro/src/build.ts` | 0 | 0 | 0 | 2 | 0 | 0 | 2 | 0.0% |
| `packages/nepdate-patro/src/index.ts` | 12 | 0 | 0 | 0 | 0 | 0 | 12 | 100.0% |
| `packages/nepdate/src/date.ts` | 294 | 17 | 0 | 0 | 0 | 0 | 311 | 94.5% |
| `packages/nepdate/src/digits.ts` | 12 | 0 | 0 | 0 | 0 | 0 | 12 | 100.0% |
| `packages/nepdate/src/errors.ts` | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 100.0% |
| `packages/nepdate/src/fiscal.ts` | 75 | 2 | 0 | 0 | 0 | 0 | 77 | 97.4% |
| `packages/nepdate/src/format.ts` | 180 | 20 | 38 | 0 | 0 | 0 | 238 | 91.6% |
| `packages/nepdate/src/gregorian.ts` | 98 | 0 | 0 | 0 | 0 | 0 | 98 | 100.0% |
| `packages/nepdate/src/names.ts` | 12 | 4 | 0 | 0 | 0 | 0 | 16 | 75.0% |
| `packages/nepdate/src/parse.ts` | 327 | 14 | 7 | 0 | 0 | 0 | 348 | 96.0% |
| `packages/nepdate/src/range.ts` | 32 | 0 | 1 | 0 | 0 | 0 | 33 | 100.0% |
| `packages/nepdate/src/tables.ts` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0% |
| **total** | **1043** | **57** | **46** | **2** | **0** | **0** | **1148** | **94.86%** |

229 survivor(s) are in `summary.json`.
