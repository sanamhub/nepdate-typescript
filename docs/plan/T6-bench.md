# T6: Benchmark rigour and release runbook

Follow-up to T5. Branch `feat/T6-bench` from `e49b432` (T5 merged). Read first:
`shared/spec/BENCHMARK.md` §1, §4 and §6, ADR-0002 §10, ADR-0005, `docs/competitors.md`,
`docs/benchmarks.md`, `docs/runbooks/release.md`, and the hub's `tools/dotnet-bench/README.md`.

T5 measured every row in one process, on a machine at 38% to 95% load, compared C# numbers from
another machine, and treated a competitor as out of range only when it threw. It also left the
release runbook without the U-04 precondition, the npm name fallback and a verification step for the
published tarball. This phase changes the measurement method and the documentation. It changes no
package API, no feature and no target.

## T6-01 One process per measurement

- `bench/measure.ts` is the only process that imports a benchmarked package. It measures exactly one
  (implementation, operation) pair and writes one JSON object to stdout. Nothing else goes to
  stdout, so the parent can parse the stream.
- `bench/own.ts` and `bench/compare.ts` become parents. For every row they spawn a fresh
  `node --expose-gc bench/measure.ts`, pinned to logical CPU 2 with
  `cmd /c start "" /affinity 4 /wait /b`, and collect the JSON. `--json` prints only the collected
  array; the default prints the human table.
- `bench/order.ts` runs five pairs. Each pair measures B1 alone, runs every competitor agreement
  pass in its own fresh process, then measures B1 again. Pairing controls the slow load drift that
  made a single long batch inconclusive. It prints the pairs, both medians, the median paired
  difference, the loads and the PIDs, and says whether the paired difference is more than 10%.

AC:
- `node bench/own.ts --json` returns eight rows with eight different PIDs; `node bench/own.ts`
  prints one line per operation.
- `node bench/compare.ts --json` returns eighteen rows with eighteen different PIDs;
  `node bench/compare.ts --check` still prints agreement without measuring.
- `node bench/order.ts` prints the five pairs, both medians and a verdict. The check is reported
  even when it fails.

## T6-02 Same-machine C#

- `bench/dotnet.ts` runs the hub's `tools/dotnet-bench` with the .NET 10 job, on this machine, in the
  same session as the TypeScript rows. The hub checkout defaults to `../nepdate` and can be set with
  `HUB_DIR`; NuGet and build caches go to `D:\devcache\dotnet` and can be set with `DOTNET_CACHE`.
  The command is
  `dotnet run -c Release -f net10.0 -p:BaseOutputPath=... -p:BaseIntermediateOutputPath=... --project <hub>/tools/dotnet-bench -- --filter "*" --artifacts <cache>/artifacts`.
- `bench/dotnet.ts` samples load before and after the run, parses the BenchmarkDotNet Markdown
  report for the .NET 10 column, and prints the eight rows as JSON.
- The measurement session runs `own.ts`, then `dotnet.ts`, then `compare.ts`, so the C# job sits
  between the TypeScript batches.
- `docs/benchmarks.md` takes its C# column from this run. The hub-machine numbers (B1 13.29,
  B2 18.64 and the rest) are removed. The 3× checks use only the new B1, B2 and B7 values, and the
  new limits are shown next to them.

AC:
- The C# command completes and the report has B1 to B8 for .NET 10.
- `grep -n "13.29\|18.64\|153.02\|47.93" docs/benchmarks.md` finds nothing.
- The page names the same-machine C# values, the commit of the hub checkout, the .NET SDK and
  runtime, and the load around the run.

## T6-03 Fair agreement

- `bench/ranges.ts` records each competitor's documented BS and AD range with a source: a README
  line or a code line in its published package. Where only the BS range is documented, the AD range
  is the Gregorian equivalent of the BS endpoints, computed from `shared/data`, and the table marks
  it `derived`.
- For B1, a date is in range when its BS date is inside the BS range. For B2, a date is in range
  when its AD date is inside the AD range. Only in-range dates count for "agrees".
- `bench/measure.ts` reports `inRange` (for example `58/64`), the out-of-range dates, `agrees`,
  the first in-range mismatch and any throw. Timing uses the in-range dates only and the table says
  `ns/op (n=58)`. A date that throws inside the range is a mismatch and is left out of the timing,
  with `throws` reported.
- `docs/benchmarks.md` has a range table with the two ranges, the source, the in-range count for B1
  and B2, the out-of-range dates, the agreement and the first in-range mismatch. No package is
  ranked.

AC:
- `node bench/compare.ts --check` prints, for every competitor and direction, the in-range count,
  the out-of-range dates and the first in-range mismatch.
- The page has the source citation for every range. `derived` is used wherever the package does not
  document an AD range.
- A competitor that disagrees inside its own range is shown as a mismatch with the first date, not
  as out of range.

## T6-04 Load discipline

- `bench/load.ts` adds `coreLoad(index, windowMs)`, the busy share of one logical CPU. The existing
  `machineLoad` stays as the all-CPU figure.
- Before every TypeScript measurement the child samples the all-CPU figure and core 2, the CPU it
  is pinned to. If the all-CPU figure is over 15% busy, it waits 5 s and retries, up to 5 times.
  After the sixth sample it records the row with `loaded: true` and still measures it. The gate is
  all-CPU because the machine was measured at 35% to 76% while core 2 was often below 15%, and the
  loaded all-CPU runs were 35% slower; core 2 alone would call those runs final.
- A row marked `loaded` is excluded from every target verdict. `docs/benchmarks.md` has a verdict
  table that says `final` or `pending a quiet run` for each target. No target is relaxed.
- The C# run records core 2 load before and after the job (not during, because BenchmarkDotNet
  itself runs on core 2) and the median all-CPU load during it.

AC:
- `docs/benchmarks.md` shows core 2 load and all-CPU load next to every row, the retry count, and
  `loaded` where it applies.
- The verdict table marks a target `final` only when both the TypeScript row and the C# row it is
  compared with are not loaded; otherwise it says `pending a quiet run`.
- Negative control: busy loops on six logical CPUs put the all-CPU figure over 15% and make a B1
  child report `loaded: true` with six attempts, and the page keeps that row out of the verdicts.

## T6-05 Release runbook

Rewrite `docs/runbooks/release.md` for a release that a second person can run:

- Preconditions: U-04 settled (the source of the tithi, holiday and event data is cleared for
  publication under MIT), owner approval, green CI on `main`, and the `production` environment
  reviewer configured.
- Tag step: `git tag vX.Y.Z` and `git push origin vX.Y.Z`, after `release-check` passes.
- What each `release.yml` job does: `pack` (CI, version check, build, pack, publint and attw,
  upload the tarballs) and `publish` (tag push only, production environment, core then patro,
  provenance, GitHub Release).
- Verify on npm: provenance attestation, `npm audit signatures`, `npm pack` the published version
  and run `npx attw` on that tarball, check the version and the peer range.
- Rollback: `npm deprecate` both versions, publish a patch, never `npm unpublish`.
- Name fallback: npm may reject `nepdate` as too similar to the existing `nep-date`. The fallback is
  `@sanamhub/nepdate` and `@sanamhub/nepdate-patro`, decided by the owner at that moment; the runbook
  says what changes and what does not.
- Add `docs/runbooks/*.md` to `scripts/docs-check.ts`.

AC:
- The runbook contains every section above.
- Gate 10 scans the runbook. Negative control: an em dash, a task ID or a broken relative link in
  the runbook fails gate 10 and names the line.
- No tag, publish, remote or repository setting is changed.

## Checkpoint

The implementation agent stops after T6-05. The reviewer checks:

- [ ] A fresh clone runs `npm ci && npm run ci` and ends with `ci: 10/10 gates passed`.
- [ ] `node bench/order.ts` shows B1 alone and B1 after every competitor, with the loads and PIDs.
- [ ] The C# column comes from this machine and this session, and the hub-machine values are gone.
- [ ] Every competitor range has a source, the in-range counts are shown, out-of-range dates are
      listed, and in-range mismatches are not excused.
- [ ] Loaded rows are marked and excluded from the verdicts; the final and pending verdicts are
      listed.
- [ ] The runbook is complete and gate 10 fails on a deliberate error in it.
- [ ] No tag, publish, remote or repository setting was changed.
