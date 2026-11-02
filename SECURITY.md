# Security policy

`nepdate-core` and `nepdate-patro` share one version, and `nepdate-datepicker` has its own. All three
packages have no runtime dependencies, no network access and no file access.
A security problem is most likely an exception other than `NepDateError`, or a hang, on hostile
input to `parse`, `tryParse` or `parseLenient`, or a problem in a workflow (`.github/workflows/`).

## Supported versions

The latest `0.x` release of each version line gets fixes. A version with a known problem is
deprecated on npm (ADR-0005, ADR-0018).

## Reporting a vulnerability

Report privately through
[GitHub security advisories](https://github.com/sanamhub/nepdate-typescript/security/advisories/new).
Don't open a public issue. Expect a first reply within a week. Say which package, version and
function are affected and give an input that reproduces it.

A wrong date, holiday or tithi isn't a security problem: report it in the hub,
[`sanamhub/nepdate`](https://github.com/sanamhub/nepdate/issues/new/choose).
