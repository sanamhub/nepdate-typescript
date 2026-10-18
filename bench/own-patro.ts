// B7 and B8 of BENCHMARK §3 for nepdate-patro. Loaded only by the child that measures one of these
// rows, so the core-only rows never import the patro tables.

import { do_not_optimize } from "mitata";
import { NepaliDate } from "nepdate";
import { coverage, info } from "nepdate-patro";
import type { CoreOp } from "./own-core.ts";

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

const PATRO_FIRST = serialOf(coverage().start);
const PATRO_LAST = serialOf(coverage().end);
const patroStep = Math.floor((PATRO_LAST - PATRO_FIRST) / 63);
const PATRO_DATES = Array.from({ length: 64 }, (_, i) => atSerial(PATRO_FIRST + i * patroStep));
const PATRO_YEARS = PATRO_DATES.map((d) => d.year);
const PATRO_MONTHS = PATRO_DATES.map((d) => d.month);
const PATRO_LENGTHS = PATRO_DATES.map((d) => d.monthLength);

export const PATRO_OPS: readonly CoreOp[] = [
  {
    id: "B7",
    name: "patro info(date)",
    n: 64,
    run: () => {
      for (let i = 0; i < 64; i++) do_not_optimize(info(PATRO_DATES[i] as NepaliDate));
    },
  },
  {
    id: "B8",
    name: "month grid: of + info for every day",
    n: 64,
    run: () => {
      for (let i = 0; i < 64; i++) {
        const year = PATRO_YEARS[i] as number;
        const month = PATRO_MONTHS[i] as number;
        for (let day = 1; day <= (PATRO_LENGTHS[i] as number); day++) {
          do_not_optimize(info(NepaliDate.of(year, month, day)));
        }
      }
    },
  },
];
