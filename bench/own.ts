// Benchmarks of nepdate's own operations (shared/spec/BENCHMARK.md). Build first, then run pinned
// to logical CPU 2 from the repository root:
//   npm run build
//   cmd /c "start /affinity 4 /wait /b node --expose-gc bench/own.ts"
// Each operation runs over the 64 dates of BENCHMARK §2; times are per single operation.

import { do_not_optimize, measure } from "mitata";
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
// Plain arrays and index loops, so the loop itself costs as little as possible.
const YEARS = DATES.map((d) => d.year);
const MONTHS = DATES.map((d) => d.month);
const DAYS = DATES.map((d) => d.day);
const AD: GregorianDate[] = DATES.map((d) => d.toGregorian());

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
];

console.log(`node ${process.version}, ${DATES.length} dates, gc exposed: ${"gc" in globalThis}`);
for (const [id, name, body] of operations) {
  const stats = await measure(body, { heap: () => process.memoryUsage().heapUsed });
  const ns = (stats.avg / DATES.length).toFixed(1);
  const heap = stats.heap === undefined ? "n/a" : `${(stats.heap.avg / DATES.length).toFixed(0)} B`;
  console.log(`${id}  ${ns} ns/op  heap ${heap}/op (approximate)  ${name}`);
}
