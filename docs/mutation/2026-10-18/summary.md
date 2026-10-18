# Mutation summary

- Date: 2026-10-18
- Commit: `1c0f3f8`
- Wall time: 1166.1 s
- Concurrency: 2
- Stryker: nepdate: All files 88.36% (1144 killed, 48 timeout, 149 survived, 8 no coverage); nepdate-patro: All files 53.42% (83 killed, 3 timeout, 73 survived, 2 no coverage)

Score **84.64%** from 1227 killed, 51 timeout, 222 survived and 10 no coverage.

| File | Killed | Survived | Timeout | No coverage | Runtime | Compile | Total | Score |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `packages/nepdate-patro/src/build.ts` | 71 | 73 | 3 | 2 | 0 | 0 | 149 | 49.7% |
| `packages/nepdate-patro/src/index.ts` | 12 | 0 | 0 | 0 | 0 | 0 | 12 | 100.0% |
| `packages/nepdate/src/date.ts` | 343 | 41 | 0 | 0 | 0 | 0 | 384 | 89.3% |
| `packages/nepdate/src/digits.ts` | 38 | 10 | 5 | 2 | 0 | 0 | 55 | 78.2% |
| `packages/nepdate/src/errors.ts` | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 100.0% |
| `packages/nepdate/src/fiscal.ts` | 71 | 6 | 0 | 0 | 0 | 0 | 77 | 92.2% |
| `packages/nepdate/src/format.ts` | 178 | 22 | 36 | 0 | 0 | 0 | 236 | 90.7% |
| `packages/nepdate/src/gregorian.ts` | 95 | 3 | 0 | 0 | 0 | 0 | 98 | 96.9% |
| `packages/nepdate/src/names.ts` | 12 | 4 | 0 | 0 | 0 | 0 | 16 | 75.0% |
| `packages/nepdate/src/parse.ts` | 308 | 44 | 4 | 6 | 0 | 0 | 362 | 86.2% |
| `packages/nepdate/src/range.ts` | 30 | 2 | 1 | 0 | 0 | 0 | 33 | 93.9% |
| `packages/nepdate/src/tables.ts` | 68 | 17 | 2 | 0 | 0 | 0 | 87 | 80.5% |
| **total** | **1227** | **222** | **51** | **10** | **0** | **0** | **1510** | **84.64%** |

232 survivor(s) are in `summary.json`.
