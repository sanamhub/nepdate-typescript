# Changelog

All notable changes to `nepdate-core`, `nepdate-patro` and `nepdate-datepicker` are listed here. The
packages share one version (ADR-0005); an entry that concerns only one package starts with its name. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `nepdate-datepicker`, a new package (ADR-0015, ADR-0016): `<nepdate-calendar>`, a BS month grid
  with the WAI-ARIA date picker keys; `<nepdate-input>`, a form-associated text field with that
  calendar in a popover; the DOM-free `monthGrid`, `moveFocus`, `isSelectable` and `weekdayOrder`; and an optional
  `theme.css`; and `dist/nepdate-datepicker.js`, one standalone module with the core inside for a
  page with no bundler. After its first publish it is released with `nepdate-core` and
  `nepdate-patro` under the same version, with npm provenance.

### Changed

- The published check also runs weekly on Linux with npm, pnpm, Yarn in both linkers and bun, and
  daily as a registry metadata check; a failed run opens or updates one issue labelled
  `published-check`.

## [0.1.0-beta.1] - 2026-10-22

First public pre-release. The API may still change before 0.1.0. The core package is
`nepdate-core`: npm refused `nepdate` as too close to `nep-date` (ADR-0013).

### Added

- `nepdate-core`: `NepaliDate` for BS 1901-01-01 to 2199-12-30 with `of`, `fromGregorian`,
  `toGregorian`, `MIN`, `MAX`, `compare`, `equals`, `weekday`, `dayOfYear`, `monthLength`,
  `firstOfMonth` and `lastOfMonth`; `NepDateError` with `kind`.
- `nepdate-patro`: `info`, `coverage` and `publicHolidays` for BS 2077-01-01 to 2084-08-20, with
  tithi, public holiday and event data.
- `nepdate-core`: `NepaliDate.fromJSDate`, `toJSDate` and `today`; the first two take an explicit zone,
  `today` defaults to `Asia/Kathmandu`.
