# Equivalent mutants

Every row is a survivor that no test can kill. The mutant id is the Stryker report key, the diff
is the mutator and its replacement, and the proof says why no input can observe the change.

| Mutant | Diff | Proof |
|---|---|---|
| `packages/nepdate-patro/src/build.ts#20` | `ConditionalExpression` -> `true` at line 68 | Every code above the upper bound is outside the base64 alphabet, and lower letters and digits have already returned, so the upper bound never decides for a base64 character. |
| `packages/nepdate-patro/src/build.ts#30` | `ConditionalExpression` -> `true` at line 69 | Every code above the upper bound is outside the base64 alphabet, and lower letters and digits have already returned, so the upper bound never decides for a base64 character. |
| `packages/nepdate-patro/src/build.ts#49` | `EqualityOperator` -> `c <= clean.length` at line 82 | The extra pass at c = clean.length reads NaN codes, and every write is guarded by `out < bytes.length`, which is already false after the last group. |
| `packages/nepdate-patro/src/build.ts#56` | `EqualityOperator` -> `c + 2 <= clean.length` at line 86 | The fallback 61 and an out-of-range read (NaN) both map to 63, and the bits of a padding position only reach bytes that the `out < bytes.length` guard drops, so the choice is not observed. |
| `packages/nepdate-patro/src/build.ts#58` | `ArithmeticOperator` -> `c - 2` at line 86 | The fallback 61 and an out-of-range read (NaN) both map to 63, and the bits of a padding position only reach bytes that the `out < bytes.length` guard drops, so the choice is not observed. |
| `packages/nepdate-patro/src/build.ts#54` | `ConditionalExpression` -> `true` at line 86 | The fallback 61 and an out-of-range read (NaN) both map to 63, and the bits of a padding position only reach bytes that the `out < bytes.length` guard drops, so the choice is not observed. |
| `packages/nepdate-patro/src/build.ts#62` | `EqualityOperator` -> `c + 3 <= clean.length` at line 87 | The fallback 61 and an out-of-range read (NaN) both map to 63, and the bits of a padding position only reach bytes that the `out < bytes.length` guard drops, so the choice is not observed. |
| `packages/nepdate-patro/src/build.ts#64` | `ArithmeticOperator` -> `c - 3` at line 87 | The fallback 61 and an out-of-range read (NaN) both map to 63, and the bits of a padding position only reach bytes that the `out < bytes.length` guard drops, so the choice is not observed. |
| `packages/nepdate-patro/src/build.ts#60` | `ConditionalExpression` -> `true` at line 87 | A write at or past the end of a Uint8Array is ignored and `out` is not read after the loop, so dropping or widening the guard stores the same bytes. |
| `packages/nepdate-patro/src/build.ts#66` | `ConditionalExpression` -> `true` at line 88 | A write at or past the end of a Uint8Array is ignored and `out` is not read after the loop, so dropping or widening the guard stores the same bytes. |
| `packages/nepdate-patro/src/build.ts#68` | `EqualityOperator` -> `out <= bytes.length` at line 88 | A write at or past the end of a Uint8Array is ignored and `out` is not read after the loop, so dropping or widening the guard stores the same bytes. |
| `packages/nepdate-patro/src/build.ts#71` | `ConditionalExpression` -> `true` at line 89 | A write at or past the end of a Uint8Array is ignored and `out` is not read after the loop, so dropping or widening the guard stores the same bytes. |
| `packages/nepdate-patro/src/build.ts#73` | `EqualityOperator` -> `out <= bytes.length` at line 89 | A write at or past the end of a Uint8Array is ignored and `out` is not read after the loop, so dropping or widening the guard stores the same bytes. |
| `packages/nepdate-patro/src/build.ts#102` | `ArithmeticOperator` -> `COVERAGE_LAST + COVERAGE_FIRST` at line 126 | info() returns the empty info outside COVERAGE_FIRST..COVERAGE_LAST before it reads the array, so entries past the real span are built but never read. |
| `packages/nepdate-patro/src/build.ts#106` | `EqualityOperator` -> `i <= eventSerials.length` at line 132 | The extra pass reads an undefined count and serial, builds an empty array and stores it under the key NaN, which the per-offset loop never reads. |
| `packages/nepdate/src/date.ts#37` | `ArithmeticOperator` -> `MAX_SERIAL - 1` at line 59 | The smaller divisor raises the estimate by under 0.07 of a month and the one-step correction still finds the right month: exhaustive.test.ts checks every serial 0..109211 against a binary search and passes with this mutant. |
| `packages/nepdate/src/date.ts#59` | `EqualityOperator` -> `date.day < length` at line 92 | At day == length both branches take the same value, so < and <= are identical for every date. |
| `packages/nepdate/src/date.ts#211` | `LogicalOperator` -> `year < MIN_AD_YEAR && year > MAX_AD_YEAR` at line 230 | The and form is false for every year, and the serial check still rejects every out-of-range year with the same error. |
| `packages/nepdate/src/digits.ts#470` | `EqualityOperator` -> `n <= 0` at line 18 | For n = 0 the mutant formats -0, and String(-0) is "0", the same text with no sign. |
| `packages/nepdate/src/digits.ts#488` | `ArrayDeclaration` -> `new Array()` at line 29 | The array is filled at every index it is read from before any read, so the initial length is not observed. |
| `packages/nepdate/src/digits.ts#489` | `ArrayDeclaration` -> `new Array()` at line 30 | The array is filled at every index it is read from before any read, so the initial length is not observed. |
| `packages/nepdate/src/digits.ts#490` | `ArrayDeclaration` -> `new Array()` at line 31 | The array is filled at every index it is read from before any read, so the initial length is not observed. |
| `packages/nepdate/src/digits.ts#491` | `ArrayDeclaration` -> `new Array()` at line 32 | The array is filled at every index it is read from before any read, so the initial length is not observed. |
| `packages/nepdate/src/digits.ts#493` | `EqualityOperator` -> `i <= COUNT` at line 33 | The extra pass writes index 100, which no caller reads: digitText is only called with a month, a day or year % 100, all in 0..99. |
| `packages/nepdate/src/digits.ts#501` | `ArithmeticOperator` -> `MAX_YEAR - MIN_YEAR - 1` at line 41 | ASCII_YEAR and NE_YEAR are plain arrays filled by index y - MIN_YEAR in a loop over MIN_YEAR..MAX_YEAR that does not read YEARS, so the declared length is not observed. |
| `packages/nepdate/src/digits.ts#502` | `ArithmeticOperator` -> `MAX_YEAR + MIN_YEAR` at line 41 | ASCII_YEAR and NE_YEAR are plain arrays filled by index y - MIN_YEAR in a loop over MIN_YEAR..MAX_YEAR that does not read YEARS, so the declared length is not observed. |
| `packages/nepdate/src/digits.ts#503` | `ArrayDeclaration` -> `new Array()` at line 42 | ASCII_YEAR and NE_YEAR are plain arrays filled by index y - MIN_YEAR in a loop over MIN_YEAR..MAX_YEAR that does not read YEARS, so the declared length is not observed. |
| `packages/nepdate/src/digits.ts#504` | `ArrayDeclaration` -> `new Array()` at line 43 | ASCII_YEAR and NE_YEAR are plain arrays filled by index y - MIN_YEAR in a loop over MIN_YEAR..MAX_YEAR that does not read YEARS, so the declared length is not observed. |
| `packages/nepdate/src/fiscal.ts#527` | `ConditionalExpression` -> `false` at line 17 | NepaliDate.of repeats the same year range check with the same message, so removing the guard only moves the throw. |
| `packages/nepdate/src/fiscal.ts#585` | `StringLiteral` -> `""` at line 96 | label branches only on "ne"; every other value uses the English branch, so "" and "en" are identical. |
| `packages/nepdate/src/format.ts#604` | `ArrayDeclaration` -> `new Array()` at line 34 | The array is filled at indices 0..2 before it is read; the initial length is not observed. |
| `packages/nepdate/src/format.ts#630` | `ArrayDeclaration` -> `["Stryker was here"]` at line 74 | The injected string has no kind; formatDate only treats kind === "lit" specially, so a string token is ignored before join. |
| `packages/nepdate/src/format.ts#659` | `ArithmeticOperator` -> `i - 1` at line 89 | i - 1 < length is true for every index, so this is the same as the true condition above: the trailing-backslash text is undefined and join writes nothing. |
| `packages/nepdate/src/names.ts#954` | `StringLiteral` -> `""` at line 80 | monthName branches only on lang === "ne"; every other value uses the English table, so "" and "en" are identical. |
| `packages/nepdate/src/names.ts#956` | `StringLiteral` -> `""` at line 90 | monthShortName branches only on lang === "ne"; every other value uses the English table, so "" and "en" are identical. |
| `packages/nepdate/src/names.ts#962` | `StringLiteral` -> `""` at line 99 | weekdayName branches only on lang === "ne"; every other value uses the English table, so "" and "en" are identical. |
| `packages/nepdate/src/names.ts#964` | `StringLiteral` -> `""` at line 108 | weekdayShortName branches only on lang === "ne"; every other value uses the English table, so "" and "en" are identical. |
| `packages/nepdate/src/parse.ts#1039` | `ConditionalExpression` -> `true` at line 32 | STRICT_SEPARATOR is a Uint8Array(128); for a code of 128 or more the read is undefined, never 1, so dropping `c < 128` changes no result. |
| `packages/nepdate/src/parse.ts#1040` | `EqualityOperator` -> `c <= 128` at line 32 | STRICT_SEPARATOR has 128 entries; index 128 is undefined, so c <= 128 and c < 128 both reject code 128. |
| `packages/nepdate/src/parse.ts#1088` | `EqualityOperator` -> `code < 0x5a` at line 72 | The only folded letters that matter are A-Z and the Kelvin sign; Z does not occur in any month name or era spelling, so the missing fold changes no accepted input. |
| `packages/nepdate/src/parse.ts#1198` | `ObjectLiteral` -> `{}` at line 129 | lenientParts treats every token that is neither month nor num as a word, so an object without kind and a "word" object are the same. |
| `packages/nepdate/src/parse.ts#1199` | `StringLiteral` -> `""` at line 129 | lenientParts treats every token that is neither month nor num as a word, so an object without kind and a "word" object are the same. |
| `packages/nepdate/src/parse.ts#1206` | `ConditionalExpression` -> `false` at line 137 | An empty chunk has no characters, so its flush classifies nothing; the early return and the empty pass produce the same tokens. |
| `packages/nepdate/src/parse.ts#1208` | `StringLiteral` -> `"Stryker was here!"` at line 137 | The comparison is only true for an empty chunk, which the line above already returns on; for every non-empty chunk it is false. |
| `packages/nepdate/src/parse.ts#1304` | `ConditionalExpression` -> `true` at line 190 | A num token comes from a non-empty all-digit piece, so its digits are at least 1 and `b.digits >= 1` is always true. |
| `packages/nepdate/src/parse.ts#1319` | `ConditionalExpression` -> `true` at line 193 | A num token comes from a non-empty all-digit piece, so its digits are at least 1 and `a.digits >= 1` is always true. |
| `packages/nepdate/src/tables.ts#1600` | `ConditionalExpression` -> `true` at line 22 | Every code above the upper bound is outside the base64 alphabet, and lower letters and digits have already returned, so the upper bound never decides for a base64 character. |
| `packages/nepdate/src/tables.ts#1619` | `LogicalOperator` -> `c < text.length || month < MONTHS` at line 31 | PACKED_MONTH_LENGTHS has 1196 characters for 3588 months with no padding (test `the packed month lengths fill the table exactly`), so `c < text.length` and `month < MONTHS` turn false on the same iteration and either one ends the loop at the same point. |
| `packages/nepdate/src/tables.ts#1621` | `EqualityOperator` -> `c <= text.length` at line 31 | PACKED_MONTH_LENGTHS has 1196 characters for 3588 months with no padding (test `the packed month lengths fill the table exactly`), so `c < text.length` and `month < MONTHS` turn false on the same iteration and either one ends the loop at the same point. |
| `packages/nepdate/src/tables.ts#1654` | `EqualityOperator` -> `i <= MONTHS` at line 46 | The extra pass reads MONTH_LENGTHS[3588] (undefined) and writes NaN to MONTH_START[3589], past the end of the Int32Array, which a typed array ignores. |
| `packages/nepdate/src/range.ts#1370` | `StringLiteral` -> ```` at line 65 | Only the message template changes; the kind and the error are the same. |
| `packages/nepdate/src/range.ts#1416` | `EqualityOperator` -> `otherStart >= thisEnd` at line 159 | When the day is shared the branch returns false, and the fall-through also returns false. |
| `packages/nepdate/src/range.ts#1421` | `ConditionalExpression` -> `true` at line 159 | At MAX_SERIAL there is no next day, so otherStart === thisEnd + 1 is unreachable. |
| `packages/nepdate/src/range.ts#1422` | `EqualityOperator` -> `thisEnd <= MAX_SERIAL` at line 159 | At MAX_SERIAL the equality is unreachable, because otherStart cannot be MAX_SERIAL + 1. |
| `packages/nepdate/src/range.ts#1427` | `ConditionalExpression` -> `true` at line 160 | When the day is shared the branch returns false, and the fall-through also returns false. |
| `packages/nepdate/src/range.ts#1429` | `EqualityOperator` -> `thisStart >= otherEnd` at line 160 | When the day is shared the second branch returns false, and the final return is false. |
| `packages/nepdate/src/range.ts#1434` | `ConditionalExpression` -> `true` at line 160 | At MAX_SERIAL there is no next day, so thisStart === otherEnd + 1 is unreachable. |
| `packages/nepdate/src/range.ts#1435` | `EqualityOperator` -> `otherEnd <= MAX_SERIAL` at line 160 | At MAX_SERIAL the equality is unreachable, because thisStart cannot be MAX_SERIAL + 1. |
| `packages/nepdate/src/range.ts#1500` | `StringLiteral` -> ```` at line 248 | Only the message template changes; the kind and the error are the same. |
| `packages/nepdate/src/range.ts#1507` | `StringLiteral` -> ```` at line 250 | Only the message template changes; the kind and the error are the same. |
| `packages/nepdate/src/range.ts#1527` | `StringLiteral` -> `""` at line 281 | shortDate tests lang === "ne"; an empty value takes the English branch. |
| `packages/nepdate/src/date.ts#24` | `ConditionalExpression` -> `true` at line 46 | A value that is not a 32-bit integer but is safe takes the same no-throw path, and a non-safe value fails both conditions. |
| `packages/nepdate/src/date.ts#210` | `ConditionalExpression` -> `false` at line 230 | Dropping the year guard still ends in the serial check, which throws the same out-of-range error. |
| `packages/nepdate/src/date.ts#212` | `ConditionalExpression` -> `false` at line 230 | A year below the minimum computes a negative serial, which the serial check rejects. |
| `packages/nepdate/src/date.ts#215` | `ConditionalExpression` -> `false` at line 230 | A year above the maximum computes a serial past MAX_SERIAL, which the serial check rejects. |
| `packages/nepdate/src/date.ts#260` | `ConditionalExpression` -> `true` at line 289 | formatToParts ends with the day part, and any earlier part only writes a day that the day part overwrites. |
| `packages/nepdate/src/date.ts#270` | `StringLiteral` -> ```` at line 294 | Only the message template changes; the kind and the error are the same. |
| `packages/nepdate/src/date.ts#278` | `BlockStatement` -> `{}` at line 333 | Every input the strict parser accepts is read by the lenient numeric form to the same date; only the fast path is lost. |
| `packages/nepdate/src/date.ts#279` | `BlockStatement` -> `{}` at line 335 | A non-NepDateError from the strict scan still fails in the lenient scan with the same error class; wording is not API. |
| `packages/nepdate/src/date.ts#282` | `ConditionalExpression` -> `false` at line 336 | A non-NepDateError from the strict scan still fails in the lenient scan with the same error class; wording is not API. |
| `packages/nepdate/src/date.ts#290` | `BlockStatement` -> `{}` at line 369 | Invalid JSON then fails the value check with the same unrecognized kind; wording is not API. |
| `packages/nepdate/src/date.ts#293` | `StringLiteral` -> `""` at line 370 | Only the message text changes; the kind and the error are the same. |
| `packages/nepdate/src/date.ts#301` | `StringLiteral` -> `""` at line 373 | Only the message text changes; the kind and the error are the same. |
| `packages/nepdate/src/date.ts#304` | `StringLiteral` -> `""` at line 387 | The name only appears in the message, and the wording is not API. |
| `packages/nepdate/src/date.ts#371` | `StringLiteral` -> `""` at line 504 | Only "spill" changes the branch; an empty value takes the clamp branch. |
| `packages/nepdate/src/date.ts#375` | `StringLiteral` -> `""` at line 513 | Only "spill" changes the branch; an empty value takes the clamp branch. |
| `packages/nepdate/src/date.ts#422` | `StringLiteral` -> `""` at line 586 | The formatters test lang === "ne"; an empty value takes the English branch. |
| `packages/nepdate/src/date.ts#427` | `StringLiteral` -> `""` at line 591 | The formatters test lang === "ne"; an empty value takes the English branch. |
| `packages/nepdate/src/date.ts#445` | `StringLiteral` -> `""` at line 616 | The formatters test lang === "ne"; an empty value takes the English branch. |
| `packages/nepdate/src/date.ts#458` | `StringLiteral` -> `""` at line 638 | The formatters test lang === "ne"; an empty value takes the English branch. |
| `packages/nepdate/src/date.ts#459` | `StringLiteral` -> `""` at line 643 | The formatters test lang === "ne"; an empty value takes the English branch. |
| `packages/nepdate/src/date.ts#2` | `ConditionalExpression` -> `false` at line 33 | The checked path accepts the same integers and rejects bool, so only the fast path changes. |
| `packages/nepdate/src/format.ts#663` | `EqualityOperator` -> `j <= pattern.length` at line 90 | Reading past the pattern gives NaN, which fails the quote test; slice clamps, so the tokens are the same. |
| `packages/nepdate/src/format.ts#673` | `ConditionalExpression` -> `true` at line 92 | After an unterminated quote the loop index past the end only ends the outer loop; the token text is the same. |
| `packages/nepdate/src/format.ts#675` | `EqualityOperator` -> `j <= pattern.length` at line 92 | After an unterminated quote the loop index past the end only ends the outer loop; the token text is the same. |
| `packages/nepdate/src/format.ts#692` | `ConditionalExpression` -> `true` at line 95 | Reading the end of the pattern gives NaN, which fails the run test, so the extra bound never runs. |
| `packages/nepdate/src/format.ts#693` | `EqualityOperator` -> `j <= pattern.length` at line 95 | Reading the end of the pattern gives NaN, which fails the run test, so the extra bound never runs. |
| `packages/nepdate/src/format.ts#704` | `StringLiteral` -> `""` at line 97 | render treats any kind other than "lit" as a field, so an empty kind takes the same branch. |
| `packages/nepdate/src/format.ts#717` | `StringLiteral` -> `""` at line 100 | render treats any kind other than "lit" as a field, so an empty kind takes the same branch. |
| `packages/nepdate/src/format.ts#734` | `StringLiteral` -> `""` at line 103 | render treats any kind other than "lit" as a field, so an empty kind takes the same branch. |
| `packages/nepdate/src/format.ts#742` | `EqualityOperator` -> `j <= pattern.length` at line 107 | The literal run stops at the end, where slice clamps and the extra increment only ends the loop. |
| `packages/nepdate/src/format.ts#771` | `ConditionalExpression` -> `false` at line 121 | A cache miss recomputes the same tokens, so only speed changes. |
| `packages/nepdate/src/format.ts#779` | `ConditionalExpression` -> `true` at line 126 | The size check runs only after an insert, so the oldest key exists; deleting undefined is a no-op. |
| `packages/nepdate/src/tables.ts#1620` | `ConditionalExpression` -> `true` at line 31 | Every extra pass reads NaN and writes past the typed array end, which is ignored; the real pass fills every month. |
| `packages/nepdate/src/tables.ts#1623` | `ConditionalExpression` -> `true` at line 31 | The inner month guard stops the extra passes, and a write past the typed array is ignored. |
| `packages/nepdate/src/tables.ts#1624` | `EqualityOperator` -> `month <= MONTHS` at line 31 | The extra write at index MONTHS is past the typed array and ignored, and the loop then ends. |
| `packages/nepdate/src/tables.ts#1636` | `ConditionalExpression` -> `true` at line 39 | The inner month guard stops the extra passes, and a write past the typed array is ignored. |
| `packages/nepdate/src/tables.ts#1637` | `EqualityOperator` -> `month <= MONTHS` at line 39 | The extra write at index MONTHS is past the typed array and ignored, and the loop then ends. |
| `packages/nepdate/src/tables.ts#1646` | `ConditionalExpression` -> `true` at line 41 | The inner month guard stops the extra passes, and a write past the typed array is ignored. |
| `packages/nepdate/src/tables.ts#1647` | `EqualityOperator` -> `month <= MONTHS` at line 41 | The extra write at index MONTHS is past the typed array and ignored, and the loop then ends. |
| `packages/nepdate-patro/src/build.ts#76` | `ConditionalExpression` -> `true` at line 90 | A write past the Uint8Array end is ignored, and out is not read after the loop. |
| `packages/nepdate-patro/src/build.ts#78` | `EqualityOperator` -> `out <= bytes.length` at line 90 | A write at or past the Uint8Array end is ignored, and out is not read after the loop. |
| `packages/nepdate-patro/src/build.ts#110` | `ArrayDeclaration` -> `new Array()` at line 134 | A plain array is filled at every index below count before it is frozen, so it has the same items and length. |
| `packages/nepdate-patro/src/build.ts#116` | `ArrayDeclaration` -> `new Array()` at line 139 | A plain array is filled at every offset before it is frozen, so it has the same items and length. |
