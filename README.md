<p align="center">
  <img src="https://raw.githubusercontent.com/sanamhub/nepdate-typescript/main/docs/assets/nepdate-typescript-128.png" width="128" alt="NepDate for TypeScript logo">
</p>

<h1 align="center">nepdate-typescript</h1>

<p align="center">
  <a href="https://github.com/sanamhub/nepdate-typescript/actions/workflows/ci.yml"><img src="https://github.com/sanamhub/nepdate-typescript/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/nepdate-core"><img src="https://img.shields.io/npm/v/nepdate-core/rc?logo=npm&label=nepdate-core" alt="nepdate-core on npm"></a>
  <a href="https://www.npmjs.com/package/nepdate-patro"><img src="https://img.shields.io/npm/v/nepdate-patro/rc?logo=npm&label=nepdate-patro" alt="nepdate-patro on npm"></a>
  <a href="https://github.com/sanamhub/nepdate-typescript/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT"></a>
</p>

Bikram Sambat (Nepali calendar) for TypeScript and JavaScript. Part of the NepDate family: shared
data and spec live in the hub [`sanamhub/nepdate`](https://github.com/sanamhub/nepdate); the C#
original is [NepDate](https://github.com/RajuPrasai/NepDate).

Two npm packages, `nepdate-core` and `nepdate-patro`, released together with the same version:

- [`nepdate-core`](https://www.npmjs.com/package/nepdate-core): dates, conversion, arithmetic, formatting,
  parsing, ranges and fiscal years. ESM only, types included, zero dependencies, no event data.
- [`nepdate-patro`](https://www.npmjs.com/package/nepdate-patro): the patro (पात्रो, the Nepali
  almanac): tithi, public holidays and events from BS 2077-01-01 to 2084-08-20. It needs `nepdate-core`
  as a peer dependency.

A third package, [`nepdate-datepicker`](https://www.npmjs.com/package/nepdate-datepicker), is a BS
date picker as web components (a calendar and a form input). It has its own version and releases on
its own `datepicker-v*` tag.

Pure TypeScript, no WASM and no time zone guessing. BS 1901-01-01 to 2199-12-30 (AD 1844-04-11 to
2143-04-15). Node 22.12.0 and later (the floor is tested in CI), Deno, Bun and current browsers.

> **Status:** 0.2.0-rc.1, a release candidate, on the `rc` dist-tag. The API is listed
> in [docs/API.md](https://github.com/sanamhub/nepdate-typescript/blob/main/docs/API.md) and may
> still change before 0.2.0. Patro data (tithi, holidays, events) is informational, not an official
> calendar.

```bash
npm install nepdate-core@rc
```

## Quick start (Node, Bun, bundlers)

```ts
import { NepaliDate } from "nepdate-core";

const republicDay = NepaliDate.of(2081, 2, 15);
console.log(republicDay.toGregorian()); // { year: 2024, month: 5, day: 28 }
console.log(republicDay.toJSON()); // "2081-02-15"
console.log(republicDay.long({ weekday: true })); // "Tuesday, Jestha 15, 2081"
```

`toJSON()` is the interchange form, `"YYYY-MM-DD"`. `toString()` is the display form,
`"YYYY/MM/DD"`. Months are 1-based everywhere.

## Quick start (Deno)

```ts
import { NepaliDate } from "npm:nepdate-core@0.2.0-rc.1";

console.log(NepaliDate.of(2081, 2, 15).toJSON()); // "2081-02-15"
```

## Quick start (browser)

```html
<script type="module">
  import { NepaliDate } from "https://esm.sh/nepdate-core@0.2.0-rc.1";
  document.body.textContent = NepaliDate.of(2081, 2, 15).toJSON();
</script>
```

## Dates, identity and comparison

A date is a value: `year`, `month` and `day` are read-only getters over a private day count, so a
JavaScript caller cannot change one and leave the date inconsistent. `compare` sorts, `equals`
answers for a date and returns `false` for anything else.

```ts
import { NepaliDate } from "nepdate-core";

const date = NepaliDate.of(2081, 4, 15);
console.log([date.year, date.month, date.day]); // [2081, 4, 15]
console.log(date.weekday, date.dayOfYear, date.monthLength, date.yearLength); // 2 109 32 366
console.log(date.lastOfMonth().toJSON()); // "2081-04-32"
console.log(NepaliDate.MIN.toJSON(), NepaliDate.MAX.toJSON()); // "1901-01-01" "2199-12-30"
console.log(date.isToday("Asia/Kathmandu")); // true only when today is 2081-04-15
```

## Conversion and serialization

`fromGregorian` and `toGregorian` use a structural `{ year, month, day }`, so a `Temporal.PlainDate`
fits both ways. `fromJSDate` and `toJSDate` take the zone because a `Date` holds an instant, not a
calendar day. Batch conversion is one ordered call each way.

```ts
import { NepaliDate } from "nepdate-core";

const date = NepaliDate.of(2081, 4, 15);
console.log(date.toGregorian()); // { year: 2024, month: 7, day: 30 }
console.log(date.toJSON()); // "2081-04-15"
console.log(NepaliDate.fromJSON('"2081-04-15"').toYmd()); // 20810415
console.log(NepaliDate.fromYmd(20810415).toJSON()); // "2081-04-15"
console.log(NepaliDate.toNepaliDates([{ year: 2024, month: 7, day: 30 }])[0]?.toJSON()); // "2081-04-15"
console.log(NepaliDate.toEnglishDates(["2081-04-15"])); // [{ year: 2024, month: 7, day: 30 }]
```

The `YYYYMMDD` integer form (`fromYmd`, `toYmd`) is there for systems that store a date as one
number. Keep `toJSON()` for interchange: the integer is not self-describing.

## Arithmetic

`addDays` takes a whole number of days, `addMonths` and `addYears` a whole number of months or
years. When the target month is shorter, the default clamps to its last day; `"spill"` carries the
extra days into the next month.

```ts
import { NepaliDate } from "nepdate-core";

const date = NepaliDate.of(2081, 4, 32);
console.log(date.addMonths(2).toJSON()); // "2081-06-30"
console.log(date.addMonths(2, "spill").toJSON()); // "2081-07-02"
console.log(date.addDays(-1).toJSON()); // "2081-04-31"
console.log(NepaliDate.of(2081, 4, 15).daysUntil(NepaliDate.of(2081, 4, 20))); // 5
console.log(NepaliDate.of(2081, 4, 15).diff(NepaliDate.of(2082, 4, 15)).years); // 1
```

`daysUntil(other)` is `other - this`. There is no `-` operator: use `daysUntil` in the direction you
mean, and `other.daysUntil(this)` where C# would write `this - other`.

## Formatting

Three ways to shape the text: the field order with `short`, the words with `long`, and a pattern with
`format`. Every one of them takes `lang: "ne"` for Devanagari names and digits.

```ts
import { monthName, NepaliDate } from "nepdate-core";

const date = NepaliDate.of(2081, 4, 15);
console.log(date.toString()); // "2081/04/15"
console.log(date.short({ order: "dmy", separator: "-", pad: false })); // "15-4-2081"
console.log(date.long({ weekday: true })); // "Tuesday, Shrawan 15, 2081"
console.log(date.format("MMM yyyy")); // "Shr 2081"
console.log(date.long({ weekday: true, lang: "ne" })); // "मङ्गलवार, साउन १५, २०८१"
console.log(monthName(4), monthName(4, "ne")); // "Shrawan" "साउन"
```

## Parsing

The strict parser takes year, month and day in that order and accepts ASCII or Devanagari digits.
The lenient parser also accepts a month name from the closed list in `shared/spec/PARSING.md`. Each
has a non-throwing form that returns `null`.

```ts
import { NepaliDate } from "nepdate-core";

console.log(NepaliDate.parse("2081-04-15").toJSON()); // "2081-04-15"
console.log(NepaliDate.parseLenient("15 Shrawan 2081").toJSON()); // "2081-04-15"
console.log(NepaliDate.tryParse("2081-13-01")); // null
console.log(NepaliDate.tryParseLenient("not a date")); // null
```

## Ranges

`DateRange` is inclusive and never empty. It has the set operations, the month and fiscal-quarter
splits, working and weekend days, and both string forms.

```ts
import { DateRange, NepaliDate } from "nepdate-core";

const month = DateRange.month(2081, 4);
console.log(month.length); // 32
console.log(month.toString()); // "2081/04/01 - 2081/04/32"
console.log(month.splitByMonth().length); // 1
console.log(DateRange.fromDayCount(NepaliDate.of(2081, 4, 15), 5).toString()); // "2081/04/15 - 2081/04/19"
console.log(DateRange.currentMonth("Asia/Kathmandu").contains(NepaliDate.today("Asia/Kathmandu"))); // true
console.log(month.intersect(DateRange.month(2081, 5))); // null
```

## Fiscal year

A fiscal year starts on 1 Shrawan and ends on the last day of Ashad of the next BS year. The value
gives the start, the end, the range, the four quarters and the `2082/83` label.

```ts
import { NepaliDate } from "nepdate-core";

const fiscal = NepaliDate.of(2082, 5, 1).fiscalYear();
console.log(fiscal.label()); // "2082/83"
console.log(fiscal.start().toJSON(), fiscal.end().toJSON()); // "2082-04-01" "2083-03-32"
console.log(fiscal.quarterRange(1).toString()); // "2082/04/01 - 2082/06/31"
console.log(NepaliDate.of(2082, 8, 1).quarter()); // 2
```

## Errors

One error type, `NepDateError`, with a `kind` that says which check failed. It extends `Error`, so
`instanceof Error` holds; an unknown time zone is reported as `"invalid-zone"` rather than a raw
`Intl` `RangeError`.

```ts
import { NepDateError, NepaliDate } from "nepdate-core";

try {
  NepaliDate.of(2081, 4, 33);
} catch (error) {
  console.log(error instanceof NepDateError); // true
  console.log((error as NepDateError).kind); // "invalid-day"
}
```

## Temporal interop

`GregorianDate` is structural: a `Temporal.PlainDate` satisfies it, so no Temporal dependency is
needed. `fromJSDate` and `toJSDate` take an explicit zone because a `Date` holds an instant, not a
calendar day.

```ts
import { NepaliDate } from "nepdate-core";

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
npm install nepdate-core@rc nepdate-patro@rc
```

```ts
import { NepaliDate } from "nepdate-core";
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
| Guide and examples | [nepdate.com/docs/typescript](https://nepdate.com/docs/typescript/) |
| The date picker | [nepdate.com/docs/datepicker](https://nepdate.com/docs/datepicker/) |
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
