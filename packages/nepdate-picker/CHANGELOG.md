# Changelog

All notable changes to `nepdate-datepicker` are listed here. The package has its own version and
releases on `datepicker-vX.Y.Z` (ADR-0018); the core and the patro share the other version line. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

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
