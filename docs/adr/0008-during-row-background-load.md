# ADR-0008: During-row background load

- Status: Accepted
- Date: 2026-10-18
- Amends: [ADR-0006](0006-same-machine-csharp-column-and-load-gate.md) point 2, the quiet rule
  for TypeScript rows.
- Deciders: Sanam Pakuwal

## Context

ADR-0006 samples the all-CPU load before a TypeScript row and retries when it is above 15%. A row
can start quiet and turn loaded while it runs, and the before-row sample cannot see that, so a
during-row figure is needed.

The benchmark process itself keeps logical CPU 2 busy, so including CPU 2 in a during-row sample
would mark every row loaded. The figure has to leave out the pinned CPU.

## Decision

1. `bench/measure.ts` keeps the before-row all-CPU sample and its five retries. It also samples the
   mean busy percentage of every CPU except CPU 2 during the measured function, every 250 ms.
2. A row is quiet only when both figures are below 15%. Either figure at or above 15% marks the
   row `LOADED`; a loaded row decides no target or 3x check. The before-row retry also waits while
   the all-CPU figure is at or above 15%. This is the boundary the Python port uses, so both ports
   classify a row at exactly 15% the same way; ADR-0006 said "above 15%".
3. The during-row figure is stored as `backgroundLoad` in the benchmark JSON and printed next to
   the before-row figure.
4. The 15% value, the retry count and the C# rule are unchanged. Changing them still needs a new
   ADR.

## Consequences

- A row that turns loaded mid-measurement is caught, not only a row that starts loaded.
- The all-CPU figure and the background figure answer different questions, so both are reported.
- The figure is a mean of per-CPU busy shares, not a weighted sum over ticks. Each CPU counts the
  same.
- The 2026-10-18 rows predate this field. They keep the before-row figure and cannot be re-labelled
  without a new pass.
