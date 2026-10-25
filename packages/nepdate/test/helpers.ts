import { type ErrorKind, NepaliDate, NepDateError } from "../src/index.js";

/** The BS date of a vector cell such as "2081-04-32". */
export function bs(text: string): NepaliDate {
  const [y, m, d] = text.split("-").map(Number);
  return NepaliDate.of(y as number, m as number, d as number);
}

/** "YYYY-MM-DD" of anything with year, month and day (BS or AD). */
export function iso(date: { year: number; month: number; day: number }): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/** The kind of the NepDateError that `fn` throws, or undefined when it returns. */
export function kindOf(fn: () => unknown): ErrorKind | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof NepDateError) return error.kind;
    throw error;
  }
  return undefined;
}

/** A vector cell: "ERR" means the call throws "out-of-range", else the ISO date. */
export function outcome(fn: () => { year: number; month: number; day: number }): string {
  try {
    return iso(fn());
  } catch (error) {
    if (error instanceof NepDateError && error.kind === "out-of-range") return "ERR";
    throw error;
  }
}
