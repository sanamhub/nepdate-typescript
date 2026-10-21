# Changelog

All notable changes to `nepdate` and `nepdate-patro` are listed here. Both packages share one
version (ADR-0005); an entry that concerns only one package starts with its name. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0-beta.1] - 2026-10-21

First public pre-release. The API may still change before 0.1.0.

### Added

- `nepdate`: `NepaliDate` for BS 1901-01-01 to 2199-12-30 with `of`, `fromGregorian`,
  `toGregorian`, `MIN`, `MAX`, `compare`, `equals`, `weekday`, `dayOfYear`, `monthLength`,
  `firstOfMonth` and `lastOfMonth`; `NepDateError` with `kind`.
- `nepdate-patro`: `info`, `coverage` and `publicHolidays` for BS 2077-01-01 to 2084-08-20, with
  tithi, public holiday and event data.
- `nepdate`: `NepaliDate.fromJSDate`, `toJSDate` and `today`; the first two take an explicit zone,
  `today` defaults to `Asia/Kathmandu`.
