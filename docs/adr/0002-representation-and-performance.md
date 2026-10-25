# ADR-0002: Representation, tables and performance (pure TypeScript)

- Status: Accepted
- Date: 2026-09-25
- Updated: 2026-10-08 (performance first: representation, tables and patro layout chosen by
  measurement; patro tables live in `nepdate-patro`, hub ADR-0004)
- Deciders: Sanam Pakuwal

## Context

Performance is the first priority of the family: `nepdate` must be the fastest Bikram Sambat
package on npm and land within 3× of C# NepDate on B1, B2 and B7 (hub `shared/spec/BENCHMARK.md`
§6). C# NepDate is fast because every conversion is one array read plus a short fix-up, and its
tables are primitive arrays (hub `docs/research/dotnet-internals.md`, "Lessons for the ports").

In JavaScript the costs are different from .NET: every `NepaliDate` and every `{year, month, day}`
result is a heap object, `Math.floor` on a division is slower than `| 0`, V8 keeps template-literal
results as unflattened rope strings, and a large array literal in a module costs parse time and
bundle size. So each choice below was measured on the reference machine rather than copied from C#.

Compiling the Rust crate to WASM was rejected earlier and stays rejected: a boundary crossing and
string marshalling on every call (formatting and parsing are hot paths), tens of KB of binary
against a few KB of tables, async instantiation, and no way to keep the patro out of the core.

## Measurements

All numbers: Node 24.19.0, mitata 1.0.34, `node --expose-gc`, the reference machine of BENCHMARK
§1, each benchmark in its own process started with `start /affinity 4 /wait /b node <file>`
(logical CPU 2), 2026-10-08. Time is mean ns per operation (iteration over the 64 dates / 64).
"heap" is mitata's heap delta per operation: plausible for objects, not reliable for strings
(ropes), so the benchmark report marks it approximate (BENCHMARK §4). Prototype code is outside the
repository and is not part of this decision; the C# column is from the hub's `docs/benchmarks/dotnet.md`.

Representation of `NepaliDate` (B1 includes the `{year, month, day}` result object):

| Variant | B1 | B2 | B3 | B4 | read y+m+d+weekday | heap per date |
|---|---:|---:|---:|---:|---:|---:|
| **R1: `year`, `month`, `day` fields + private `#serial`** | **24.0** | **21.6** | **12.0** | **9.6** | **3.1** | 56 B |
| R2: `#serial` only, fields computed by getters | 26.1 | 278 (p50 35.6) | 12.5 | 16.4 | 28.1 | 32 B |
| R3: `#serial` + packed month index and day | 33.5 | 44.8 | 20.2 | 17.0 | 4.5 | 40 B |
| C# NepDate 2.0.7, .NET 10 | 13.29 | 18.64 | 17.50 | 18.85 | | 0 B (struct) |

Four integer divisions per call (time per call): `Math.floor(a / b)` 12.4 ns,
`Math.trunc(a / b)` 8.0 ns, `(a / b) | 0` 4.6 ns.

Tables (esbuild minified size, gzip level 9, and the median `import()` time of 11 runs; an empty
module imports in 0.87 ms):

| Table encoding | min | gzip | import |
|---|---:|---:|---:|
| **2-bit packed month lengths, one base64 string, prefix sums at load** | **1,619 B** | **418 B** | **1.33 ms** |
| month lengths as a number array literal | 11,118 B | 463 B | 1.14 ms |
| `MONTH_START` as an `Int32Array` literal | 21,514 B | 9,349 B | 1.00 ms |

The O(1) month estimate `(serial * 3588 / 109212) | 0` is at most one month away from the true
month for every one of the 109,212 serials, so one comparison each way fixes it (checked
exhaustively). An earlier unpinned run had the binary search over `YEAR_START` 2× to 5× slower.

Patro, B7 (inputs per BENCHMARK §3) and B8 (one operation = one month grid of `info` calls):

| Variant | B7 | heap | B8 per grid |
|---|---:|---:|---:|
| new object per call, binary search for holiday and event day | 24.2 | 48 B | |
| new object per call, O(1) per-day index | 10.4 | 48 B | 667 |
| lazily built frozen object per day, cached | 4.5 | 0 | |
| **frozen `CalendarInfo` per day, built at module load** | **3.2** | **0** | **141** |
| the same, including the serial via `NepaliDate.MIN.daysUntil(date)` | 4.3 | 0 | |
| C# NepDate 2.0.7, .NET 10 | 47.93 | 51 B | 3,133 |

Holiday flag alone: bit set 3.9 ns, binary search over 294 serials 9.6 ns. Building the per-day
index takes 0.6 to 0.7 ms and the frozen objects 0.9 to 1.3 ms at load; `import()` of the whole
prototype patro module takes 4.7 to 5.3 ms. Its bundle is 118,883 B minified, 21,611 B gzip (base64
typed arrays), against 145,646 B and 29,588 B for plain array literals. Our B8 omits the per-day
BS to AD construction that the C# B8 includes; `docs/benchmarks.md` measures the full protocol.

Formatting and parsing:

| Variant | B5 / B6 | heap |
|---|---:|---:|
| B5 template literal + Devanagari digit tables, string left as a rope | 77 to 90 | 201 B |
| B5 the same, then the string is read (flattened) | 195 to 310 | |
| **B5 array `join` + digit tables (flat string)** | **123 to 138** | 239 B |
| B5 `Uint16Array` scratch + `String.fromCharCode.apply` | 166 | 142 B |
| B5 regex replace of ASCII digits | 593 | |
| C# NepDate B5 | 153.02 | 435 B |
| **B6 `charCodeAt` loop, validate once** | **90 (p50 42)** | 46 B |
| B6 sticky regex + `exec` | 86 (p50 78) | 246 B |
| B6 `split` + `Number` (no validation) | 254 | 136 B |
| C# NepDate B6 | 21.55 | 0 B |

## Decision

1. **Pure TypeScript, no WASM.** Share the data, not the binary (hub ADR-0001).
2. **No `Date` in the core.** `Date` appears only at the edges (`fromJSDate`, `toJSDate`, `today`).
3. **Representation R1.** A `NepaliDate` has public readonly `year`, `month`, `day` (set once in
   the constructor, in that order, so every instance has the same V8 hidden class) and a private
   `#serial` (ALGORITHM §4). Reading a field is a plain property load (3.1 ns for four reads);
   arithmetic and weekday use `#serial`. No `Object.freeze` per instance: it doubled the B1
   allocation in the prototype. `addDays` and `fromGregorian` compute the fields once from the
   serial; `addMonths` computes the serial from the month index without a search.
4. **Integer arithmetic with `| 0`.** Every division and remainder in the core uses `(a / b) | 0`
   and `%` on operands that are proven to lie in `[0, 2^31)`. Gregorian conversion is Hinnant's
   `days_from_civil` / `civil_from_days` (ALGORITHM §5) with the era shifted so all intermediate
   values are non-negative. `Math.floor` is not used in a hot path.
5. **Tables.** The generator emits one base64 string of the 3588 month lengths, 2 bits each
   (length − 29). At module load `src/tables.ts` decodes it into `MONTH_LENGTHS` (`Uint8Array`,
   3588) and builds `MONTH_START` (`Int32Array`, 3589) and `YEAR_START` (`Int32Array`, 300) by
   prefix sums, about 0.5 ms. Typed arrays keep V8 on its integer fast paths.
6. **Conversion is O(1) both ways.** BS to AD: `MONTH_START[(y − 1901) * 12 + m − 1] + d − 1`, then
   Hinnant. AD to BS: Hinnant to a serial, then the month estimate of the Measurements section with
   one correction step, then year, month and day by integer division of the month index.
   Validation happens once, in `of` and `fromGregorian`, with the month length read from
   `MONTH_START[i + 1] − MONTH_START[i]`.
7. **Patro tables (`packages/nepdate-patro/src/tables.gen.ts`, never in the core).** The generator
   emits base64 typed arrays: the tithi index per day from `TITHI_FIRST` (`Uint8Array`), sorted
   holiday serials and event-day serials (`Int32Array`), events per event day, event name ids into
   one deduplicated pool of 753 (np, en) pairs (PATRO §3). At module load `src/index.ts` builds one
   frozen `Named` per pool entry, one frozen events array per event day, and one frozen
   `CalendarInfo` per day of the coverage (2793 days today; days with no data share one frozen
   empty object). `info(date)` is then a range check and one array read: 3.2 ns, no allocation.
   This is the dense per-day layout PATRO §3 allows when a benchmark shows it is faster.
   `nepdate-patro` gets a date's serial through the public API only: `NepaliDate.MIN.daysUntil(date)`,
   and back with `NepaliDate.MIN.addDays(serial)`. The core exports nothing extra for it.
8. **Formatting.** Names, Devanagari digit strings for 0 to 99 and the years 1901 to 2199 are
   precomputed once at module load. `long()` and `format()` build the result with `Array.prototype.join`
   over precomputed parts, which returns a flat string; a template literal is faster to build but
   leaves a rope that costs more than `join` the first time it is read. No regex in formatting.
9. **Parsing.** One pass over `charCodeAt` with a separator lookup table (`Uint8Array(128)`),
   digits accumulated as integers, validation once at the end through the same check as `of`. No
   `split`, no regex, no intermediate strings.
10. **Targets** (Node 24, reference machine, measured in `docs/benchmarks.md`):

    | ID | Target | BENCHMARK §6 limit (3× C#) | Prototype |
    |---|---:|---:|---:|
    | B1 | < 30 ns | 39.9 ns | 24.0 |
    | B2 | < 30 ns | 55.9 ns | 21.6 |
    | B3, B4 | < 20 ns | | 12.0, 9.6 |
    | B5 | < 153 ns (faster than C#) | | 123 to 138 |
    | B6 | < 64 ns (3× C#) | | 90 (p50 42) |
    | B7 | < 10 ns, 0 bytes | 143.8 ns | 3.2 |

    Also faster than every competitor in `docs/competitors.md` that agrees with the data. A miss is
    reported to the maintainer with a `--cpu-prof` profile, not fixed by guessing.

## Consequences

- No time-zone dependence in any conversion; `fromJSDate(d, "utc" | "local")` makes the caller choose.
- A `NepaliDate` costs about 56 bytes of heap against C#'s 32-byte struct on the stack. JavaScript
  can't avoid the object; short-lived dates die in V8's young generation, and the benchmark
  reports the heap column so the cost stays visible.
- The core bundle stays small (tables 418 B gzip), so a bundler can inline it; gate 6 keeps it
  under 8 KB.
- Importing `nepdate-patro` costs about 5 ms and about 22 KB gzip, paid only by apps that show the
  patro.
- `info(date)` returns the same frozen object for a day on every call; callers can compare by
  identity and can't mutate it.
