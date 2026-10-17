// B1 and B2 of shared/spec/BENCHMARK.md for every package in docs/competitors.md, on the 64 dates
// of BENCHMARK §2. Build first, then run pinned to logical CPU 2 from the repository root:
//   npm run build
//   cmd /c "start /affinity 4 /wait /b node --expose-gc bench/compare.ts"
// `--check` only prints the agreement result, without measuring.

import * as inicrea from "@inicrea/bikram-sambat-core";
import * as remoteMergeModule from "@remotemerge/nepali-date-converter";
import * as sbmdkl from "@sbmdkl/nepali-date-converter";
import * as bikramSambat from "bikram-sambat";
import * as bikramSambatJs from "bikram-sambat-js";
import { do_not_optimize, measure } from "mitata";
import * as nepaliDateConverterModule from "nepali-date-converter";
import * as nepaliDateLibraryModule from "nepali-date-library";
import * as nepaliDateTimeModule from "nepali-datetime/dateConverter";
import { type GregorianDate, NepaliDate } from "nepdate";
import * as worldCalendarsModule from "world-calendars";
import { machineLoad } from "./load.ts";

const DAY_MS = 86_400_000;
const EPOCH_DAYS = Date.UTC(1844, 3, 11) / DAY_MS;

function serialOf(date: NepaliDate): number {
  const g = date.toGregorian();
  return Date.UTC(g.year, g.month - 1, g.day) / DAY_MS - EPOCH_DAYS;
}

function atSerial(serial: number): NepaliDate {
  const d = new Date((serial + EPOCH_DAYS) * DAY_MS);
  return NepaliDate.fromGregorian({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  });
}

const s0 = serialOf(NepaliDate.of(2000, 1, 1));
const s1 = serialOf(NepaliDate.of(2090, 12, 30));
const step = Math.floor((s1 - s0) / 63);
const DATES: NepaliDate[] = Array.from({ length: 64 }, (_, i) => atSerial(s0 + i * step));
const BS_YEARS = DATES.map((d) => d.year);
const BS_MONTHS = DATES.map((d) => d.month);
const BS_DAYS = DATES.map((d) => d.day);
const AD: GregorianDate[] = DATES.map((d) => d.toGregorian());
const AD_YEARS = AD.map((g) => g.year);
const AD_MONTHS = AD.map((g) => g.month);
const AD_DAYS = AD.map((g) => g.day);
const BS_STRINGS = DATES.map((d) => d.toJSON());
const AD_STRINGS = AD.map(
  (g) => `${String(g.year)}-${String(g.month).padStart(2, "0")}-${String(g.day).padStart(2, "0")}`,
);
const EXPECTED = AD_STRINGS;

const iso = (year: number, month: number, day: number): string =>
  `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

interface Competitor {
  readonly name: string;
  readonly b1: (i: number) => unknown;
  readonly b2: (i: number) => unknown;
  readonly b1Iso: (i: number) => string;
  readonly b2Iso: (i: number) => string;
}

// biome-ignore lint/suspicious/noExplicitAny: the competitor packages ship no usable types here.
function use(namespace: Record<string, unknown>): Record<string, any> {
  // biome-ignore lint/suspicious/noExplicitAny: same, this is the CJS default export.
  return (namespace.default ?? namespace) as Record<string, any>;
}

const NepaliDateConverter = use(
  nepaliDateConverterModule as unknown as Record<string, unknown>,
).default;
const DateConverter = use(remoteMergeModule as unknown as Record<string, unknown>);
const dateConverter = use(nepaliDateTimeModule as unknown as Record<string, unknown>);
const library = use(nepaliDateLibraryModule as unknown as Record<string, unknown>);
const worldCalendars = use(worldCalendarsModule as unknown as Record<string, unknown>);
const NepaliCalendar = worldCalendars.calendars.nepali;
const GregorianCalendar = worldCalendars.calendars.gregorian;
const nepaliCalendar = new NepaliCalendar();
const gregorianCalendar = new GregorianCalendar();

const competitors: Competitor[] = [
  {
    name: "nepali-date-converter@3.4.0",
    b1: (i) => new NepaliDateConverter(BS_YEARS[i], BS_MONTHS[i] - 1, BS_DAYS[i]).getAD(),
    b2: (i) =>
      NepaliDateConverter.fromAD(new Date(AD_YEARS[i], AD_MONTHS[i] - 1, AD_DAYS[i])).getBS(),
    b1Iso: (i) => {
      const g = new NepaliDateConverter(BS_YEARS[i], BS_MONTHS[i] - 1, BS_DAYS[i]).getAD();
      return iso(g.year, g.month + 1, g.date);
    },
    b2Iso: (i) => {
      const g = NepaliDateConverter.fromAD(
        new Date(AD_YEARS[i], AD_MONTHS[i] - 1, AD_DAYS[i]),
      ).getBS();
      return iso(g.year, g.month, g.date);
    },
  },
  {
    name: "bikram-sambat@1.8.1",
    b1: (i) => bikramSambat.toGreg(BS_YEARS[i], BS_MONTHS[i], BS_DAYS[i]),
    b2: (i) => bikramSambat.toBik(AD_STRINGS[i]),
    b1Iso: (i) => {
      const g = bikramSambat.toGreg(BS_YEARS[i], BS_MONTHS[i], BS_DAYS[i]);
      return iso(g.year, g.month, g.day);
    },
    b2Iso: (i) => {
      const g = bikramSambat.toBik(AD_STRINGS[i]);
      return iso(g.year, g.month, g.day);
    },
  },
  {
    name: "bikram-sambat-js@1.0.3",
    b1: (i) => bikramSambatJs.BSToAD(BS_STRINGS[i]),
    b2: (i) => bikramSambatJs.ADToBS(AD_STRINGS[i]),
    b1Iso: (i) => String(bikramSambatJs.BSToAD(BS_STRINGS[i])),
    b2Iso: (i) => String(bikramSambatJs.ADToBS(AD_STRINGS[i])),
  },
  {
    name: "@remotemerge/nepali-date-converter@1.2.1",
    b1: (i) => new DateConverter(BS_STRINGS[i]).toAd(),
    b2: (i) => new DateConverter(AD_STRINGS[i]).toBs(),
    b1Iso: (i) => {
      const g = new DateConverter(BS_STRINGS[i]).toAd();
      return iso(g.year, g.month, g.date);
    },
    b2Iso: (i) => {
      const g = new DateConverter(AD_STRINGS[i]).toBs();
      return iso(g.year, g.month, g.date);
    },
  },
  {
    name: "nepali-datetime@2.0.0",
    b1: (i) => dateConverter.nepaliToEnglish(BS_YEARS[i], BS_MONTHS[i] - 1, BS_DAYS[i]),
    b2: (i) => dateConverter.englishToNepali(AD_YEARS[i], AD_MONTHS[i] - 1, AD_DAYS[i]),
    b1Iso: (i) => {
      const [year, month, day] = dateConverter.nepaliToEnglish(
        BS_YEARS[i],
        BS_MONTHS[i] - 1,
        BS_DAYS[i],
      );
      return iso(year, month + 1, day);
    },
    b2Iso: (i) => {
      const [year, month, day] = dateConverter.englishToNepali(
        AD_YEARS[i],
        AD_MONTHS[i] - 1,
        AD_DAYS[i],
      );
      return iso(year, month + 1, day);
    },
  },
  {
    name: "@sbmdkl/nepali-date-converter@2.0.5",
    b1: (i) => sbmdkl.bsToAd(BS_STRINGS[i]),
    b2: (i) => sbmdkl.adToBs(AD_STRINGS[i]),
    b1Iso: (i) => String(sbmdkl.bsToAd(BS_STRINGS[i])),
    b2Iso: (i) => String(sbmdkl.adToBs(AD_STRINGS[i])),
  },
  {
    name: "nepali-date-library@1.1.16",
    b1: (i) => library.BStoAD(BS_STRINGS[i]),
    b2: (i) => library.ADtoBS(AD_STRINGS[i]),
    b1Iso: (i) => String(library.BStoAD(BS_STRINGS[i])),
    b2Iso: (i) => String(library.ADtoBS(AD_STRINGS[i])),
  },
  {
    name: "@inicrea/bikram-sambat-core@0.1.3",
    b1: (i) => inicrea.bsToAd({ year: BS_YEARS[i], month: BS_MONTHS[i], day: BS_DAYS[i] }),
    b2: (i) => inicrea.adToBs(AD_STRINGS[i], { utc: true }),
    b1Iso: (i) =>
      String(inicrea.bsToAdIso({ year: BS_YEARS[i], month: BS_MONTHS[i], day: BS_DAYS[i] })),
    b2Iso: (i) => {
      const g = inicrea.adToBs(AD_STRINGS[i], { utc: true });
      return iso(g.year, g.month, g.day);
    },
  },
  {
    name: "world-calendars@1.0.4",
    b1: (i) => {
      const jd = nepaliCalendar.newDate(BS_YEARS[i], BS_MONTHS[i], BS_DAYS[i]).toJD();
      return gregorianCalendar.fromJD(jd);
    },
    b2: (i) =>
      nepaliCalendar.fromJD(
        gregorianCalendar.newDate(AD_YEARS[i], AD_MONTHS[i], AD_DAYS[i]).toJD(),
      ),
    b1Iso: (i) => {
      const jd = nepaliCalendar.newDate(BS_YEARS[i], BS_MONTHS[i], BS_DAYS[i]).toJD();
      const g = gregorianCalendar.fromJD(jd);
      return iso(g.year(), g.month(), g.day());
    },
    b2Iso: (i) => {
      const g = nepaliCalendar.fromJD(
        gregorianCalendar.newDate(AD_YEARS[i], AD_MONTHS[i], AD_DAYS[i]).toJD(),
      );
      return iso(g.year(), g.month(), g.day());
    },
  },
];

function agreement(competitor: Competitor): {
  b1: boolean;
  b2: boolean;
  b1Works: boolean;
  b2Works: boolean;
  firstB1?: string;
  firstB2?: string;
} {
  let b1 = true;
  let b2 = true;
  let b1Works = true;
  let b2Works = true;
  let firstB1: string | undefined;
  let firstB2: string | undefined;
  for (let i = 0; i < 64; i++) {
    const expected = EXPECTED[i];
    let actual: string;
    try {
      actual = competitor.b1Iso(i);
    } catch (error) {
      actual = `throws ${String(error)}`;
      b1Works = false;
    }
    if (actual !== expected) {
      b1 = false;
      firstB1 ??= `${BS_STRINGS[i]}: ${actual}, expected ${expected}`;
    }
    try {
      actual = competitor.b2Iso(i);
    } catch (error) {
      actual = `throws ${String(error)}`;
      b2Works = false;
    }
    if (actual !== expected) {
      b2 = false;
      firstB2 ??= `${AD_STRINGS[i]}: ${actual}, expected ${expected}`;
    }
  }
  return {
    b1,
    b2,
    b1Works,
    b2Works,
    ...(firstB1 === undefined ? {} : { firstB1 }),
    ...(firstB2 === undefined ? {} : { firstB2 }),
  };
}

const checkOnly = process.argv.includes("--check");
console.log(`node ${process.version}, 64 dates, gc exposed: ${"gc" in globalThis}`);
for (const competitor of competitors) {
  const agree = agreement(competitor);
  const label = `${competitor.name}  B1 ${agree.b1 ? "agrees" : "DISAGREES"}  B2 ${
    agree.b2 ? "agrees" : "DISAGREES"
  }`;
  if (checkOnly) {
    const why = [
      agree.firstB1 === undefined ? "" : `B1 ${agree.firstB1}`,
      agree.firstB2 === undefined ? "" : `B2 ${agree.firstB2}`,
    ]
      .filter((part) => part !== "")
      .join("; ");
    console.log(`${label}${why === "" ? "" : `  (${why})`}`);
    continue;
  }
  for (const direction of ["B1", "B2"] as const) {
    const agrees = direction === "B1" ? agree.b1 : agree.b2;
    const works = direction === "B1" ? agree.b1Works : agree.b2Works;
    const load = await machineLoad();
    if (!works) {
      console.log(
        `${direction}  n/a  load ${load.toFixed(0)}%  DISAGREES  ${
          competitor.name
        } (out of range on the 64 dates)`,
      );
      continue;
    }
    const body = direction === "B1" ? competitor.b1 : competitor.b2;
    const stats = await measure(() => {
      for (let i = 0; i < 64; i++) do_not_optimize(body(i));
    });
    const ns = (stats.avg / 64).toFixed(1);
    console.log(
      `${direction}  ${ns} ns/op  load ${load.toFixed(0)}%  ${agrees ? "agrees" : "DISAGREES"}  ${
        competitor.name
      }`,
    );
  }
}
