import { NepDateCalendarElement } from "./calendar.js";
import { NepDateInputElement } from "./input.js";

export { CALENDAR_PARTS, NepDateCalendarElement } from "./calendar.js";
export {
  GRID_ROWS,
  type GridKey,
  type GridOptions,
  isSelectable,
  monthGrid,
  moveFocus,
  type PickerDay,
  weekdayOrder,
} from "./grid.js";
export { INPUT_PARTS, NepDateInputElement } from "./input.js";

/**
 * Registers `<nepdate-calendar>` and `<nepdate-input>`. Safe to call more than once, and does
 * nothing where there is no `customElements` (Node, SSR).
 * @example
 * defineElements(); // => undefined
 */
export function defineElements(): void {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("nepdate-calendar"))
    customElements.define("nepdate-calendar", NepDateCalendarElement);
  if (!customElements.get("nepdate-input"))
    customElements.define("nepdate-input", NepDateInputElement);
}

declare global {
  interface HTMLElementTagNameMap {
    "nepdate-calendar": NepDateCalendarElement;
    "nepdate-input": NepDateInputElement;
  }
}
