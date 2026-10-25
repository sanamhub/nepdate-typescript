// Type-level tests, checked by `tsc -p packages/nepdate/tsconfig.json` (the core types gate).

import { expectTypeOf } from "vitest";
import { type GregorianDate, NepaliDate } from "../src/index.js";

const date = NepaliDate.of(2081, 4, 15);

expectTypeOf(NepaliDate.of).returns.toEqualTypeOf<NepaliDate>();
expectTypeOf(NepaliDate.fromGregorian).returns.toEqualTypeOf<NepaliDate>();
expectTypeOf(date.toGregorian()).toEqualTypeOf<GregorianDate>();
expectTypeOf(NepaliDate.compare).returns.toEqualTypeOf<-1 | 0 | 1>();

// @ts-expect-error year is readonly
date.year = 2082;

// @ts-expect-error the constructor is private
new NepaliDate();

// Anything with year, month and day is accepted, as a Temporal.PlainDate would be; extra fields
// are fine (excess property checks do not apply to a variable).
const withExtraField = { year: 2024, month: 7, day: 30, dayOfWeek: 2 };
NepaliDate.fromGregorian(withExtraField);
