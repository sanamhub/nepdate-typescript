# ADR-0020: Date picker native input parity, platform features and size limits

- Status: Accepted
- Date: 2026-11-17
- Deciders: Sanam Pakuwal
- Amends: ADR-0015 decision 2 (the validity flags) and decision 7 (the two gzip limits)

## Context

ADR-0015 made `<nepdate-input>` a form-associated element that behaves like a native input. Using
it from plain HTML, React 19, Vue, Svelte, Angular, Blazor and server-rendered forms showed where
it still differs:

- Frameworks set a property when the element has one. Only `value`, `date` and `name` (read-only)
  were properties, so `min`, `disabled` and the rest reached the element only as attributes.
- There was no `readonly`, `setCustomValidity`, `willValidate`, `labels` or `hidePicker`, and a
  page could not style the open or invalid field without reading the shadow tree.
- Enter in the field always submitted the form, even where a native text field would not.
- A typed date that the calendar's `isDateDisallowed` refuses was accepted without a word.
- Every attribute copied from the input to its calendar re-rendered the whole month (42 day
  buttons and a 299-option year select), six times per change of the input.

CSS anchor positioning, `ElementInternals.states` and constructable stylesheets are now in current
Chromium, Firefox and WebKit, so the picker can use the platform for placement and state instead
of script.

## Decision

1. **Properties mirror attributes**, as on a native input: `name`, `disabled`, `required`,
   `readOnly` (`readonly`), `min`, `max`, `placeholder`, `firstDayOfWeek` and `showGregorian` on the
   input, and `min`, `max`, `firstDayOfWeek` and `showGregorian` on the calendar.
2. **More of the native input's API**: `readonly` (no typing, no calendar, still submitted, barred
   from validation as the HTML spec bars a read-only form-associated element), `willValidate`,
   `labels`, `setCustomValidity()`, `open` and `hidePicker()`.
3. **Validity.** The flags of ADR-0015 stay. A date refused by `isDateDisallowed` keeps its value
   and sets `stepMismatch`, the flag a native date input uses for a well-formed date in range that
   its `step` does not allow. A custom message adds `customError` to the element's own flags and
   wins as the message.
4. **Custom states** where the browser has `ElementInternals.states`: `open`, `invalid` and
   `user-invalid`, styled with `nepdate-input:state(open)`. `user-invalid` and `aria-invalid` start
   after the visitor commits a date or the form checks validity, and a form reset clears them, as
   for `:user-invalid`.
5. **Enter** submits only where a native text field would: through the form's default button,
   unless it is disabled, or with no submit button when this is the only field that blocks implicit
   submission.
6. **Placement.** CSS anchor positioning keeps the popover beside the field and flips it when there
   is no room. The script placement and its scroll and resize listeners are the fallback where
   `anchor-name` is not supported, and are not attached otherwise.
7. **Rendering.** Attribute changes on the calendar render once, in a microtask. The `value`,
   `date`, `isDateDisallowed` and `dayParts` setters still render at once, so code that sets a date
   and reads the grid on the next line keeps working; that render takes any pending attribute change
   with it. Anything that needs the DOM at once (`focusDay()`, keys, clicks) renders a pending change
   first. The month and year options are rebuilt only when the language or the range changes.
8. **Language.** Without a `lang` attribute an element uses its nearest ancestor's, crossing shadow
   roots, as native elements do. `ne` and `ne-*` mean Nepali.
9. **The calendar's `change` is not composed**, like a native `change`.
10. **Shipped metadata.** `custom-elements.json` (Custom Elements Manifest, written by
    `@custom-elements-manifest/analyzer` at build time) is in the package and named by the
    `customElements` field. `NepDateInputAttributes` and `NepDateCalendarAttributes` are exported
    types for a framework's element typings; the package depends on no framework types.
11. **Theme.** `theme.css` is in the `nepdate-datepicker` cascade layer, so any unlayered page rule
    wins, and has a `forced-colors` block.
12. **Size limits.** The picker without the core was 5,470 B gzip before this change and 6,582 B
    after it; the standalone file with the core was 11,543 B and 12,666 B. Both are over the limits
    in `scripts/ci.ts` (6 KB and 12 KB). The limits become 7 KB and 13 KB, which keeps about the
    same margin over the measured size as the old limits had.

## Consequences

- React 19 and other frameworks that set properties reach every attribute without a wrapper.
- A page that read the calendar's shadow tree right after setting an attribute now sees the change
  a microtask later. The shadow tree is not public API; the setters behave as before.
- A listener for the calendar's `change` on a shadow host outside the calendar's own tree no longer
  hears it. `<nepdate-input>`'s own events are unchanged.
- Engines without anchor positioning use the old script placement. Engines without
  `ElementInternals.states` (or Chromium before 125, which accepts only `--name` states) get no
  states; everything else works.
- The package gains one generated file and the repository one dev dependency (the analyzer).
- About 1.1 KB gzip more for every page that uses the picker. The features are the ones a native
  input has; the code stays without a framework or a positioning library.
