# T15: the date picker package

Branch `feat/picker` from `4262e9c`. Read first: ADR-0015, ADR-0001, ADR-0004, ADR-0010,
`docs/API.md` and the WAI-ARIA APG
[date picker dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/).

The owner asked for a BS date picker that is unstyled by default, has a ready-made look, and works
like a native date input. ADR-0015 puts it in a third package, `nepdate-picker`. This phase adds the
package, its gates and its docs. It does not publish it and does not change the release workflow:
a new npm name needs one manual publish first (ADR-0015, Consequences).

## T15-01 Month grid, no DOM

AC:
- `monthGrid(year, month, options)` returns 6 rows of 7 cells for every month of BS 1901 to 2199
  and first days 0, 1 and 6; blank cells are `null`; each day has its AD date, `isToday` and
  `disabled` (outside `min`/`max` or refused by `isDateDisallowed`).
- `moveFocus` implements the APG keys (arrows, Home, End, Page Up/Down, Shift+Page Up/Down), clamps
  to `min`/`max` and to BS 1901-01-01..2199-12-30, and keeps the day when the month is shorter.
- `npm test -w nepdate-picker`: 100 % lines and branches on `src/grid.ts`.

## T15-02 `<nepdate-calendar>`

AC:
- Shadow DOM with parts `header`, `previous`, `next`, `heading`, `month-select`, `year-select`,
  `grid`, `weekday`, `day`, `selected`, `today`, `disabled`, `gregorian`, plus names from
  `dayParts`.
- One tab stop in the grid (roving `tabindex`), `role="grid"` named by the month, `aria-selected`,
  `aria-current="date"`, `aria-disabled`, and a full date as each day's name.
- Attributes `value`, `min`, `max`, `lang`, `first-day-of-week`, `show-gregorian`; properties
  `value`, `date`, `isDateDisallowed`, `dayParts`, `month`; `change` fires once per new date.
- Blank cells are empty and not displayed after any month change.

## T15-03 `<nepdate-input>`

AC:
- Form-associated: submits `YYYY-MM-DD` (BS) under `name`, resets to the `value` attribute, is
  disabled by a disabled `fieldset`, and sets `valueMissing`, `badInput`, `rangeUnderflow` and
  `rangeOverflow` with a message in the element's language.
- Typed text goes through `parseLenient` (English or Nepali digits, month names); bad text empties
  the value, like a native date input. `input` and `change` fire once per change. Enter commits
  and submits the form.
- The button opens the calendar in a `popover="auto"` beside the field (above it when there is no
  room below), focused on the value or today; choosing closes it and focuses the field; Escape
  closes it and focuses the button; Alt+Down Arrow opens it from the field.
- A `<label for>` names the inner field.

## T15-04 Theme, docs and gates

AC:
- `theme.css` styles both elements through parts and `--nepdate-*` properties with `light-dark()`.
- `packages/nepdate-picker/README.md` covers install, attributes, events, parts, frameworks,
  keyboard and the grid functions; its `ts` block runs in the docs gate.
- `npm run ci` has picker types, tests and build + shape + size (limit 6 KB gzip without the core)
  gates; the API snapshot and `docs/API.md` list the picker; every export has a runnable
  `@example`.
- The CI `browser` job runs the picker's browser tests in Chromium, Firefox and WebKit.

## Checkpoint

- `npm run ci` last line, and `BROWSERS=chromium,firefox,webkit npm run test:browser -w nepdate-picker`.
- Screenshots of the calendar and the open input, light and dark, with and without `theme.css`.
- The bundle size line from gate 13.
- Open for the owner: approve ADR-0015 and the new exports in `docs/API.md`, then the first manual
  publish of `nepdate-picker` and its trusted publisher; after that the release workflow and
  `release-check` take the third package (a follow-up phase).
