// Benchmarks of nepdate's own operations (shared/spec/BENCHMARK.md). Build first, then run pinned
// to logical CPU 2 from the repository root:
//   npm run build
//   cmd /c "start /affinity 4 /wait /b node --expose-gc bench/own.ts"
// B1 to B6 run over the 64 dates of BENCHMARK §2; B7 and B8 over the 64 dates moved into the
// patro coverage (BENCHMARK §3). Each operation runs over all 64 inputs; times are per operation.

import { do_not_optimize, measure } from "mitata";
import { type GregorianDate, NepaliDate } from "nepdate";
import { coverage, info } from "nepdate-patro";

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
// Plain arrays and index loops, so the loop itself costs as little as possible.
const YEARS = DATES.map((d) => d.year);
const MONTHS = DATES.map((d) => d.month);
const DAYS = DATES.map((d) => d.day);
const AD: GregorianDate[] = DATES.map((d) => d.toGregorian());
const STRINGS = DATES.map((d) => d.toString());

// BENCHMARK §3: B7 and B8 use the 64 dates moved into the patro coverage.
const PATRO_FIRST = serialOf(coverage().start);
const PATRO_LAST = serialOf(coverage().end);
const patroStep = Math.floor((PATRO_LAST - PATRO_FIRST) / 63);
const PATRO_DATES = Array.from({ length: 64 }, (_, i) => atSerial(PATRO_FIRST + i * patroStep));
const PATRO_YEARS = PATRO_DATES.map((d) => d.year);
const PATRO_MONTHS = PATRO_DATES.map((d) => d.month);
const PATRO_LENGTHS = PATRO_DATES.map((d) => d.monthLength);

const operations: [id: string, name: string, body: () => void][] = [
  [
    "B1",
    "BS to AD: of(y, m, d).toGregorian()",
    () => {
      for (let i = 0; i < 64; i++) {
        do_not_optimize(
          NepaliDate.of(YEARS[i] as number, MONTHS[i] as number, DAYS[i] as number).toGregorian(),
        );
      }
    },
  ],
  [
    "B2",
    "AD to BS: fromGregorian(g)",
    () => {
      for (let i = 0; i < 64; i++)
        do_not_optimize(NepaliDate.fromGregorian(AD[i] as GregorianDate));
    },
  ],
  [
    "B3",
    "addDays(1000)",
    () => {
      for (let i = 0; i < 64; i++) do_not_optimize((DATES[i] as NepaliDate).addDays(1000));
    },
  ],
  [
    "B4",
    "addMonths(13) clamp",
    () => {
      for (let i = 0; i < 64; i++) do_not_optimize((DATES[i] as NepaliDate).addMonths(13));
    },
  ],
  [
    "B5",
    "long({weekday: true, lang: 'ne'})",
    () => {
      for (let i = 0; i < 64; i++) {
        const text = (DATES[i] as NepaliDate).long({ weekday: true, lang: "ne" });
        do_not_optimize(text.charCodeAt(text.length - 1));
      }
    },
  ],
  [
    "B6",
    "parse('YYYY/MM/DD')",
    () => {
      for (let i = 0; i < 64; i++) do_not_optimize(NepaliDate.parse(STRINGS[i] as string));
    },
  ],
  [
    "B7",
    "patro info(date)",
    () => {
      for (let i = 0; i < 64; i++) do_not_optimize(info(PATRO_DATES[i] as NepaliDate));
    },
  ],
  [
    "B8",
    "month grid: of + info for every day",
    () => {
      for (let i = 0; i < 64; i++) {
        const year = PATRO_YEARS[i] as number;
        const month = PATRO_MONTHS[i] as number;
        for (let day = 1; day <= (PATRO_LENGTHS[i] as number); day++) {
          do_not_optimize(info(NepaliDate.of(year, month, day)));
        }
      }
    },
  ],
];

console.log(`node ${process.version}, ${DATES.length} dates, gc exposed: ${"gc" in globalThis}`);
for (const [id, name, body] of operations) {
  const stats = await measure(body, { heap: () => process.memoryUsage().heapUsed });
  const ns = (stats.avg / DATES.length).toFixed(1);
  const heap = stats.heap === undefined ? "n/a" : `${(stats.heap.avg / DATES.length).toFixed(0)} B`;
  console.log(`${id}  ${ns} ns/op  heap ${heap}/op (approximate)  ${name}`);
}
