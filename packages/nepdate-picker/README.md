# nepdate-datepicker

A Bikram Sambat (BS) date picker for the web, built on
[`nepdate-core`](https://www.npmjs.com/package/nepdate-core). Two custom elements that work in
plain HTML and in any framework, plus the month grid underneath them for anyone building their own:

- `<nepdate-calendar>`: one BS month as a grid of days, chosen with a click or the keyboard.
- `<nepdate-input>`: a text field with that calendar in a popover. It takes part in a `<form>`
  like a native input: it submits, resets, disables and reports validity.

The elements are unstyled apart from layout. Style any piece with `::part()`, or import
`nepdate-datepicker/theme.css` for a ready-made look. About 6.5 KB gzip on top of the core, no other
dependencies; the standalone file below, core included, is about 12.5 KB.

## Install

With a bundler (Vite, webpack, esbuild and the like):

```sh
npm install nepdate-core nepdate-datepicker
```

```js
import "nepdate-datepicker/define";
import "nepdate-datepicker/theme.css";
```

Without a build step, use the standalone file. It holds the elements and the core in one module
and registers both elements, so the page needs no import map. Load it from a CDN:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/nepdate-datepicker@1.0.0/dist/theme.css" />
<script type="module" src="https://cdn.jsdelivr.net/npm/nepdate-datepicker@1.0.0/dist/nepdate-datepicker.js"></script>
```

Or copy `dist/nepdate-datepicker.js` and `dist/theme.css` from the package into your site, such as an
ASP.NET Core `wwwroot/lib/nepdate-datepicker/`, and point the same two tags at them. Don't load the
standalone file and `nepdate-datepicker/define` on one page: both register the same element names.

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

`import "nepdate-datepicker/define"` registers both elements. The main entry has no side effects:
`import { defineElements } from "nepdate-datepicker"` and call it when you choose.

The `value` attribute is the date. Unlike a native input it keeps working after the visitor has
edited the field, so a framework that renders the attribute can push a new date; a form reset
returns to it.

### Attributes

| Attribute | Elements | Meaning |
|---|---|---|
| `value` | both | The date, `YYYY-MM-DD` in BS. On `nepdate-input` it is the default that a form reset returns to. |
| `min`, `max` | both | Earliest and latest date that can be chosen. |
| `lang` | both | `en` or `ne` for Nepali names and digits. Without it, the nearest ancestor's `lang` counts, as for a native element; `ne-NP` is `ne`, and anything else is English. |
| `first-day-of-week` | both | 0 = Sunday (default, as on a Nepali calendar) to 6 = Saturday. |
| `show-gregorian` | both | Shows the AD day under each BS day. |
| `name`, `required`, `disabled`, `readonly`, `placeholder` | `nepdate-input` | As on a native input. `readonly` stops typing and the calendar, and the date still submits. |

Each attribute has a property, as on a native input: `min`, `max`, `firstDayOfWeek` and
`showGregorian` on both elements, and `name`, `required`, `disabled`, `readOnly` and `placeholder`
on `nepdate-input`. Frameworks that set properties, such as React 19, reach them all.

### Properties and events

- `value` (string) and `date` (`NepaliDate` or `null`) on both elements.
- `isDateDisallowed = (date) => boolean` disables extra days, such as Saturdays.
- `dayParts = (date) => string[]` adds part names to a day. With `nepdate-patro`:
  `calendar.dayParts = (d) => (info(d).isPublicHoliday ? ["holiday"] : [])`, then style
  `nepdate-calendar::part(holiday)`.
- On `nepdate-input`: `calendar` (the calendar inside the popover, for the two callbacks above),
  `open`, `showPicker()`, `hidePicker()`, `form`, `labels`, `willValidate`, `validity`,
  `validationMessage`, `checkValidity()`, `reportValidity()` and `setCustomValidity(message)`.
- Validity follows a native date input: `valueMissing`, `badInput` for text that isn't a date,
  `rangeUnderflow` and `rangeOverflow` for `min` and `max`, and `stepMismatch` for a typed date that
  `isDateDisallowed` refuses (the date is kept, as a native input keeps a date its `step` refuses).
  A `setCustomValidity` message adds `customError` and wins; an empty string clears it.
- Both fire `change` when the date changes; like a native `change`, it does not cross shadow roots.
  `nepdate-input` also fires `input`, once per change, not per keystroke.
- Enter in the field commits the text and submits the form where a native text field would:
  through the form's first submit button, or, with no submit button, when this is the form's only
  text-like field.

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

`nepdate-input` also has custom states, like the pseudo-classes of a native input:

| State | When |
|---|---|
| `open` | The calendar is open. |
| `invalid` | The date fails validation, as `:invalid`. |
| `user-invalid` | Invalid after the visitor committed a date or the form was submitted, as `:user-invalid`. A form reset clears it. |

```css
nepdate-input:state(user-invalid)::part(field) {
  border-color: crimson;
}
nepdate-input:state(open)::part(button) {
  background: #eee;
}
```

`theme.css` reads custom properties (`--nepdate-accent`, `--nepdate-surface`, `--nepdate-text`,
`--nepdate-radius` and a few more, listed at the top of the file) and uses `light-dark()`, so it
follows the page's `color-scheme`. All of it is in the `nepdate-datepicker` cascade layer, so any
page rule outside a layer wins over it, whatever its specificity. With forced colors (Windows High
Contrast and the like) it draws the chosen day, today and focus with system colors.

## Frameworks

Custom elements work without a wrapper. Render `<nepdate-input>` like any element, pass the date
as `value`, and read `event.target.value` on `change`. Set `isDateDisallowed` and `dayParts` as
properties. With server rendering, import `nepdate-datepicker/define` on the client only; the main
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

Svelte and Angular:

```svelte
<nepdate-input value={date} onchange={(e) => (date = e.target.value)} />
```

```typescript
// Angular: let the template use custom elements.
@Component({ schemas: [CUSTOM_ELEMENTS_SCHEMA], template: `<nepdate-input [value]="date" />` })
```

The package ships `custom-elements.json` (a [Custom Elements
Manifest](https://github.com/webcomponents/custom-elements-manifest), named by the
`customElements` field in `package.json`), which editors and tools such as Storybook read for the
attributes, properties, events, parts and states.

### TypeScript in frameworks

The package exports `NepDateInputAttributes` and `NepDateCalendarAttributes`, and depends on no
framework's types. Declare the elements once, in a `.d.ts` file of your project.

React 19:

```typescript
import type { NepDateCalendarAttributes, NepDateInputAttributes } from "nepdate-datepicker";
import type { DetailedHTMLProps, HTMLAttributes } from "react";

type Element<E, A> = DetailedHTMLProps<HTMLAttributes<E>, E> & A;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "nepdate-input": Element<HTMLElementTagNameMap["nepdate-input"], NepDateInputAttributes>;
      "nepdate-calendar": Element<HTMLElementTagNameMap["nepdate-calendar"], NepDateCalendarAttributes>;
    }
  }
}
```

Vue: tell the compiler the tags are custom elements, in `vite.config.ts`
(`vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("nepdate-") } } })`),
and type them for templates:

```typescript
import type { NepDateCalendarAttributes, NepDateInputAttributes } from "nepdate-datepicker";
import type { DefineComponent } from "vue";

declare module "vue" {
  interface GlobalComponents {
    "nepdate-input": DefineComponent<NepDateInputAttributes>;
    "nepdate-calendar": DefineComponent<NepDateCalendarAttributes>;
  }
}
```

Svelte 5:

```typescript
import type { NepDateCalendarAttributes, NepDateInputAttributes } from "nepdate-datepicker";
import type { HTMLAttributes } from "svelte/elements";

declare module "svelte/elements" {
  interface SvelteHTMLElements {
    "nepdate-input": HTMLAttributes<HTMLElementTagNameMap["nepdate-input"]> & NepDateInputAttributes;
    "nepdate-calendar": HTMLAttributes<HTMLElementTagNameMap["nepdate-calendar"]> &
      NepDateCalendarAttributes;
  }
}
```

Angular needs no typing beyond `CUSTOM_ELEMENTS_SCHEMA` above.

Five setups were checked in Chromium, Firefox and WebKit: plain HTML with the standalone file,
React 19.3, Vue 3.5, Blazor (.NET 10, interactive server) and MVC (.NET 10). Svelte, Solid and
Angular set properties on custom elements the same way but have not been run, and neither have the
type declarations above.

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
import { monthGrid, moveFocus } from "nepdate-datepicker";

const weeks = monthGrid(2081, 4, { today: NepaliDate.of(2081, 4, 15) });
console.log(weeks.length); // 6 rows of 7 cells; null where the month has no day
console.log(moveFocus(NepaliDate.of(2081, 4, 15), "PageDown").toJSON()); // 2081-05-15
```

## Browsers

Current Chrome, Edge, Firefox and Safari. The elements use custom elements, shadow DOM, form-
associated elements and the Popover API, and are tested in Chromium, Firefox and WebKit. CSS anchor
positioning keeps the calendar beside the field; where a browser lacks it, a script places the
calendar instead. Custom states need `ElementInternals.states`; without it the states are simply
not set.

## License

MIT.
