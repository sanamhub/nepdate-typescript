# ADR-0015: A date picker as web components, in a third package

- Status: Proposed
- Date: 2026-10-24
- Deciders: Sanam Pakuwal

## Context

The owner asked for a Bikram Sambat date picker: an unstyled one that anyone can style, a
ready-made one, and something that works like the browser's native `<input type="date">`, which
only knows the Gregorian calendar. nepdate.com needs one for its converter, and the mobile and
desktop apps show that people expect a month grid, not only a text field.

What the ecosystem offers on 2026-10-24:

- Picker libraries that support other calendars do it through `@internationalized/date` (React
  Aria, React Spectrum, Ark UI and Zag). Their month and weekday names come from `Intl`, which has
  no Bikram Sambat calendar, so a BS `Calendar` class plugs in but every label is wrong. Each also
  ties the picker to one framework family.
- Framework-free calendars are web components with shadow DOM, styled through `::part()` and custom
  properties (Cally is the common example). Custom elements now work as plain elements in React 19,
  Vue, Svelte, Solid and Angular.
- Form-associated custom elements (`ElementInternals`) and the Popover API are in every current
  engine, so a custom element can submit, reset, validate and open a popover like a native input,
  without a positioning library.
- The npm BS date packages carry their own data tables. Every one benchmarked in
  `docs/benchmarks.md` disagrees with `shared/data` on at least one of the 64 benchmark dates.

## Decision

1. **A third package, `nepdate-picker`**, in this repository at `packages/nepdate-picker`, with the
   same version as the core and the patro. Its only peer dependency is `nepdate-core`. It never
   depends on `nepdate-patro`; a page that wants holidays marks them through `dayParts`.
2. **Two custom elements and the grid underneath them.**
   - `<nepdate-calendar>`: one month as a WAI-ARIA grid, with the APG date picker keys.
   - `<nepdate-input>`: form-associated text field plus that calendar in a `popover="auto"`. It
     submits `YYYY-MM-DD` (BS) under its `name`, and sets `valueMissing`, `badInput`,
     `rangeUnderflow` and `rangeOverflow` like a native input.
   - `monthGrid`, `moveFocus`, `isSelectable` and `weekdayOrder`: the same logic with no DOM, for
     anyone building the picker in their own components.
3. **Unstyled by default.** Shadow DOM keeps only layout. Every piece is a `::part()`, and
   `nepdate-input` forwards the calendar's parts. `nepdate-picker/theme.css` is the ready-made look;
   it reads custom properties and uses `light-dark()`, so it follows the page's `color-scheme`.
4. **No side effects at import.** `nepdate-picker` exports the classes; `nepdate-picker/define`
   registers them. Where there is no DOM the classes extend an empty class, so the entry loads in
   Node and in server rendering.
5. **No framework wrappers and no `@internationalized/date` adapter** in this package. Either can
   be a later package if users ask; the grid functions are what they would build on.
6. **Gates.** The picker gets types, unit tests (grid at 100 % lines), build, publint, attw and a
   6 KB gzip size limit (5,356 B without the core when added) in `npm run ci`, a row in the API
   snapshot, runnable `@example`s, and browser tests in Chromium, Firefox and WebKit in the CI
   `browser` job.

## Consequences

- The npm name `nepdate-picker` was free on 2026-10-24, but npm checks similarity only at publish
  (ADR-0013). If it is refused, the fallback is the owner's `snm` scope.
- The first publish of a new name can't use trusted publishing, which needs the package to exist.
  The owner publishes 0.1.0-beta.1 by hand once and then adds the trusted publisher; until then the
  release workflow publishes only the core and the patro, and the picker is not released.
- Mutation testing (ADR-0007) does not cover the picker yet. The grid is small and fully covered by
  unit tests; the elements are covered by browser tests, which Stryker's Vitest runner does not run.
- Older engines without the Popover API or form-associated elements (Safari before 17,
  Firefox before 125) are not supported. The README says which engines are tested.
