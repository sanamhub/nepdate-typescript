# ADR-0016: The picker package is `nepdate-datepicker` on npm

- Status: Accepted
- Date: 2026-10-25
- Deciders: Sanam Pakuwal
- Amends: the package name in ADR-0015

## Context

ADR-0015 named the third package `nepdate-picker`. The name was free, but the first publish on
2026-10-25 was refused with "403 Forbidden: Package name too similar to existing package
nep-datepicker". npm's similarity check ignores punctuation, so `nepdate-picker` and
`nep-datepicker` are the same name to it. Nothing was published.

ADR-0015 left the fallback to the owner. A scope always passes the check, but the core and the
patro are unscoped, and ADR-0013 already chose an unscoped `nepdate-` name over a personal scope.

## Decision

| Package | Was | npm name | Standalone file |
|---|---|---|---|
| Picker | `nepdate-picker` | `nepdate-datepicker` | `dist/nepdate-datepicker.js` |

Without punctuation the name is `nepdatedatepicker`, which no existing package matches. The
workspace directory stays `packages/nepdate-picker`, as `packages/nepdate` holds `nepdate-core`.
The element names `<nepdate-calendar>` and `<nepdate-input>` do not change.

## Consequences

- Imports are `nepdate-datepicker`, `nepdate-datepicker/define`, `nepdate-datepicker/standalone`
  and `nepdate-datepicker/theme.css`. No version was published under the old name, so no user
  migrates.
- npm checks similarity only at publish. If it refuses this name too, the fallback is the owner's
  `snm` scope: `@snm/nepdate-picker`.
