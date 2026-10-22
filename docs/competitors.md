# Other npm packages for the Bikram Sambat calendar

Checked 2026-09-25 against the npm registry and downloads API, bundlephobia, GitHub and published
sources (read, not run); rechecked 2026-10-08 (weekly downloads for 2026-09-28 to 2026-10-04 where
the bulk downloads API returns them, and `world-calendars` added). Used by the benchmark suite.
No package covers BS 1901–2199; the widest real tables start at 1970. Sizes are bundlephobia
min / gzip.

## Platform support

JavaScript has no Bikram Sambat calendar to build on. `Intl.supportedValuesOf("calendar")` on
Node 24.19.0 (ICU 78.3, CLDR 48) lists `buddhist chinese coptic dangi ethioaa ethiopic gregory
hebrew indian islamic islamic-civil islamic-rgsa islamic-tbla islamic-umalqura iso8601 japanese
persian roc` (run on 2026-10-08); `indian` is the Indian national (Saka) calendar, not Bikram
Sambat. Temporal accepts only the calendars `Intl` supports, so it has none either. Browsers ship
the same ICU and CLDR data. Sources: CLDR calendar identifiers
(https://github.com/unicode-org/cldr/blob/main/common/bcp47/calendar.xml), MDN
`Intl.supportedValuesOf` (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf).
The port is needed.

## Packages we benchmark against

| Package (pinned in `bench/package.json`) | Weekly downloads | License | BS range | Approach | min / gz | Types |
|---|---|---|---|---|---|---|
| `nepali-date-converter@3.4.0` | ~18,400 | MIT | 2000–2090 | month lengths + cumulative days, UTC epoch | 18.1 / 3.2 KB | yes |
| `bikram-sambat@1.8.1` (medic) | ~3,400 | Apache-2.0 | 1970–2090 | 2-bit packed months; walks year by year from 1970 | 2.8 / 1.1 KB | no, CommonJS |
| `bikram-sambat-js@1.0.3` | ~1,900 | MIT (npm field) | 1970–2100 | table on local-time `Date` | 5.3 / 1.7 KB | yes |
| `@remotemerge/nepali-date-converter@1.2.1` | ~2,200 | MIT | 1975–2099 | table, UTC epoch | 4.4 / 1.5 KB | yes |
| `nepali-datetime@2.0.0` | ~1,000 | GPL-3.0 (benchmark only, never copy its tables) | 2000–2099 | table | 19.4 / 4.9 KB | yes |
| `@sbmdkl/nepali-date-converter@2.0.5` | ~850 | MIT | 1978–2099 | table | 8.5 / 2.0 KB | yes |
| `nepali-date-library@1.1.16` | ~700 | MIT | 1976–2100 | table, UTC epoch; fiscal year | 20.9 / 4.4 KB | yes |
| `@inicrea/bikram-sambat-core@0.1.3` | ~340 | MIT | 1975–2100 | pure TS, `{utc: true}` option, fiscal year | 10.3 / 4.1 KB | yes |
| `world-calendars@1.0.4` (Plotly, from kbwood/calendars) | ~810,000, mostly as a dependency of `plotly.js` | MIT | 1970–2100, then a fixed default month pattern with no error | year table, Julian day via its Gregorian calendar | 23.8 KB unminified for `calendars/nepali.js` alone (measured) | no, CommonJS |

Two groups, because string APIs are dominated by parsing and formatting:

| Group | Package | BS → AD | AD → BS |
|---|---|---|---|
| numeric | medic `bikram-sambat` | `toGreg(y, m, d)` | `toBik("YYYY-MM-DD")` (string in) |
| numeric | `nepali-datetime/dateConverter` | `nepaliToEnglish(y, m0, d)` (0-based month, inferred) | `englishToNepali(y, m0, d)` |
| numeric | `@inicrea/bikram-sambat-core` | `bsToAd({year, month, day})` | `adToBs("YYYY-MM-DD", {utc: true})` |
| numeric | `nepali-date-converter` | `new NepaliDate(y, m0, d).getAD()` | `NepaliDate.fromAD(date).getBS()` |
| numeric | `world-calendars` | `nepali.newDate(y, m, d).toJD()`, then `gregorian.fromJD(jd)` | `nepali.fromJD(gregorian.newDate(y, m, d).toJD())` |
| string | `bikram-sambat-js` | `BSToAD("2076-05-08")` | `ADToBS("2019-08-25")` |
| string | `@sbmdkl/nepali-date-converter` | `bsToAd("YYYY-MM-DD")` | `adToBs("YYYY-MM-DD")` |
| string | `nepali-date-library` | `BStoAD("YYYY-MM-DD")` | `ADtoBS("YYYY-MM-DD")` |
| string | `@remotemerge/nepali-date-converter` | `new DateConverter("2080-01-15").toAd()` | `new DateConverter("2023-04-28").toBs()` |

Our numeric row is `NepaliDate.of(y, m, d).toGregorian()` / `NepaliDate.fromGregorian({year, month, day})`;
our string row is `NepaliDate.parse(s).toGregorian()` formatted to ISO. The common range of the
64 BENCHMARK dates is BS 2000-01-01 to 2090-12-30 (AD 1943-04-14 to 2034-04-13). Every package in
the table documents a BS or AD range that covers those dates. [benchmarks.md](benchmarks.md) cites
the README or code line for each range; a disagreement on a date inside the package's own range is a
mismatch, not an out-of-range result.

## Correctness and bugs seen in sources or issues

- `nepali-date-converter`: throws above 2090-12-30 (#63), nothing below 2000 (#71), AD 2027-06-22 one
  day off versus Hamro Patro (#73, provisional data); no `exports` map.
- `bikram-sambat` (medic): `toBik` uses `Date.parse` on the input (its own TODO); O(years) walk.
- `bikram-sambat-js`: `new Date("YYYY-MM-DD")` (UTC midnight) read with `getDate()` (local): wrong day
  in zones west of UTC.
- `@sbmdkl/nepali-date-converter`: results depend on the machine's zone (open PR #7).
- `nepali-datetime`: "future dates may be inaccurate" (#121), as for every table library.
- `world-calendars`: outside its 1970–2100 table it fills years with a default month pattern
  (`daysPerMonth`), so out-of-range dates come back wrong instead of failing; its downloads come
  from `plotly.js`, not from direct use.
- Every table ends by 2100, and future years are provisional everywhere, NepDate included
  (`shared/data/README.md`, 2087–2090).

## Not benchmarked

Heavy or niche: `@nepali-date-picker/core` (Kotlin/JS, 63 KB gz, has events and holidays),
`@bsday.js/core` + `@bsday.js/dataset` (Day.js style; data in a separate package, the split we also
use), `nepali-calendar-panchang` (computes tithi), `@zener/nepali-date`, `@sushill/bikram-sambat`
(estimates outside 2000–2099), `@lacspace/nepali-date`, `nepali-toolkit` (many subpaths, including a
Temporal adapter), `nepali-calendar-toolkit` (React bundle). Abandoned: `nepali-date` (2018),
`ad-bs-converter` (2017), `nepali-calendar-js` (2018).

## Name

The npm names `nepdate` and `nepdate-patro` must be checked before the first release;
fallback `nepdate-core` and `nepdate-patro`.

On 2026-10-22 the first publish of `nepdate` was refused: "Package name too similar to existing
package nep-date". The core is published as `nepdate-core`, the same name as on PyPI, and the patro
keeps `nepdate-patro` (ADR-0013).

## Sources

`https://registry.npmjs.org/<name>`, `https://api.npmjs.org/downloads/point/last-week/<name>`,
bundlephobia API, and the repositories: subeshb1/Nepali-Date, medic/bikram-sambat,
puncoz-official/bikram-sambat-js, remotemerge/nepali-date-converter,
opensource-nepal/node-nepali-datetime, sbmdkl/nepali-date-converter,
SandipGhimire/Nepali-Date-Library-NodeJS, Inicrea-Technologies-Pvt-Ltd/bikram-sambat,
plotly/world-calendars (all on GitHub); `https://api.npmjs.org/downloads/point/2026-09-28:2026-10-04/<names>`
for the 2026-10-08 recheck. On 2026-10-07 the registry returned "Not found" for `nepdate` and
`nepdate-patro`, so both names were free then. Check them again before the first release.
