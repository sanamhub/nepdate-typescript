# Changelog

All notable changes to `nepdate-datepicker` are listed here. The package has its own version and
releases on `datepicker-vX.Y.Z` (ADR-0018); the core and the patro share the other version line. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Properties that mirror their attributes, as on a native input: `min`, `max`, `firstDayOfWeek` and
  `showGregorian` on both elements, and `name` (now writable), `disabled`, `required`, `readOnly`
  and `placeholder` on `nepdate-input`.
- `nepdate-input`: the `readonly` attribute (no typing, no calendar, still submitted), `open`,
  `hidePicker()`, `willValidate`, `labels` and `setCustomValidity(message)`.
- `nepdate-input`: custom states `open`, `invalid` and `user-invalid`, for
  `nepdate-input:state(open)` and the like, where the browser has `ElementInternals.states`.
- `nepdate-input`: a typed date that `isDateDisallowed` refuses is kept and sets `stepMismatch`,
  with a message in English and Nepali.
- `custom-elements.json`, a Custom Elements Manifest, in the package and named by the
  `customElements` field.
- The `NepDateInputAttributes` and `NepDateCalendarAttributes` types, for declaring the elements in
  React, Vue or Svelte typings. The README shows how.
- `theme.css`: a `forced-colors` block for the chosen day, today and focus.

### Changed

- Without a `lang` attribute, the elements use the nearest ancestor's `lang`, across shadow roots.
  `ne` and `ne-*` mean Nepali.
- The popover is placed with CSS anchor positioning. The script placement and its scroll and resize
  listeners are used only where anchor positioning is not supported.
- `nepdate-calendar` renders attribute changes once, in a microtask, and rebuilds the month and
  year options only when the language or range changes. The property setters still render at once.
- Both elements share one constructed stylesheet per class where the browser supports it.
- The calendar's `change` event is no longer `composed`, like a native `change`.
- Enter in `nepdate-input` submits the form only where a native text field would, through the
  form's default button when it has one.
- `aria-invalid` on the field follows `user-invalid`, so a fresh empty required field is not
  announced as invalid.
- `nepdate-input` closes its calendar when it becomes disabled or read-only, and removes its window
  listeners when it leaves the page.
- `theme.css` is in the `nepdate-datepicker` cascade layer, so any unlayered page rule wins.
- The size limits are 7 KB gzip without the core and 13 KB for the standalone file (ADR-0021).

- `theme.css`: today has a ring as well as its colour, so it still shows when it is also the chosen
  day; days have a pixel of space between them; the arrows, month and year selects, field and
  calendar button have hover states; the month and year selects have a focus ring; the day hover
  colour fades in, except with reduced motion.

### Fixed

- `theme.css`: the chosen day kept its accent colour only until the pointer was over it, and an
  unavailable day took the hover colour. Both now stay as they are.

## [0.1.0-beta.3] - 2026-11-04

### Changed

- The `nepdate-core` peer range is `^1.0.0-rc.1`, so the picker installs beside the SDK 1.0 line.
  npm refuses a changed peer under an existing version, so the picker moves to `0.1.0-beta.3`.

## [0.1.0-beta.2] - 2026-11-03

### Changed

- The `nepdate-core` peer range is `~0.2.0-rc.1`, so the picker installs beside the SDK 0.2 line.
  npm refuses a changed peer under an existing version, so the picker moves to `0.1.0-beta.2`.

## [0.1.0-beta.1] - 2026-10-25

First public pre-release. The npm name is `nepdate-datepicker` (ADR-0016), and the package peers on
`nepdate-core` `~0.1.0-beta.1`.

### Added

- `<nepdate-calendar>`, a Bikram Sambat month grid with the WAI-ARIA date picker keys.
- `<nepdate-input>`, a form-associated text field with that calendar in a popover.
- The DOM-free `monthGrid`, `moveFocus`, `isSelectable` and `weekdayOrder`.
- An optional `theme.css`, and `dist/nepdate-datepicker.js`, one standalone module with the core
  inside for a page with no bundler.
