<p align="center">
  <img src="https://raw.githubusercontent.com/sanamhub/nepdate-typescript/main/docs/assets/nepdate-typescript-128.png" width="128" alt="NepDate for TypeScript logo">
</p>

<h1 align="center">nepdate-typescript</h1>

<p align="center">
  <a href="https://github.com/sanamhub/nepdate-typescript/actions/workflows/ci.yml"><img src="https://github.com/sanamhub/nepdate-typescript/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/nepdate"><img src="https://img.shields.io/npm/v/nepdate/beta?logo=npm&label=nepdate" alt="nepdate on npm"></a>
  <a href="https://www.npmjs.com/package/nepdate-patro"><img src="https://img.shields.io/npm/v/nepdate-patro/beta?logo=npm&label=nepdate-patro" alt="nepdate-patro on npm"></a>
  <a href="https://github.com/sanamhub/nepdate-typescript/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT"></a>
</p>

Bikram Sambat (Nepali calendar) for TypeScript and JavaScript. Part of the NepDate family: shared
data and spec live in the hub [`sanamhub/nepdate`](https://github.com/sanamhub/nepdate); the C#
original is [NepDate](https://github.com/RajuPrasai/NepDate).

Two npm packages, released together with the same version:

- [`nepdate`](https://www.npmjs.com/package/nepdate): dates, conversion, arithmetic, formatting and
  parsing. ESM only, types included, zero dependencies, no event data.
- [`nepdate-patro`](https://www.npmjs.com/package/nepdate-patro): the patro (पात्रो, the Nepali
  almanac): tithi, public holidays and events from BS 2077-01-01 to 2084-08-20. It needs `nepdate`
  as a peer dependency.

Pure TypeScript, no WASM and no time zone guessing. BS 1901-01-01 to 2199-12-30 (AD 1844-04-11 to
2143-04-15). Node 22.12.0 and later (the floor is tested in CI), Deno, Bun and current browsers.

> **Status:** 0.1.0-beta.1, the first public pre-release, on the `beta` dist-tag. The API is listed
> in [docs/API.md](https://github.com/sanamhub/nepdate-typescript/blob/main/docs/API.md) and may
> still change before 0.1.0. Patro data (tithi, holidays, events) is informational, not an official
> calendar.

```bash
npm install nepdate@beta
```

## Quick start (Node, Bun, bundlers)

```ts
import { NepaliDate } from "nepdate";

const republicDay = NepaliDate.of(2081, 2, 15);
console.log(republicDay.toGregorian()); // { year: 2024, month: 5, day: 28 }
console.log(republicDay.toJSON()); // "2081-02-15"
console.log(republicDay.long({ weekday: true })); // "Tuesday, Jestha 15, 2081"
```

`toJSON()` is the interchange form, `"YYYY-MM-DD"`. `toString()` is the display form,
`"YYYY/MM/DD"`. Months are 1-based everywhere.

## Quick start (Deno)

```ts
import { NepaliDate } from "npm:nepdate@0.1.0-beta.1";

console.log(NepaliDate.of(2081, 2, 15).toJSON()); // "2081-02-15"
```

## Quick start (browser)

```html
<script type="module">
  import { NepaliDate } from "https://esm.sh/nepdate@0.1.0-beta.1";
  document.body.textContent = NepaliDate.of(2081, 2, 15).toJSON();
</script>
```

## Temporal interop

`GregorianDate` is structural: a `Temporal.PlainDate` satisfies it, so no Temporal dependency is
needed. `fromJSDate` and `toJSDate` take an explicit zone because a `Date` holds an instant, not a
calendar day.

```ts
import { NepaliDate } from "nepdate";

if (globalThis.Temporal !== undefined) {
  const date = NepaliDate.fromGregorian(Temporal.PlainDate.from("2024-07-30"));
  console.log(date.toJSON()); // "2081-04-15"
  console.log(Temporal.PlainDate.from(date.toGregorian()).toString()); // "2024-07-30"
}
```

`today(timeZone = "Asia/Kathmandu")` reads the clock through `Intl.DateTimeFormat` with that zone,
so the machine's own zone never changes the answer.

## Patro (tithi, holidays, events)

Install both packages:

```bash
npm install nepdate@beta nepdate-patro@beta
```

```ts
import { NepaliDate } from "nepdate";
import { info } from "nepdate-patro";

const day = info(NepaliDate.of(2081, 2, 15));
console.log(day.isPublicHoliday); // true
console.log(day.tithi?.en); // "Panchami"
console.log(day.events.map((event) => event.en)); // ["Republic Day"]
```

`info()` never fails: a day without data returns the shared empty object (`tithi: null`,
`isPublicHoliday: false`, `events: []`). `coverage()` gives the range with any data and
`publicHolidays()` yields the holiday dates in ascending order.

## More

| Topic | Where |
|---|---|
| Every exported name | [docs/API.md](https://github.com/sanamhub/nepdate-typescript/blob/main/docs/API.md) |
| Why it is built this way | [docs/adr](https://github.com/sanamhub/nepdate-typescript/tree/main/docs/adr) |
| Speed and bundle size, with the C# baseline | [docs/benchmarks.md](https://github.com/sanamhub/nepdate-typescript/blob/main/docs/benchmarks.md) |
| What changed in each version | [CHANGELOG.md](https://github.com/sanamhub/nepdate-typescript/blob/main/CHANGELOG.md) |
| Building, gates and pull requests | [CONTRIBUTING.md](https://github.com/sanamhub/nepdate-typescript/blob/main/CONTRIBUTING.md) |
| Reporting a vulnerability | [SECURITY.md](https://github.com/sanamhub/nepdate-typescript/blob/main/SECURITY.md) |
| A wrong date, holiday or tithi | the hub's [data error form](https://github.com/sanamhub/nepdate/issues/new/choose) |
| The other languages | [sanamhub/nepdate](https://github.com/sanamhub/nepdate#packages) |

The calendar data is a read-only copy of the hub's `shared/data/`. Month lengths beyond the
officially published calendar are projections inherited from C# NepDate.

## License

MIT ([LICENSE](https://github.com/sanamhub/nepdate-typescript/blob/main/LICENSE)). Calendar data
from NepDate by Raju Prasai and contributors, MIT
([NOTICE](https://github.com/sanamhub/nepdate-typescript/blob/main/shared/data/NOTICE)). Not
affiliated with the Government of Nepal.
