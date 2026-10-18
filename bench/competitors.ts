// The B1 and B2 calls of docs/competitors.md. This module is imported only by the child process that
// measures one competitor row, so a row never pays for another package's import.

import { type GregorianDate, NepaliDate } from "nepdate";

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
const AD: GregorianDate[] = DATES.map((d) => d.toGregorian());
const BS_YEARS = DATES.map((d) => d.year);
const BS_MONTHS = DATES.map((d) => d.month);
const BS_DAYS = DATES.map((d) => d.day);
const AD_YEARS = AD.map((g) => g.year);
const AD_MONTHS = AD.map((g) => g.month);
const AD_DAYS = AD.map((g) => g.day);
const BS_STRINGS = DATES.map((d) => d.toJSON());
const AD_STRINGS = AD.map(
  (g) => `${String(g.year)}-${String(g.month).padStart(2, "0")}-${String(g.day).padStart(2, "0")}`,
);

export interface BenchInput {
  readonly bs: NepaliDate;
  readonly ad: GregorianDate;
  readonly bsIso: string;
  readonly adIso: string;
}

export const INPUTS: readonly BenchInput[] = DATES.map((bs, i) => ({
  bs,
  ad: AD[i] as GregorianDate,
  bsIso: BS_STRINGS[i] as string,
  adIso: AD_STRINGS[i] as string,
}));

export interface CompetitorImplementation {
  readonly b1: (i: number) => unknown;
  readonly b2: (i: number) => unknown;
  readonly b1Iso: (i: number) => string;
  readonly b2Iso: (i: number) => string;
}

const iso = (year: number, month: number, day: number): string =>
  `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

// biome-ignore lint/suspicious/noExplicitAny: the competitor packages ship no usable types here.
function use(namespace: Record<string, unknown>): Record<string, any> {
  // biome-ignore lint/suspicious/noExplicitAny: same, this is the CJS default export.
  return (namespace.default ?? namespace) as Record<string, any>;
}

export async function loadCompetitor(id: string): Promise<CompetitorImplementation> {
  switch (id) {
    case "nepali-date-converter@3.4.0": {
      const mod = use(await import("nepali-date-converter"));
      const NepaliDateConverter = mod.default;
      return {
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
          // getBS() returns a 0-based month; the old harness compared this to an AD date and
          // reported every B2 row as a mismatch at the first date (T6-03 fixes it).
          return iso(g.year, g.month + 1, g.date);
        },
      };
    }
    case "bikram-sambat@1.8.1": {
      const mod = use(await import("bikram-sambat"));
      return {
        b1: (i) => mod.toGreg(BS_YEARS[i], BS_MONTHS[i], BS_DAYS[i]),
        b2: (i) => mod.toBik(AD_STRINGS[i]),
        b1Iso: (i) => {
          const g = mod.toGreg(BS_YEARS[i], BS_MONTHS[i], BS_DAYS[i]);
          return iso(g.year, g.month, g.day);
        },
        b2Iso: (i) => {
          const g = mod.toBik(AD_STRINGS[i]);
          return iso(g.year, g.month, g.day);
        },
      };
    }
    case "bikram-sambat-js@1.0.3": {
      const mod = use(await import("bikram-sambat-js"));
      return {
        b1: (i) => mod.BSToAD(BS_STRINGS[i]),
        b2: (i) => mod.ADToBS(AD_STRINGS[i]),
        b1Iso: (i) => String(mod.BSToAD(BS_STRINGS[i])),
        b2Iso: (i) => String(mod.ADToBS(AD_STRINGS[i])),
      };
    }
    case "@remotemerge/nepali-date-converter@1.2.1": {
      const mod = use(await import("@remotemerge/nepali-date-converter"));
      // The package's default export is the constructor itself, not a namespace with a default.
      interface RemoteDate {
        readonly year: number;
        readonly month: number;
        readonly date: number;
      }
      const DateConverter = mod as unknown as new (
        value: string,
      ) => {
        toAd(): RemoteDate;
        toBs(): RemoteDate;
      };
      return {
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
      };
    }
    case "nepali-datetime@2.0.0": {
      const mod = use(await import("nepali-datetime/dateConverter"));
      return {
        b1: (i) => mod.nepaliToEnglish(BS_YEARS[i], BS_MONTHS[i] - 1, BS_DAYS[i]),
        b2: (i) => mod.englishToNepali(AD_YEARS[i], AD_MONTHS[i] - 1, AD_DAYS[i]),
        b1Iso: (i) => {
          const [year, month, day] = mod.nepaliToEnglish(BS_YEARS[i], BS_MONTHS[i] - 1, BS_DAYS[i]);
          return iso(year, month + 1, day);
        },
        b2Iso: (i) => {
          const [year, month, day] = mod.englishToNepali(AD_YEARS[i], AD_MONTHS[i] - 1, AD_DAYS[i]);
          return iso(year, month + 1, day);
        },
      };
    }
    case "@sbmdkl/nepali-date-converter@2.0.5": {
      const mod = use(await import("@sbmdkl/nepali-date-converter"));
      return {
        b1: (i) => mod.bsToAd(BS_STRINGS[i]),
        b2: (i) => mod.adToBs(AD_STRINGS[i]),
        b1Iso: (i) => String(mod.bsToAd(BS_STRINGS[i])),
        b2Iso: (i) => String(mod.adToBs(AD_STRINGS[i])),
      };
    }
    case "nepali-date-library@1.1.16": {
      const mod = use(await import("nepali-date-library"));
      return {
        b1: (i) => mod.BStoAD(BS_STRINGS[i]),
        b2: (i) => mod.ADtoBS(AD_STRINGS[i]),
        b1Iso: (i) => String(mod.BStoAD(BS_STRINGS[i])),
        b2Iso: (i) => String(mod.ADtoBS(AD_STRINGS[i])),
      };
    }
    case "@inicrea/bikram-sambat-core@0.1.3": {
      const mod = use(await import("@inicrea/bikram-sambat-core"));
      return {
        b1: (i) => mod.bsToAd({ year: BS_YEARS[i], month: BS_MONTHS[i], day: BS_DAYS[i] }),
        b2: (i) => mod.adToBs(AD_STRINGS[i], { utc: true }),
        b1Iso: (i) =>
          String(mod.bsToAdIso({ year: BS_YEARS[i], month: BS_MONTHS[i], day: BS_DAYS[i] })),
        b2Iso: (i) => {
          const g = mod.adToBs(AD_STRINGS[i], { utc: true });
          return iso(g.year, g.month, g.day);
        },
      };
    }
    case "world-calendars@1.0.4": {
      const mod = use(await import("world-calendars"));
      const NepaliCalendar = mod.calendars.nepali;
      const GregorianCalendar = mod.calendars.gregorian;
      const nepaliCalendar = new NepaliCalendar();
      const gregorianCalendar = new GregorianCalendar();
      return {
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
      };
    }
    default:
      throw new Error(`no implementation for ${id}`);
  }
}
