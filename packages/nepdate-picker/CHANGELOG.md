# Changelog

All notable changes to `nepdate-datepicker` are listed here. The package has its own version and
releases on `datepicker-vX.Y.Z` (ADR-0018); the core and the patro share the other version line. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0-beta.1] - 2026-10-25

First public pre-release. The npm name is `nepdate-datepicker` (ADR-0016), and the package peers on
`nepdate-core` `~0.1.0-beta.1`.

### Added

- `<nepdate-calendar>`, a Bikram Sambat month grid with the WAI-ARIA date picker keys.
- `<nepdate-input>`, a form-associated text field with that calendar in a popover.
- The DOM-free `monthGrid`, `moveFocus`, `isSelectable` and `weekdayOrder`.
- An optional `theme.css`, and `dist/nepdate-datepicker.js`, one standalone module with the core
  inside for a page with no bundler.
