# ADR-0019: Mutation testing on library pull requests

- Status: Accepted
- Date: 2026-11-03
- Deciders: Sanam Pakuwal
- Amends: ADR-0007 decision 6 (the mutation workflow never runs on a pull request)

## Context

ADR-0007 kept the mutation run off the pull-request path because a full Stryker run takes about
twenty minutes. The weekly run last ran before the API additions of the 0.2 line, so the next full
run was the release's own mutation job at the `0.2.0-rc.1` tag. It found 92 survivors with no
equivalent entry and 64 entries whose ids no longer matched the source, after the tag existed and
after every other release gate had passed.

A survivor is a test gap or a stale proof. Both are cheaper to fix in review than at a tag, and a
tag that published nothing still has to be deleted and recreated.

## Decision

The mutation workflow also runs on a pull request that changes either package's source, its tests,
the Stryker configs, the mutation checker, the disposition list or the workflow itself. A path
filter keeps it off documentation-only and benchmark-only pull requests. The weekly schedule, the
manual dispatch and the release job stay as they are, and the release still blocks on the same
check.

## Consequences

- A pull request that changes `packages/nepdate/src` or `packages/nepdate-patro/src` waits for the
  mutation gate, about twenty to thirty minutes on a Linux runner.
- A survivor is discussed in review, where the test or the proof can be fixed before a tag.
- The floor and the disposition list are still enforced by the release job, so a change that
  bypasses review cannot publish below the floor.
