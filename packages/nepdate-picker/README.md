# nepdate-picker

A Bikram Sambat (BS) date picker for the web, built on
[`nepdate-core`](https://www.npmjs.com/package/nepdate-core). Two custom elements that work in
plain HTML and in any framework, plus the month grid underneath them for anyone building their own:

- `<nepdate-calendar>`: one BS month as a grid of days, chosen with a click or the keyboard.
- `<nepdate-input>`: a text field with that calendar in a popover. It takes part in a `<form>`
  like a native input: it submits, resets, disables and reports validity.

The elements are unstyled apart from layout. Style any piece with `::part()`, or import
`nepdate-picker/theme.css` for a ready-made look. About 5.5 KB gzip on top of the core, no other
dependencies.

> **Pre-release.** The API may change before 0.1.0.

## Install

```sh
npm install nepdate-core@beta nepdate-picker@beta
```

## Use it

```html
<link rel="stylesheet" href="node_modules/nepdate-picker/dist/theme.css" />
<script type="module">
  import "nepdate-picker/define";
</script>

<form>
  <label for="dob">Date of birth (BS)</label>
  <nepdate-input id="dob" name="dob" required max="2082-12-30"></nepdate-input>
  <button>Save</button>
</form>
```

The form submits `dob=2081-04-15`: BS, as `YYYY-MM-DD`. The visitor can type the date in English
or Nepali digits or with the month name (`15 Shrawan 2081`), or pick it from the calendar.

`import "nepdate-picker/define"` registers both elements. The main entry has no side effects:
`import { defineElements } from "nepdate-picker"` and call it when you choose.

### Attributes

| Attribute | Elements | Meaning |
|---|---|---|
| `value` | both | The date, `YYYY-MM-DD` in BS. On `nepdate-input` it is the default that a form reset returns to. |
| `min`, `max` | both | Earliest and latest date that can be chosen. |
| `lang` | both | `en` (default) or `ne` for Nepali names and digits. |
| `first-day-of-week` | both | 0 = Sunday (default, as on a Nepali calendar) to 6 = Saturday. |
| `show-gregorian` | both | Shows the AD day under each BS day. |
| `name`, `required`, `disabled`, `placeholder` | `nepdate-input` | As on a native input. |

### Properties and events

- `value` (string) and `date` (`NepaliDate` or `null`) on both elements.
- `isDateDisallowed = (date) => boolean` disables extra days, such as Saturdays.
- `dayParts = (date) => string[]` adds part names to a day. With `nepdate-patro`:
  `calendar.dayParts = (d) => (info(d).isPublicHoliday ? ["holiday"] : [])`, then style
  `nepdate-calendar::part(holiday)`.
- On `nepdate-input`: `calendar` (the calendar inside the popover, for the two callbacks above),
  `showPicker()`, `form`, `validity`, `checkValidity()` and `reportValidity()`.
- Both fire `change` when the date changes. `nepdate-input` also fires `input`, once per change,
  not per keystroke.

## Styling

Every piece is a part:

| Part | What it is |
|---|---|
| `header`, `previous`, `next`, `heading`, `month-select`, `year-select` | The month header |
| `grid`, `weekday` | The table and its weekday headings |
| `day`, plus `selected`, `today`, `disabled` and any `dayParts` name | A day button |
| `gregorian` | The AD day with `show-gregorian` |
| `field`, `input`, `button`, `popover`, `calendar` | `nepdate-input`'s own pieces |

`nepdate-input` forwards the calendar's parts, so `nepdate-input::part(day)` works too.

```css
nepdate-calendar::part(selected) {
  background: rebeccapurple;
  color: white;
}
```

`theme.css` reads custom properties (`--nepdate-accent`, `--nepdate-surface`, `--nepdate-text`,
`--nepdate-radius` and a few more, listed at the top of the file) and uses `light-dark()`, so it
follows the page's `color-scheme`.

## Frameworks

Custom elements work in every framework without a wrapper. In React 19, Vue, Svelte, Solid and
Angular, render `<nepdate-input>` like any element and listen for `change`; set `isDateDisallowed`
and `dayParts` as properties. With server rendering, import `nepdate-picker/define` on the client
only; the main entry imports safely on the server.

## Keyboard

In the calendar, arrow keys move a day or a week, Home and End go to the start and end of the
week, Page Up and Page Down move a month, and Shift with them a year. Enter or Space chooses. In
`nepdate-input`, Alt+Down Arrow opens the calendar and Escape closes it. The pattern is the
[WAI-ARIA date picker dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/).

## Build your own

The month grid and the keyboard moves are exported, with no DOM, for a picker in your own
components:

```ts
import { NepaliDate } from "nepdate-core";
import { monthGrid, moveFocus } from "nepdate-picker";

const weeks = monthGrid(2081, 4, { today: NepaliDate.of(2081, 4, 15) });
console.log(weeks.length); // 6 rows of 7 cells; null where the month has no day
console.log(moveFocus(NepaliDate.of(2081, 4, 15), "PageDown").toJSON()); // 2081-05-15
```

## Browsers

Current Chrome, Edge, Firefox and Safari. The elements use custom elements, shadow DOM, form-
associated elements and the Popover API, and are tested in Chromium, Firefox and WebKit.

## License

MIT.
