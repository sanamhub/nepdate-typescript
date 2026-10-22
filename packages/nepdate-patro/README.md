<p align="center">
  <img src="https://raw.githubusercontent.com/sanamhub/nepdate-typescript/main/docs/assets/nepdate-typescript-128.png" width="128" alt="NepDate for TypeScript logo">
</p>

<h1 align="center">nepdate-patro</h1>

<p align="center">
  <a href="https://github.com/sanamhub/nepdate-typescript/actions/workflows/ci.yml"><img src="https://github.com/sanamhub/nepdate-typescript/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/nepdate-patro"><img src="https://img.shields.io/npm/v/nepdate-patro/beta?logo=npm&label=nepdate-patro" alt="nepdate-patro on npm"></a>
  <a href="https://github.com/sanamhub/nepdate-typescript/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT"></a>
</p>

The patro (पात्रो, the Nepali almanac) for
[`nepdate`](https://www.npmjs.com/package/nepdate): tithi (lunar day), gazetted public holidays and
events for each Bikram Sambat day. `nepdate-patro` needs `nepdate` as a peer dependency and shares
its version.

> **Status:** 0.1.0-beta.1, the first public pre-release, on the `beta` dist-tag. The data is
> informational, not an official calendar.

## Install

```bash
npm install nepdate@beta nepdate-patro@beta
```

## Use

```ts
import { NepaliDate } from "nepdate";
import { info } from "nepdate-patro";

const republicDay = info(NepaliDate.of(2081, 2, 15));
console.log(republicDay.isPublicHoliday); // true
console.log(republicDay.tithi?.en); // "Panchami"
console.log(republicDay.events.map((event) => event.en)); // ["Republic Day"]
```

The value objects are frozen and shared: `info(date)` returns the same object for the same day on
every call, and the event array keeps the file order. A day without data returns the shared empty
object (`tithi: null`, `isPublicHoliday: false`, `events: []`).

```ts
import { coverage, publicHolidays } from "nepdate-patro";

console.log(coverage().start.toJSON()); // "2077-01-01"
console.log(coverage().end.toJSON()); // "2084-08-20"
console.log([...publicHolidays()].length); // 294
```

## Coverage

The data covers BS 2077-01-01 to 2084-08-20 with the current files. Tithi data is shorter: BS
2078-01-02 to 2083-12-30. Outside the coverage `info()` returns the empty object, and `coverage()` is the way to
decide whether to show a "no data" message.

## Data

The calendar and patro data are extracted from C# NepDate at commit
`cb05cb65c7d3cb570c76992a8e83ed1e73213346` under the MIT License, and vendored from the hub's
`shared/data/`. Upstream does not publish the source of the tithi, holiday and event data; see
[`shared/data/README.md`](https://github.com/sanamhub/nepdate-typescript/blob/main/shared/data/README.md)
for the provenance note and the known data questions. Month lengths beyond the officially
published calendar are projections inherited from C# NepDate and may change.

## More

The rest of the documentation lives with the core package in
[sanamhub/nepdate-typescript](https://github.com/sanamhub/nepdate-typescript#readme): the API list, benchmarks, changelog and security
policy. Report a wrong holiday, tithi or event with the hub's
[data error form](https://github.com/sanamhub/nepdate/issues/new/choose).

## License

MIT. See [LICENSE](https://github.com/sanamhub/nepdate-typescript/blob/main/LICENSE) and
[NOTICE](https://github.com/sanamhub/nepdate-typescript/blob/main/shared/data/NOTICE).
