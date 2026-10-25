# nepdate-picker

A Bikram Sambat (BS) date picker for the web, built on
[`nepdate-core`](https://www.npmjs.com/package/nepdate-core). Two custom elements that work in
plain HTML and in any framework, plus the month grid underneath them for anyone building their own:

- `<nepdate-calendar>`: one BS month as a grid of days, chosen with a click or the keyboard.
- `<nepdate-input>`: a text field with that calendar in a popover. It takes part in a `<form>`
  like a native input: it submits, resets, disables and reports validity.

The elements are unstyled apart from layout. Style any piece with `::part()`, or import
`nepdate-picker/theme.css` for a ready-made look. About 5.5 KB gzip on top of the core, no other
dependencies; the standalone file below, core included, is about 10.5 KB.

> **Pre-release.** The API may change before 0.1.0.

## Install

With a bundler (Vite, webpack, esbuild and the like):

```sh
npm install nepdate-core@beta nepdate-picker@beta
```

```js
import "nepdate-picker/define";
import "nepdate-picker/theme.css";
```

Without a build step, use the standalone file. It holds the elements and the core in one module
and registers both elements, so the page needs no import map. Load it from a CDN:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/nepdate-picker@0.1.0-beta.1/dist/theme.css" />
<script type="module" src="https://cdn.jsdelivr.net/npm/nepdate-picker@0.1.0-beta.1/dist/nepdate-picker.js"></script>
```

Or copy `dist/nepdate-picker.js` and `dist/theme.css` from the package into your site, such as an
ASP.NET Core `wwwroot/lib/nepdate-picker/`, and point the same two tags at them. Don't load the
standalone file and `nepdate-picker/define` on one page: both register the same element names.

## Use it

```html
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

The `value` attribute is the date. Unlike a native input it keeps working after the visitor has
edited the field, so a framework that renders the attribute can push a new date; a form reset
returns to it.

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

Custom elements work without a wrapper. Render `<nepdate-input>` like any element, pass the date
as `value`, and read `event.target.value` on `change`. Set `isDateDisallowed` and `dayParts` as
properties. With server rendering, import `nepdate-picker/define` on the client only; the main
entry imports safely on the server.

React 19:

```jsx
<nepdate-input value={date} onChange={(e) => setDate(e.target.value)} />
```

Vue:

```vue
<nepdate-input :value="date" @change="date = $event.target.value" />
```

Blazor, with the standalone file loaded in `App.razor`:

```razor
<nepdate-input @bind-value="date" @bind-value:event="onchange" />
```

ASP.NET Core MVC or Razor Pages, where the form posts the BS date as a string; parse it on the
server, for example with [NepDate](https://www.nuget.org/packages/NepDate) for .NET. The `asp-for`
tag helper only works on built-in elements, so write the name:

```cshtml
<nepdate-input name="@Html.NameFor(m => m.Dob)" value="@Model.Dob" required></nepdate-input>
```

These five were checked in Chromium, Firefox and WebKit: plain HTML with the standalone file,
React 19.3, Vue 3.5, Blazor (.NET 10, interactive server) and MVC (.NET 10). Svelte, Solid and
Angular set properties on custom elements the same way but have not been run.

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
