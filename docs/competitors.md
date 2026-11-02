# Other npm packages for the Bikram Sambat calendar

Checked 2026-11-02 against the npm registry, the npm downloads API, deps.dev and GitHub. The
selection follows [`shared/spec/BENCHMARK.md`](../shared/spec/BENCHMARK.md) section 7. Usage is
weekly downloads from the npm downloads API and dependents from deps.dev, read on 2026-11-02. The
bar is 1,000 weekly downloads and 5 dependents, first release at least 12 months before 2026-11-02,
a release or commit in the last 36 months, a license, not archived or deprecated, and a build on the
current Node.js.

## Candidate table

| Package | Weekly downloads | Dependents | First release | Last release | License | Verdict |
|---|---:|---:|---|---|---|---|
| `world-calendars` | 895,562 | 509 | 2016-11-02 | 2025-07-11 | MIT | selected |
| `nepali-date-converter` | 14,051 | 22 | 2018-10-12 | 2026-10-29 | MIT | selected; the harness pins 3.4.0, published 2025-04-06, because 3.4.2 is under 14 days old |
| `bikram-sambat` | 1,962 | 10 | 2017-03-23 | 2026-06-09 | Apache-2.0 | selected |
| `bikram-sambat-js` | 1,723 | 20 | 2019-08-25 | 2025-08-21 | MIT | passes the bar, ranks fourth |
| `@sbmdkl/nepali-date-converter` | 1,455 | 5 | 2021-06-18 | 2026-05-02 | MIT | passes the bar, ranks fifth |
| `@remotemerge/nepali-date-converter` | 1,189 | 0 | 2025-01-04 | 2026-10-31 | MIT | fails 5 dependents |
| `nepali-datetime` | 1,108 | 1 | 2023-02-10 | 2026-04-11 | GPL-3.0 | fails 5 dependents |
| `nepali-date-library` | 484 | 0 | 2025-02-26 | 2026-08-11 | MIT | fails 1,000 weekly downloads and 5 dependents |
| `@inicrea/bikram-sambat-core` | 558 | 0 | 2026-08-20 | 2026-08-25 | MIT | fails 1,000 weekly downloads, 5 dependents and the 12-month bar |
| `@zener/nepali-date` | 336 | 0 | 2024-10-12 | 2025-03-10 | MIT | fails 1,000 weekly downloads and 5 dependents |
| `nepali-calendar-toolkit` | 157 | 0 | 2026-09-01 | 2026-09-25 | MIT | fails 1,000 weekly downloads, 5 dependents and the 12-month bar |
| `@bsday.js/core` | 22 | 0 | 2026-03-28 | 2026-08-30 | MIT | fails 1,000 weekly downloads, 5 dependents and the 12-month bar |
| `@nepali-date-picker/core` | 16 | 0 | 2026-09-16 | 2026-09-21 | MPL-2.0 | fails 1,000 weekly downloads, 5 dependents and the 12-month bar |

`world-calendars` is a general calendar library, but its `calendars.nepali` module is a Bikram
Sambat implementation with a documented 1970 to 2100 table, so it is a candidate. Its usage is
mostly through `plotly.js`, as the dependents count shows.

## Calls measured

| Package | B1 BS to AD | B2 AD to BS |
|---|---|---|
| `world-calendars` | `nepali.newDate(y, m, d).toJD()`, then `gregorian.fromJD(jd)` | `nepali.fromJD(gregorian.newDate(y, m, d).toJD())` |
| `nepali-date-converter` | `new NepaliDate(y, m0, d).getAD()` | `NepaliDate.fromAD(date).getBS()` |
| `bikram-sambat` | `toGreg(y, m, d)` | `toBik("YYYY-MM-DD")` |

`nepali-date-converter` takes a zero-based month. `bikram-sambat` takes its B2 input as a string; the
strings are built once in setup, as for B6, and a returned string is consumed by its length.

## Correctness

- `world-calendars` agrees with `shared/data` on all 64 dates in both directions.
- `nepali-date-converter` differs at BS 2088-01-04 and 2089-06-10.
- `bikram-sambat` differs at BS 2086-07-23, 2088-01-04 and 2089-06-10.

The report lists every differing date. A fast wrong answer is listed, never ranked first.

## Sources

`https://registry.npmjs.org/<name>`, `https://api.npmjs.org/downloads/point/last-week/<name>`,
`https://api.deps.dev/v3alpha/systems/NPM/packages/<name>/versions/<version>:dependents`, and the
repositories: plotly/world-calendars, subeshb1/Nepali-Date and medic/bikram-sambat.
