import { type GregorianDate, NepaliDate } from "nepdate-core";

/** One cell of a month grid: a day of the shown month, or `null` for a blank cell. */
export interface PickerDay {
  readonly date: NepaliDate;
  readonly gregorian: GregorianDate;
  readonly isToday: boolean;
  /** Outside `min`/`max`, or refused by `isDateDisallowed`. */
  readonly disabled: boolean;
}

/** Options shared by {@link monthGrid} and {@link moveFocus}. */
export interface GridOptions {
  /** 0 = Sunday (the default, as on a Nepali wall calendar) to 6 = Saturday. */
  readonly firstDayOfWeek?: number;
  readonly min?: NepaliDate | null;
  readonly max?: NepaliDate | null;
  /** Marks extra days as disabled, for example weekends. Never called outside `min`/`max`. */
  readonly isDateDisallowed?: ((date: NepaliDate) => boolean) | null;
  /** Defaults to `NepaliDate.today()`, which is Nepal's date. */
  readonly today?: NepaliDate;
}

/** A move the keyboard can make in a month grid (WAI-ARIA APG date picker dialog). */
export type GridKey =
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown"
  | "Shift+PageUp"
  | "Shift+PageDown";

/** Rows in every grid, so the calendar keeps its height from month to month. */
export const GRID_ROWS = 6;

function firstDay(options: GridOptions | undefined): number {
  const day = options?.firstDayOfWeek ?? 0;
  return Number.isInteger(day) && day >= 0 && day <= 6 ? day : 0;
}

/**
 * Whether a date can be chosen under `options`: inside `min`/`max` and not refused by
 * `isDateDisallowed`.
 * @param date The date to check.
 * @param options The same options given to {@link monthGrid}.
 * @returns `true` when the date can be chosen.
 * @example
 * isSelectable(NepaliDate.of(2081, 4, 15), { max: NepaliDate.of(2081, 4, 10) }); // => false
 */
export function isSelectable(date: NepaliDate, options?: GridOptions): boolean {
  const { min, max, isDateDisallowed } = options ?? {};
  if (min && NepaliDate.compare(date, min) < 0) return false;
  if (max && NepaliDate.compare(date, max) > 0) return false;
  return !isDateDisallowed?.(date);
}

/**
 * The weekday order of a grid's columns, starting at `firstDayOfWeek`.
 * @param options Only `firstDayOfWeek` is read.
 * @returns Seven weekday numbers, 0 = Sunday.
 * @example
 * weekdayOrder({ firstDayOfWeek: 1 }); // => [1, 2, 3, 4, 5, 6, 0]
 */
export function weekdayOrder(options?: GridOptions): number[] {
  const start = firstDay(options);
  return Array.from({ length: 7 }, (_, i) => (start + i) % 7);
}

/**
 * The days of one BS month laid out in {@link GRID_ROWS} weeks of seven cells. Cells before the
 * first and after the last day of the month are `null`.
 * @param year BS year, 1901 to 2199.
 * @param month 1 to 12.
 * @param options Week start, limits and today.
 * @returns Six rows of seven cells.
 * @throws NepDateError when the month is outside BS 1901 to 2199.
 * @example
 * // Shrawan 2081 starts on a Tuesday, the third column.
 * monthGrid(2081, 4, { today: NepaliDate.of(2081, 4, 15) })[0]?.[2]?.date.toJSON(); // => "2081-04-01"
 */
export function monthGrid(
  year: number,
  month: number,
  options?: GridOptions,
): (PickerDay | null)[][] {
  const first = NepaliDate.of(year, month, 1);
  const today = options?.today ?? NepaliDate.today();
  const lead = (first.weekday - firstDay(options) + 7) % 7;
  const length = first.monthLength;
  const rows: (PickerDay | null)[][] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    const cells: (PickerDay | null)[] = [];
    for (let col = 0; col < 7; col++) {
      const day = row * 7 + col - lead + 1;
      if (day < 1 || day > length) {
        cells.push(null);
        continue;
      }
      const date = day === 1 ? first : first.addDays(day - 1);
      cells.push({
        date,
        gregorian: date.toGregorian(),
        isToday: date.equals(today),
        disabled: !isSelectable(date, options),
      });
    }
    rows.push(cells);
  }
  return rows;
}

function clampTo(date: NepaliDate, options: GridOptions | undefined): NepaliDate {
  const min = options?.min ?? NepaliDate.MIN;
  const max = options?.max ?? NepaliDate.MAX;
  if (NepaliDate.compare(date, min) < 0) return min;
  if (NepaliDate.compare(date, max) > 0) return max;
  return date;
}

function shift(date: NepaliDate, days: number): NepaliDate {
  const serial = NepaliDate.MIN.daysUntil(date) + days;
  const last = NepaliDate.MIN.daysUntil(NepaliDate.MAX);
  return NepaliDate.MIN.addDays(Math.min(Math.max(serial, 0), last));
}

function months(date: NepaliDate, n: number): NepaliDate {
  const index = date.year * 12 + date.month - 1 + n;
  const lowest = NepaliDate.MIN.year * 12;
  const highest = NepaliDate.MAX.year * 12 + 11;
  if (index < lowest) return NepaliDate.MIN;
  if (index > highest) return NepaliDate.MAX;
  return date.addMonths(n, "clamp");
}

/**
 * Where the focused day goes for a key, as in the WAI-ARIA APG date picker dialog: arrows move a
 * day or a week, Home and End go to the start and end of the week, Page Up and Page Down move a
 * month, and with Shift a year. The result stays inside `min`/`max` and BS 1901 to 2199; it may
 * be a disallowed day, which the grid shows as disabled.
 * @param date The focused day.
 * @param key The key pressed.
 * @param options Week start and limits.
 * @returns The day to focus next.
 * @example
 * moveFocus(NepaliDate.of(2081, 4, 15), "PageDown").toJSON(); // => "2081-05-15"
 */
export function moveFocus(date: NepaliDate, key: GridKey, options?: GridOptions): NepaliDate {
  const column = (date.weekday - firstDay(options) + 7) % 7;
  let next: NepaliDate;
  switch (key) {
    case "ArrowLeft":
      next = shift(date, -1);
      break;
    case "ArrowRight":
      next = shift(date, 1);
      break;
    case "ArrowUp":
      next = shift(date, -7);
      break;
    case "ArrowDown":
      next = shift(date, 7);
      break;
    case "Home":
      next = shift(date, -column);
      break;
    case "End":
      next = shift(date, 6 - column);
      break;
    case "PageUp":
      next = months(date, -1);
      break;
    case "PageDown":
      next = months(date, 1);
      break;
    case "Shift+PageUp":
      next = months(date, -12);
      break;
    case "Shift+PageDown":
      next = months(date, 12);
      break;
  }
  return clampTo(next, options);
}
