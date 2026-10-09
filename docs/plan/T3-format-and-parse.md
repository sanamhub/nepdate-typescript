# T3: Formatting and parsing

Read first: `shared/spec/FORMATTING.md`, `shared/spec/PARSING.md`, `docs/API.md` (formatting,
parse), PARITY D-04, D-05, D-06, D-15, `shared/spec/PORT-PLAN.md` phase 3.

All files are in `packages/nepdate/`.

## Tasks

### T3-01 Names and digits
Name arrays per FORMATTING §1 (frozen). `toNepaliDigits` by char-code offset `0x0966`; never
`Intl.NumberFormat("ne-NP")` (it inserts group separators such as "२,०८१"). At module load also
build the lookup tables the formatters use (ADR-0002 §8): Devanagari and ASCII strings for 0 to 99
with and without padding, and for the years 1901 to 2199.
AC: `toNepaliDigits(2081) === "२०८१"`; `toNepaliDigits(5, 2) === "०५"`; `monthShortName(3) ===
"Asa"` and `monthShortName(6) === "Aso"` (D-04).

### T3-02 `toString`, `toJSON`, `short`, `long`
Build each result from precomputed parts with `Array.prototype.join("")` (ADR-0002 §8: it returns a
flat string, cheaper overall than a template literal's rope once the string is read). No digit
conversion at call time, no regex, no `Intl.DateTimeFormat` (it has no Bikram Sambat calendar).
AC: golden `dates.tsv` (1018 rows) columns `to_string` (`toString()`), `unicode`
(`short({order: "ymd", separator: "/", pad: true, lang: "ne"})`), `long_en` (`long()`),
`long_en_weekday` (`long({weekday: true})`), `long_ne` (`long({lang: "ne"})`), `long_ne_weekday`
(`long({weekday: true, lang: "ne"})`), `dmy_dash_nopad`
(`short({order: "dmy", separator: "-", pad: false})`); the FORMATTING §3 and §4 examples;
`JSON.stringify({d: NepaliDate.of(2081, 4, 15)})` is `{"d":"2081-04-15"}`.

### T3-03 `format` (FORMATTING §5)
Tokenise a pattern once and keep up to 32 compiled patterns in a `Map` (evict the oldest).
AC: golden `format-pattern.tsv` (451 rows) with `lang` `"en"`, skipping only rows whose pattern
contains a run of exactly three `M` and whose date is in month 3 or 6, with a comment naming D-04; the FORMATTING §5
examples; formatting 40 different patterns leaves the cache at 32 entries.

### T3-04 Strict `parse` / `tryParse` (PARSING §1)
One pass over the string with `charCodeAt` (ADR-0002 §9): a `Uint8Array(128)` marks separators;
ASCII digits (`0x30..0x39`) and Devanagari digits (`0x0966..0x096F`) are accumulated as integers,
at most 4 digits per group; then the same validation as `of`. No regex, no `split`, no substring.
Vector kinds map to `ErrorKind` by kebab case: `ERR:InvalidCharacter` → `"invalid-character"`,
`ERR:WrongGroupCount` → `"wrong-group-count"`, `ERR:NumberTooLong` → `"number-too-long"`,
`ERR:OutOfRange` → `"out-of-range"`, `ERR:InvalidMonth` → `"invalid-month"`, `ERR:InvalidDay` →
`"invalid-day"`, `ERR:Ambiguous` → `"ambiguous"`, `ERR:Unrecognized` → `"unrecognized"`.
AC:
- Every row of `shared/spec/vectors/parse.tsv` (57 rows), column `strict`: `parse` returns that
  date, or throws `NepDateError` with the mapped `kind`; `tryParse` returns the same date or
  `null`.
- `shared/spec/vectors/csharp-golden/parse.tsv` is for comparison only (PARSING intro) and is not
  a test input.

### T3-05 `parseLenient` (PARSING §2)
`s.normalize("NFC")`, strip U+200C/U+200D, then the closed month-name list from the spec (Latin names
compared lower-case; Devanagari variants listed explicitly).
AC:
- Every row of `parse.tsv`, column `lenient`, with the mapped `kind`.
- Fuzz test: 10,000 strings of length 0 to 20 from a seeded generator over the alphabet ASCII
  digits, Devanagari digits, every PARSING separator, `,`, Latin letters and the Devanagari letters
  in PARSING §3. `parse`, `tryParse` and `parseLenient` either return a `NepaliDate` or throw
  `NepDateError`; nothing else is thrown.

### T3-06 Catalogue, property tests, benchmark
- `test/csharp-catalog.test.ts`: add every catalogue row tagged phase 3.
- `test/property.test.ts` (fast-check, fixed seed): `parse(d.toString())` equals `d`;
  `parse(d.short({lang: "ne"}))` equals `d`; `parseLenient(d.long())` equals `d`.
- `bench/own.ts`: add B5 (`long({weekday: true, lang: "ne"})`, then read the last char code of the
  result so a rope is flattened inside the measurement) and B6 (`parse` of the 64 `YYYY/MM/DD`
  strings).
AC: the catalogue test lists no missing id for phase 3; the PR pastes the `bench/own.ts` output.

## Checkpoint

The implementation agent stops here. The reviewer checks:
- [ ] `npm run ci` passes; `format-pattern.tsv` skips only the D-04 rows, each skip naming D-04.
- [ ] Every catalogue row tagged phase 3 has a case or a named deviation.
- [ ] Every `parse.tsv` row checks the error `kind`, not only that something was thrown.
- [ ] The fuzz test ran 10,000 inputs with a fixed seed and threw nothing but `NepDateError`.
- [ ] No regex and no `Intl` in `long`, `short`, `format` or `parse` (`parseLenient` may use
      `normalize`).
- [ ] `bench/own.ts` in the PR: B5 < 153 ns and B6 < 64 ns (ADR-0002 §10).
