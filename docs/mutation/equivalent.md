# Equivalent mutants

Every row is a survivor that no test can kill. The mutant id is the Stryker report key, the diff
is the mutator and its replacement, and the proof says why no input can observe the change.

| Mutant | Diff | Proof |
|---|---|---|
| `packages/nepdate-patro/src/build.ts#44` | `MethodExpression` -> `text` at line 77 | No generated table ends with a single =; the single-padding branch is unreachable for the fixed tables, so both mutants change nothing. |
| `packages/nepdate-patro/src/build.ts#45` | `UnaryOperator` -> `+1` at line 77 | No generated table ends with a single =; the single-padding branch is unreachable for the fixed tables, so both mutants change nothing. |
| `packages/nepdate/src/date.ts#24` | `ConditionalExpression` -> `true` at line 48 | The fast path only returns early; the loop below throws the same error for every non-safe integer, so skipping the return changes no result. |
| `packages/nepdate/src/date.ts#59` | `EqualityOperator` -> `date.day < length` at line 94 | At day == length both branches take the same value, so < and <= are identical for every date. |
| `packages/nepdate/src/date.ts#204` | `ConditionalExpression` -> `false` at line 208 | Removing the upper year bound leaves the serial check, which rejects the same dates with the same error. |
| `packages/nepdate/src/date.ts#205` | `LogicalOperator` -> `year < MIN_AD_YEAR && year > MAX_AD_YEAR` at line 208 | The and form is false for every year, and the serial check still rejects every out-of-range year with the same error. |
| `packages/nepdate/src/date.ts#206` | `ConditionalExpression` -> `false` at line 208 | Removing the upper year bound leaves the serial check, which rejects the same dates with the same error. |
| `packages/nepdate/src/date.ts#209` | `ConditionalExpression` -> `false` at line 208 | Removing the upper year bound leaves the serial check, which rejects the same dates with the same error. |
| `packages/nepdate/src/date.ts#253` | `ConditionalExpression` -> `true` at line 261 | Only the day part is left after the year and month branches; replacing the day test with true changes no assignment. |
| `packages/nepdate/src/date.ts#323` | `StringLiteral` -> `""` at line 374 | shiftMonths treats every overflow other than "spill" as clamp, so "" and "clamp" take the same branch. |
| `packages/nepdate/src/date.ts#327` | `StringLiteral` -> `""` at line 383 | shiftMonths treats every overflow other than "spill" as clamp, so "" and "clamp" take the same branch. |
| `packages/nepdate/src/date.ts#357` | `StringLiteral` -> `""` at line 417 | English is the fallback for every value other than "ne", so "" formats identically to "en" here. |
| `packages/nepdate/src/date.ts#362` | `StringLiteral` -> `""` at line 422 | English is the fallback for every value other than "ne", so "" formats identically to "en" here. |
| `packages/nepdate/src/date.ts#375` | `StringLiteral` -> `""` at line 442 | English is the fallback for every value other than "ne", so "" formats identically to "en" here. |
| `packages/nepdate/src/date.ts#388` | `StringLiteral` -> `""` at line 464 | English is the fallback for every value other than "ne", so "" formats identically to "en" here. |
| `packages/nepdate/src/date.ts#389` | `StringLiteral` -> `""` at line 469 | English is the fallback for every value other than "ne", so "" formats identically to "en" here. |
| `packages/nepdate/src/fiscal.ts#455` | `ConditionalExpression` -> `false` at line 17 | NepaliDate.of repeats the same year range check with the same message, so removing the guard only moves the throw. |
| `packages/nepdate/src/fiscal.ts#513` | `StringLiteral` -> `""` at line 92 | label branches only on "ne"; every other value uses the English branch, so "" and "en" are identical. |
| `packages/nepdate/src/format.ts#532` | `ArrayDeclaration` -> `new Array()` at line 38 | The array is filled at indices 0..2 before it is read; the initial length is not observed. |
| `packages/nepdate/src/format.ts#558` | `ArrayDeclaration` -> `["Stryker was here"]` at line 78 | The injected string has no kind; formatDate only treats kind === "lit" specially, so a string token is ignored before join. |
| `packages/nepdate/src/format.ts#567` | `ConditionalExpression` -> `true` at line 84 | Only a trailing backslash reaches this branch; pattern[i+1] is undefined, its token text is undefined, and join writes nothing, the same as skipping the push. |
| `packages/nepdate/src/format.ts#569` | `EqualityOperator` -> `i + 1 <= pattern.length` at line 84 | Only a trailing backslash reaches this branch; pattern[i+1] is undefined, its token text is undefined, and join writes nothing, the same as skipping the push. |
| `packages/nepdate/src/format.ts#571` | `ArithmeticOperator` -> `i - 1` at line 84 | i - 1 < length is true for every index, so this is the same as the true condition above: the trailing-backslash text is undefined and join writes nothing. |
| `packages/nepdate/src/format.ts#614` | `EqualityOperator` -> `j <= pattern.length` at line 94 | At j == pattern.length the char code is NaN and no comparison matches, so <= and < end the loop at the same index. |
| `packages/nepdate/src/format.ts#625` | `StringLiteral` -> `""` at line 96 | The token kind is only compared with "lit"; the field token still carries its id, so every other kind string formats identically. |
| `packages/nepdate/src/format.ts#638` | `StringLiteral` -> `""` at line 99 | The token kind is only compared with "lit"; the field token still carries its id, so every other kind string formats identically. |
| `packages/nepdate/src/format.ts#655` | `StringLiteral` -> `""` at line 102 | The token kind is only compared with "lit"; the field token still carries its id, so every other kind string formats identically. |
| `packages/nepdate/src/format.ts#663` | `EqualityOperator` -> `j <= pattern.length` at line 106 | At j == pattern.length the char code is NaN and no comparison matches, so <= and < end the loop at the same index. |
| `packages/nepdate/src/format.ts#692` | `ConditionalExpression` -> `false` at line 120 | A cache miss recompiles the same pattern and stores it; the output and the bounded cache are unchanged. |
| `packages/nepdate/src/format.ts#700` | `ConditionalExpression` -> `true` at line 125 | When the cache has no oldest key, delete(undefined) is a no-op; a full cache still evicts one entry. |
| `packages/nepdate/src/names.ts#875` | `StringLiteral` -> `""` at line 80 | monthName branches only on lang === "ne"; every other value uses the English table, so "" and "en" are identical. |
| `packages/nepdate/src/names.ts#877` | `StringLiteral` -> `""` at line 90 | monthShortName branches only on lang === "ne"; every other value uses the English table, so "" and "en" are identical. |
| `packages/nepdate/src/names.ts#883` | `StringLiteral` -> `""` at line 99 | weekdayName branches only on lang === "ne"; every other value uses the English table, so "" and "en" are identical. |
| `packages/nepdate/src/names.ts#885` | `StringLiteral` -> `""` at line 108 | weekdayShortName branches only on lang === "ne"; every other value uses the English table, so "" and "en" are identical. |
| `packages/nepdate/src/parse.ts#961` | `EqualityOperator` -> `c <= 128` at line 32 | STRICT_SEPARATOR has 128 entries; index 128 is undefined, so c <= 128 and c < 128 both reject code 128. |
| `packages/nepdate/src/parse.ts#1009` | `EqualityOperator` -> `code < 0x5a` at line 72 | The only folded letters that matter are A-Z and the Kelvin sign; Z does not occur in any month name or era spelling, so the missing fold changes no accepted input. |
| `packages/nepdate/src/parse.ts#1068` | `StringLiteral` -> `"Stryker was here!"` at line 106 | The comparison is only true for the empty string, and the empty piece returns at the line above; for every non-empty piece both strings are unequal. |
| `packages/nepdate/src/parse.ts#1119` | `ObjectLiteral` -> `{}` at line 129 | lenientParts treats every token that is neither month nor num as a word, so an object without kind and a "word" object are the same. |
| `packages/nepdate/src/parse.ts#1120` | `StringLiteral` -> `""` at line 129 | lenientParts treats every token that is neither month nor num as a word, so an object without kind and a "word" object are the same. |
| `packages/nepdate/src/parse.ts#1127` | `ConditionalExpression` -> `false` at line 137 | An empty chunk has no characters, so its flush classifies nothing; the early return and the empty pass produce the same tokens. |
| `packages/nepdate/src/parse.ts#1129` | `StringLiteral` -> `"Stryker was here!"` at line 137 | The comparison is only true for an empty chunk, which the line above already returns on; for every non-empty chunk it is false. |
