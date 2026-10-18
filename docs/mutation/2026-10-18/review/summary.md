# Mutation summary

- Date: 2026-10-18
- Commit: `9f910e0`
- Wall time: 1170 s
- Concurrency: 2
- Stryker: nepdate: All files 94.67% (1231 killed, 48 timeout, 72 survived, 0 no coverage); nepdate-patro: All files 88.20% (138 killed, 4 timeout, 19 survived, 0 no coverage)

Score **93.98%** from 1369 killed, 52 timeout, 91 survived and 0 no coverage, including 364 static mutant(s).

| File | Killed | Survived | Timeout | No coverage | Runtime | Compile | Total | Score |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `packages/nepdate-patro/src/build.ts` | 126 | 19 | 4 | 0 | 0 | 0 | 149 | 87.2% |
| `packages/nepdate-patro/src/index.ts` | 12 | 0 | 0 | 0 | 0 | 0 | 12 | 100.0% |
| `packages/nepdate/src/date.ts` | 365 | 19 | 0 | 0 | 0 | 0 | 384 | 95.1% |
| `packages/nepdate/src/digits.ts` | 42 | 10 | 3 | 0 | 0 | 0 | 55 | 81.8% |
| `packages/nepdate/src/errors.ts` | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 100.0% |
| `packages/nepdate/src/fiscal.ts` | 75 | 2 | 0 | 0 | 0 | 0 | 77 | 97.4% |
| `packages/nepdate/src/format.ts` | 184 | 16 | 38 | 0 | 0 | 0 | 238 | 93.3% |
| `packages/nepdate/src/gregorian.ts` | 98 | 0 | 0 | 0 | 0 | 0 | 98 | 100.0% |
| `packages/nepdate/src/names.ts` | 12 | 4 | 0 | 0 | 0 | 0 | 16 | 75.0% |
| `packages/nepdate/src/parse.ts` | 349 | 9 | 4 | 0 | 0 | 0 | 362 | 97.5% |
| `packages/nepdate/src/range.ts` | 32 | 0 | 1 | 0 | 0 | 0 | 33 | 100.0% |
| `packages/nepdate/src/tables.ts` | 73 | 12 | 2 | 0 | 0 | 0 | 87 | 86.2% |
| **total** | **1369** | **91** | **52** | **0** | **0** | **0** | **1512** | **93.98%** |

91 survivor(s) are in `summary.json`.
