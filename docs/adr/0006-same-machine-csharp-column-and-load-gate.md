# ADR-0006: Same-machine C# column and the load gate

- Status: Accepted
- Date: 2026-10-18
- Amends: [ADR-0002](0002-representation-and-performance.md) §10 (how the 3× C# limits are
  computed). ADR-0002 is unchanged; its targets stay as written.
- Deciders: Sanam Pakuwal

## Context

ADR-0002 §10 prints 3× C# limits of 39.9 ns for B1, 55.9 ns for B2 and 143.8 ns for B7. They were
computed from C# numbers measured on the hub machine, at another time, so they compare two machines
and two sessions. T6 measures the C# column with the hub's `tools/dotnet-bench` on the reference
machine in the same session as the TypeScript rows (`bench/dotnet.ts`).

The reference machine is rarely quiet. On 2026-10-18 the C# run ran at a median 66% all-CPU load
and gave B1 20.00 ns, B2 24.25 ns and B7 63.77 ns. A loaded C# run is slower, so 3× of it is a more
lenient limit (60.00, 72.75 and 191.31 ns) than a quiet run would give. Using it for a verdict would
loosen the gate without anyone deciding to.

## Decision

1. The 3× C# limits of BENCHMARK §6 are computed from a C# run on the same machine as the
   TypeScript rows, made with `bench/dotnet.ts`. The hub-machine limits in ADR-0002 §10 are kept as
   history and are not used for a verdict.
2. A row is quiet when the all-CPU load sampled before it is at most 15%. A TypeScript row waits
   5 s and retries up to 5 times; a row that is still above 15% is recorded with `loaded: true`.
   The C# run is quiet when the median of its load samples is at most 15%. All-CPU load is used,
   not the load of the pinned core, because runs with core 2 below 15% and the machine at 35% to
   76% were measured 35% slower.
3. A loaded row gives no verdict. A 3× check needs both the TypeScript row and the C# run to be
   quiet; if either is loaded the check is `pending a quiet run`. The 3× limits from a loaded C#
   run may be printed, labelled as loaded, but they never pass or fail a row.
4. The ADR-0002 targets (B1 and B2 < 30 ns, B3 and B4 < 20 ns, B5 < 153 ns, B6 < 64 ns, B7 < 10 ns)
   are unchanged. A miss is reported with a `--cpu-prof` profile, as ADR-0002 §10 says.

## Consequences

- Until the machine gives a quiet C# run, every 3× check is pending, even when the TypeScript row is
  quiet.
- `docs/benchmarks.md` shows the load next to every row, so a reader can see which numbers are
  verdicts and which are only observations.
- Changing the 15% limit, the retry count or the rule in point 3 needs a new ADR.
