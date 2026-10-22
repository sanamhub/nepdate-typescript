// B1 to B6 of BENCHMARK §3 for nepdate-core. Loaded only by the child that measures one of these rows,
// so a row's process imports the core and nothing from the patro package.

import { do_not_optimize } from "mitata";
import { type GregorianDate, NepaliDate } from "nepdate-core";

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
const YEARS = DATES.map((d) => d.year);
const MONTHS = DATES.map((d) => d.month);
const DAYS = DATES.map((d) => d.day);
const AD: GregorianDate[] = DATES.map((d) => d.toGregorian());
const STRINGS = DATES.map((d) => d.toString());

export interface CoreOp {
  readonly id: string;
  readonly name: string;
  readonly n: number;
  readonly run: () => void;
}

export const CORE_OPS: readonly CoreOp[] = [
  {
    id: "B1",
    name: "BS to AD: of(y, m, d).toGregorian()",
    n: 64,
    run: () => {
      for (let i = 0; i < 64; i++) {
        do_not_optimize(
          NepaliDate.of(YEARS[i] as number, MONTHS[i] as number, DAYS[i] as number).toGregorian(),
        );
      }
    },
  },
  {
    id: "B2",
    name: "AD to BS: fromGregorian(g)",
    n: 64,
    run: () => {
      for (let i = 0; i < 64; i++)
        do_not_optimize(NepaliDate.fromGregorian(AD[i] as GregorianDate));
    },
  },
  {
    id: "B3",
    name: "addDays(1000)",
    n: 64,
    run: () => {
      for (let i = 0; i < 64; i++) do_not_optimize((DATES[i] as NepaliDate).addDays(1000));
    },
  },
  {
    id: "B4",
    name: "addMonths(13) clamp",
    n: 64,
    run: () => {
      for (let i = 0; i < 64; i++) do_not_optimize((DATES[i] as NepaliDate).addMonths(13));
    },
  },
  {
    id: "B5",
    name: "long({weekday: true, lang: 'ne'})",
    n: 64,
    run: () => {
      for (let i = 0; i < 64; i++) {
        const text = (DATES[i] as NepaliDate).long({ weekday: true, lang: "ne" });
        do_not_optimize(text.charCodeAt(text.length - 1));
      }
    },
  },
  {
    id: "B6",
    name: "parse('YYYY/MM/DD')",
    n: 64,
    run: () => {
      for (let i = 0; i < 64; i++) do_not_optimize(NepaliDate.parse(STRINGS[i] as string));
    },
  },
];
