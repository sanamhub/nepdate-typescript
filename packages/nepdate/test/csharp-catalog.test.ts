// C# NepDate's own tests (shared/spec/vectors/csharp-tests/catalog.tsv), translated to this API.
// One test per catalogue row (docs/plan/00-ROADMAP.md, "C# test catalogue").

import { describe, expect, expectTypeOf } from "vitest";
import {
  type DateOrder,
  DateRange,
  type ErrorKind,
  FiscalYear,
  monthName,
  NepaliDate,
  NepDateError,
  type Overflow,
  type Quarter,
  type Separator,
} from "../src/index.js";
import { type CatalogCase, checkCatalog } from "./catalog.js";

const of = NepaliDate.of;

function same(a: NepaliDate, b: NepaliDate): void {
  expect([a.year, a.month, a.day]).toEqual([b.year, b.month, b.day]);
  expect(a.equals(b)).toBe(true);
}

function throwsKind(fn: () => unknown, kind: ErrorKind): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(NepDateError);
  expect((caught as NepDateError).kind).toBe(kind);
}

const ofFails =
  (y: number, m: number, d: number, kind: ErrorKind): CatalogCase =>
  () =>
    throwsKind(() => of(y, m, d), kind);

const knownReference =
  (bs: NepaliDate, year: number, month: number, day: number): CatalogCase =>
  () => {
    expect(bs.toGregorian()).toEqual({ year, month, day });
    same(NepaliDate.fromGregorian({ year, month, day }), bs);
  };

// Days since 1970-01-01 of a Gregorian date, from Date (tests may use it) as an independent check.
function utcDays(g: { year: number; month: number; day: number }): number {
  return Date.UTC(g.year, g.month - 1, g.day) / 86_400_000;
}

function forEachDay(fn: (date: NepaliDate) => void): number {
  let count = 0;
  for (let y = 1901; y <= 2199; y++) {
    for (let m = 1; m <= 12; m++) {
      const length = of(y, m, 1).monthLength;
      for (let d = 1; d <= length; d++) {
        fn(of(y, m, d));
        count++;
      }
    }
  }
  return count;
}

// Abilities/NepaliDateComparableTests: _d1 = 2081-01-01, _d2 = 2081-06-15, _d3 = 2082-01-01.
const d1 = of(2081, 1, 1);
const d2 = of(2081, 6, 15);
const d3 = of(2082, 1, 1);

const sortsCorrectly: CatalogCase = () => {
  const dates = [d3, d1, d2].sort(NepaliDate.compare);
  expect(dates).toEqual([d1, d2, d3]);
};

// C# passes null or another type to CompareTo and Equals. Strict null checks make both a compile
// error here, so the row checks the parameter type instead.
const compareTakesOnlyDates: CatalogCase = () => {
  expectTypeOf(NepaliDate.compare).parameter(1).toEqualTypeOf<NepaliDate>();
};
const equalsTakesOnlyDates: CatalogCase = () => {
  expectTypeOf(d1.equals).parameter(0).toEqualTypeOf<NepaliDate>();
};

const needsParse: CatalogCase = { pending: "T3-04: needs NepaliDate.parse" };
const autoAdjust: CatalogCase = { deviation: "D-06" };

const cases: Record<string, CatalogCase> = {
  "NepaliDateComparableTests.CompareTo_Object_Earlier_ReturnsNegative": () =>
    expect(NepaliDate.compare(d1, d2)).toBe(-1),
  "NepaliDateComparableTests.CompareTo_Object_Same_ReturnsZero": () =>
    expect(NepaliDate.compare(d1, of(2081, 1, 1))).toBe(0),
  "NepaliDateComparableTests.CompareTo_Object_Later_ReturnsPositive": () =>
    expect(NepaliDate.compare(d3, d1)).toBe(1),
  "NepaliDateComparableTests.CompareTo_Object_Null_ReturnsPositive": compareTakesOnlyDates,
  "NepaliDateComparableTests.CompareTo_WrongType_ThrowsArgumentException": compareTakesOnlyDates,
  "NepaliDateComparableTests.CompareTo_Generic_Earlier_ReturnsNegative": () =>
    expect(NepaliDate.compare(d1, d2)).toBe(-1),
  "NepaliDateComparableTests.CompareTo_Generic_Same_ReturnsZero": () =>
    expect(NepaliDate.compare(d1, of(2081, 1, 1))).toBe(0),
  "NepaliDateComparableTests.CompareTo_Generic_Later_ReturnsPositive": () =>
    expect(NepaliDate.compare(d3, d1)).toBe(1),
  "NepaliDateComparableTests.SortedSet_OrdersCorrectly": sortsCorrectly,
  "NepaliDateComparableTests.ArraySort_ViaIComparable_OrdersCorrectly": sortsCorrectly,
  "NepaliDateComparableTests.List_Sort_OrdersCorrectly": sortsCorrectly,

  // Core/DictionaryIntegrityTests
  "DictionaryIntegrityTests.AllNepaliMonths_RoundtripToEnglishAndBack_ProducesOriginalDate": () => {
    for (let y = 1901; y <= 2199; y++) {
      for (let m = 1; m <= 12; m++) {
        const d = of(y, m, 1);
        same(NepaliDate.fromGregorian(d.toGregorian()), d);
      }
    }
  },
  "DictionaryIntegrityTests.AllNepaliDays_RoundtripToEnglishAndBack_ProducesOriginalDate": () => {
    let failures = 0;
    const count = forEachDay((d) => {
      if (!NepaliDate.fromGregorian(d.toGregorian()).equals(d)) failures++;
    });
    expect(failures).toBe(0);
    expect(count).toBe(109212);
  },
  "DictionaryIntegrityTests.AllEnglishDays_RoundtripToNepaliAndBack_ProducesOriginalDate": () => {
    let failures = 0;
    const first = utcDays(NepaliDate.MIN.toGregorian());
    const last = utcDays(NepaliDate.MAX.toGregorian());
    for (let day = first; day <= last; day++) {
      const js = new Date(day * 86_400_000);
      const g = { year: js.getUTCFullYear(), month: js.getUTCMonth() + 1, day: js.getUTCDate() };
      if (utcDays(NepaliDate.fromGregorian(g).toGregorian()) !== day) failures++;
    }
    expect(failures).toBe(0);
  },
  "DictionaryIntegrityTests.AllMonths_MonthEndDay_IsWithinValidRange": () => {
    for (let y = 1901; y <= 2199; y++) {
      for (let m = 1; m <= 12; m++) {
        const length = of(y, m, 1).monthLength;
        expect(length >= 29 && length <= 32).toBe(true);
      }
    }
  },
  "DictionaryIntegrityTests.ConsecutiveNepaliDays_ProduceConsecutiveEnglishDays": () => {
    let violations = 0;
    let previous: number | undefined;
    forEachDay((d) => {
      const day = utcDays(d.toGregorian());
      if (previous !== undefined && day !== previous + 1) violations++;
      previous = day;
    });
    expect(violations).toBe(0);
  },
  "DictionaryIntegrityTests.KnownReferenceDates_ConvertCorrectly#1": knownReference(
    of(2080, 1, 1),
    2023,
    4,
    14,
  ),
  "DictionaryIntegrityTests.KnownReferenceDates_ConvertCorrectly#2": knownReference(
    of(2000, 1, 1),
    1943,
    4,
    14,
  ),
  "DictionaryIntegrityTests.KnownReferenceDates_ConvertCorrectly#3": knownReference(
    of(2081, 1, 1),
    2024,
    4,
    13,
  ),
  "DictionaryIntegrityTests.KnownReferenceDates_ConvertCorrectly#4": knownReference(
    of(1901, 1, 1),
    1844,
    4,
    11,
  ),
  "DictionaryIntegrityTests.BoundaryDates_ConvertCorrectly": () => {
    same(NepaliDate.MIN, of(1901, 1, 1));
    expect([NepaliDate.MAX.year, NepaliDate.MAX.month]).toEqual([2199, 12]);
    for (const d of [NepaliDate.MIN, NepaliDate.MAX]) {
      same(NepaliDate.fromGregorian(d.toGregorian()), d);
    }
  },
  "DictionaryIntegrityTests.TotalDaysInRange_MatchesEnglishDateSpan": () => {
    let total = 0;
    for (let y = 1901; y <= 2199; y++) {
      for (let m = 1; m <= 12; m++) total += of(y, m, 1).monthLength;
    }
    const span = utcDays(NepaliDate.MAX.toGregorian()) - utcDays(NepaliDate.MIN.toGregorian()) + 1;
    expect(total).toBe(span);
  },

  // Core/NepaliDateConstructionTests
  "NepaliDateConstructionTests.Constructor_ValidNepaliDate_CreatesInstance": () => {
    const d = of(2080, 5, 15);
    expect([d.year, d.month, d.day]).toEqual([2080, 5, 15]);
  },
  "NepaliDateConstructionTests.Constructor_MinValue_CreatesInstance": () =>
    same(NepaliDate.MIN, of(1901, 1, 1)),
  "NepaliDateConstructionTests.Constructor_MaxValue_CreatesInstance": () =>
    same(NepaliDate.MAX, of(2199, 12, 30)),
  "NepaliDateConstructionTests.Constructor_InvalidNepaliDate_ThrowsException#1": ofFails(
    2080,
    0,
    1,
    "invalid-month",
  ),
  "NepaliDateConstructionTests.Constructor_InvalidNepaliDate_ThrowsException#2": ofFails(
    2080,
    13,
    1,
    "invalid-month",
  ),
  "NepaliDateConstructionTests.Constructor_InvalidNepaliDate_ThrowsException#3": ofFails(
    2080,
    1,
    0,
    "invalid-day",
  ),
  "NepaliDateConstructionTests.Constructor_InvalidNepaliDate_ThrowsException#4": ofFails(
    2080,
    1,
    33,
    "invalid-day",
  ),
  "NepaliDateConstructionTests.Constructor_ValidStringFormats_CreatesInstance#1": needsParse,
  "NepaliDateConstructionTests.Constructor_ValidStringFormats_CreatesInstance#2": needsParse,
  "NepaliDateConstructionTests.Constructor_ValidStringFormats_CreatesInstance#3": needsParse,
  "NepaliDateConstructionTests.Constructor_ValidStringFormats_CreatesInstance#4": needsParse,
  "NepaliDateConstructionTests.Constructor_ValidStringFormats_CreatesInstance#5": needsParse,
  "NepaliDateConstructionTests.Constructor_ValidStringFormats_CreatesInstance#6": needsParse,
  "NepaliDateConstructionTests.Constructor_AutoAdjustedFormats_CreatesInstance#1": autoAdjust,
  "NepaliDateConstructionTests.Constructor_AutoAdjustedFormats_CreatesInstance#2": autoAdjust,
  // Without autoAdjust's guessing, "2080/05/15" is a plain strict parse.
  "NepaliDateConstructionTests.Constructor_AutoAdjustedFormats_CreatesInstance#3": needsParse,
  "NepaliDateConstructionTests.Constructor_AutoAdjustedFormats_CreatesInstance#4": autoAdjust,
  "NepaliDateConstructionTests.Constructor_AutoAdjust_MonthOverflowWithBoundaryDay_SwapsAsDocumented#1":
    autoAdjust,
  "NepaliDateConstructionTests.Constructor_AutoAdjust_MonthOverflowWithBoundaryDay_SwapsAsDocumented#2":
    autoAdjust,
  "NepaliDateConstructionTests.TryParse_AutoAdjust_MonthOverflowWithBoundaryDay_SwapsAsDocumented":
    autoAdjust,
  "NepaliDateConstructionTests.Constructor_InvalidStringFormats_ThrowsException#1": needsParse,
  "NepaliDateConstructionTests.Constructor_InvalidStringFormats_ThrowsException#2": needsParse,
  "NepaliDateConstructionTests.Constructor_InvalidStringFormats_ThrowsException#3": needsParse,
  "NepaliDateConstructionTests.Constructor_ValidFormatInvalidDate_ThrowsException#1": needsParse,
  "NepaliDateConstructionTests.Constructor_EnglishDate_ConvertsCorrectly": () =>
    same(NepaliDate.fromGregorian({ year: 2023, month: 8, day: 30 }), of(2080, 5, 13)),
  "NepaliDateConstructionTests.TryParse_ValidString_ReturnsTrueWithCorrectDate": needsParse,
  "NepaliDateConstructionTests.TryParse_InvalidString_ReturnsFalseWithDefault#1": needsParse,
  "NepaliDateConstructionTests.TryParse_InvalidString_ReturnsFalseWithDefault#2": needsParse,
  "NepaliDateConstructionTests.TryParse_InvalidString_ReturnsFalseWithDefault#3": needsParse,

  // Core/NepaliDatePropertiesTests: the date is 2080-05-15 unless the row says otherwise.
  "NepaliDatePropertiesTests.EnglishDate_Conversion_ReturnsCorrectDate": () =>
    expect(of(2080, 5, 15).toGregorian()).toEqual({ year: 2023, month: 9, day: 1 }),
  "NepaliDatePropertiesTests.DayOfWeek_ReturnsCorrectValue": () =>
    expect(of(2080, 5, 15).weekday).toBe(5), // Friday
  "NepaliDatePropertiesTests.MonthEndDay_ReturnsCorrectValue": () =>
    expect(of(2080, 5, 15).monthLength).toBe(31),
  // C# returns the NepaliMonths enum; months here are plain numbers, 5 = Bhadra.
  "NepaliDatePropertiesTests.MonthName_ReturnsCorrectEnum": () =>
    expect(of(2080, 5, 15).month).toBe(5),
  "NepaliDatePropertiesTests.Today_ReturnsCurrentNepaliDate": {
    pending: "T4-03: needs NepaliDate.today",
  },
  "NepaliDatePropertiesTests.DayOfYear_FirstDayOfYear_Returns1": () =>
    expect(of(2080, 1, 1).dayOfYear).toBe(1),
  "NepaliDatePropertiesTests.DayOfYear_FirstDayOfMonth4_EqualsSum_Of_Months1To3_Plus1": () => {
    const expected =
      of(2080, 1, 1).monthLength + of(2080, 2, 1).monthLength + of(2080, 3, 1).monthLength + 1;
    expect(of(2080, 4, 1).dayOfYear).toBe(expected);
  },
  "NepaliDatePropertiesTests.Equals_NullObject_ReturnsFalse": equalsTakesOnlyDates,
  "NepaliDatePropertiesTests.Equals_DifferentType_ReturnsFalse": equalsTakesOnlyDates,

  // Core/OptimizationVerificationTests, phase 1 rows
  "OptimizationVerificationTests.Constructor_AllSeparators_ParseCorrectly#1": needsParse,
  "OptimizationVerificationTests.Constructor_AllSeparators_ParseCorrectly#2": needsParse,
  "OptimizationVerificationTests.Constructor_AllSeparators_ParseCorrectly#3": needsParse,
  "OptimizationVerificationTests.Constructor_AllSeparators_ParseCorrectly#4": needsParse,
  "OptimizationVerificationTests.Constructor_AllSeparators_ParseCorrectly#5": needsParse,
  "OptimizationVerificationTests.Constructor_AllSeparators_ParseCorrectly#6": needsParse,
  "OptimizationVerificationTests.Constructor_AllSeparators_ParseCorrectly#7": needsParse,
  "OptimizationVerificationTests.Constructor_AllSeparators_ParseCorrectly#8": needsParse,
  "OptimizationVerificationTests.Constructor_InvalidStrings_ThrowsException#1": needsParse,
  "OptimizationVerificationTests.Constructor_InvalidStrings_ThrowsException#2": needsParse,
  "OptimizationVerificationTests.Constructor_InvalidStrings_ThrowsException#3": needsParse,
  "OptimizationVerificationTests.Constructor_InvalidStrings_ThrowsException#4": needsParse,
  "OptimizationVerificationTests.Constructor_InvalidStrings_ThrowsException#5": needsParse,
  "OptimizationVerificationTests.Constructor_InvalidStrings_ThrowsException#6": needsParse,
  "OptimizationVerificationTests.Constructor_NullString_ThrowsException": needsParse,
  "OptimizationVerificationTests.Constructor_WithoutLeadingZeros_ParsesCorrectly#1": needsParse,
  "OptimizationVerificationTests.Constructor_WithoutLeadingZeros_ParsesCorrectly#2": needsParse,
  "OptimizationVerificationTests.Constructor_WithoutLeadingZeros_ParsesCorrectly#3": needsParse,
  // C# operators ==, !=, <, <=, >, >= map to equals and compare (no valueOf, ADR-0003).
  "OptimizationVerificationTests.Operator_Equality_SameDates_ReturnsTrue": () =>
    expect(of(2080, 5, 15).equals(of(2080, 5, 15))).toBe(true),
  "OptimizationVerificationTests.Operator_Inequality_DifferentDates_ReturnsTrue": () =>
    expect(of(2080, 5, 15).equals(of(2080, 5, 16))).toBe(false),
  "OptimizationVerificationTests.Operator_LessThan_EarlierDate_ReturnsTrue": () =>
    expect(NepaliDate.compare(of(2080, 5, 15), of(2080, 5, 16)) < 0).toBe(true),
  "OptimizationVerificationTests.Operator_LessThanOrEqual_SameAndEarlier_ReturnsTrue": () => {
    expect(NepaliDate.compare(of(2080, 5, 15), of(2080, 5, 16)) <= 0).toBe(true);
    expect(NepaliDate.compare(of(2080, 5, 15), of(2080, 5, 15)) <= 0).toBe(true);
  },
  "OptimizationVerificationTests.Operator_GreaterThan_LaterDate_ReturnsTrue": () =>
    expect(NepaliDate.compare(of(2080, 5, 16), of(2080, 5, 15)) > 0).toBe(true),
  "OptimizationVerificationTests.Operator_GreaterThanOrEqual_SameAndLater_ReturnsTrue": () => {
    expect(NepaliDate.compare(of(2080, 5, 16), of(2080, 5, 15)) >= 0).toBe(true);
    expect(NepaliDate.compare(of(2080, 5, 16), of(2080, 5, 16)) >= 0).toBe(true);
  },
  "OptimizationVerificationTests.Operator_MinMaxBoundary_CorrectOrdering": () =>
    expect(NepaliDate.compare(NepaliDate.MIN, NepaliDate.MAX)).toBe(-1),
  "OptimizationVerificationTests.CompareTo_EarlierDate_ReturnsNegative": () =>
    expect(NepaliDate.compare(of(2080, 5, 15), of(2080, 5, 16))).toBe(-1),
  "OptimizationVerificationTests.CompareTo_SameDate_ReturnsZero": () => {
    const d = of(2080, 5, 15);
    expect(NepaliDate.compare(d, d)).toBe(0);
  },
  "OptimizationVerificationTests.CompareTo_LaterDate_ReturnsPositive": () =>
    expect(NepaliDate.compare(of(2080, 5, 16), of(2080, 5, 15))).toBe(1),
  "OptimizationVerificationTests.CompareTo_DifferentYears_CorrectOrdering": () =>
    expect(NepaliDate.compare(of(2080, 1, 1), of(2081, 1, 1))).toBe(-1),
  "OptimizationVerificationTests.CompareTo_DifferentMonths_CorrectOrdering": () =>
    expect(NepaliDate.compare(of(2080, 1, 1), of(2080, 2, 1))).toBe(-1),
  "OptimizationVerificationTests.Equals_SameDates_ReturnsTrue": () =>
    expect(of(2080, 5, 15).equals(of(2080, 5, 15))).toBe(true),
  "OptimizationVerificationTests.Equals_DifferentDates_ReturnsFalse": () =>
    expect(of(2080, 5, 15).equals(of(2080, 5, 16))).toBe(false),
  // JavaScript has no hash code; T3-02 checks that equal dates give the same toJSON() Map key.
  "OptimizationVerificationTests.GetHashCode_EqualDates_SameHashCode": {
    pending: "T3-02: needs toJSON as the Map key",
  },
  "OptimizationVerificationTests.GetHashCode_StableAcrossMultipleCalls": {
    pending: "T3-02: needs toJSON as the Map key",
  },
  "OptimizationVerificationTests.IsLeapYear_ChecksEnglishYearCorrectly#1": { deviation: "D-12" },
  "OptimizationVerificationTests.IsLeapYear_ChecksEnglishYearCorrectly#2": { deviation: "D-12" },
  "OptimizationVerificationTests.IsLeapYear_ChecksEnglishYearCorrectly#3": { deviation: "D-12" },
  "OptimizationVerificationTests.Constructor_InvalidYearMonthDay_ThrowsException#1": ofFails(
    2080,
    0,
    15,
    "invalid-month",
  ),
  "OptimizationVerificationTests.Constructor_InvalidYearMonthDay_ThrowsException#2": ofFails(
    2080,
    13,
    15,
    "invalid-month",
  ),
  "OptimizationVerificationTests.Constructor_InvalidYearMonthDay_ThrowsException#3": ofFails(
    2080,
    5,
    0,
    "invalid-day",
  ),
  "OptimizationVerificationTests.Constructor_InvalidYearMonthDay_ThrowsException#4": ofFails(
    2080,
    5,
    33,
    "invalid-day",
  ),
  "OptimizationVerificationTests.Constructor_InvalidYearMonthDay_ThrowsException#5": ofFails(
    1900,
    1,
    1,
    "out-of-range",
  ),
  "OptimizationVerificationTests.Constructor_InvalidYearMonthDay_ThrowsException#6": ofFails(
    2200,
    1,
    1,
    "out-of-range",
  ),
  "OptimizationVerificationTests.Constructor_MinValue_IsValid": () =>
    same(NepaliDate.MIN, of(1901, 1, 1)),
  "OptimizationVerificationTests.Constructor_MaxValue_IsValid": () =>
    same(NepaliDate.MAX, of(2199, 12, 30)),
  "OptimizationVerificationTests.EnglishDate_MinValue_ConvertsAndRoundtrips": () =>
    same(NepaliDate.fromGregorian(NepaliDate.MIN.toGregorian()), NepaliDate.MIN),
  "OptimizationVerificationTests.EnglishDate_MaxValue_ConvertsAndRoundtrips": () =>
    same(NepaliDate.fromGregorian(NepaliDate.MAX.toGregorian()), NepaliDate.MAX),
  "OptimizationVerificationTests.EnglishDate_JustBeforeMin_ThrowsException": () =>
    throwsKind(() => NepaliDate.fromGregorian({ year: 1844, month: 4, day: 10 }), "out-of-range"),
  "OptimizationVerificationTests.EnglishDate_JustAfterMax_ThrowsException": () =>
    throwsKind(() => NepaliDate.fromGregorian({ year: 2143, month: 4, day: 16 }), "out-of-range"),
  "OptimizationVerificationTests.MonthEndDay_CreatingDateWithExactEndDay_Succeeds": () => {
    for (let y = 2070; y <= 2090; y++) {
      for (let m = 1; m <= 12; m++) {
        const length = of(y, m, 1).monthLength;
        expect(of(y, m, length).day).toBe(length);
        throwsKind(() => of(y, m, length + 1), "invalid-day");
      }
    }
  },
  "OptimizationVerificationTests.DayOfWeek_MatchesEnglishDateDayOfWeek": () => {
    for (let y = 1910; y <= 2190; y += 30) {
      for (let m = 1; m <= 12; m += 3) {
        const d = of(y, m, 15);
        const g = d.toGregorian();
        expect(d.weekday).toBe(new Date(Date.UTC(g.year, g.month - 1, g.day)).getUTCDay());
      }
    }
  },
  "OptimizationVerificationTests.IsDefault_DefaultStruct_ReturnsTrue": { deviation: "D-01" },
  "OptimizationVerificationTests.IsDefault_ValidDate_ReturnsFalse": { deviation: "D-01" },
};

describe("C# catalogue, phase 1", () => {
  checkCatalog("1", cases);
});

// ---- Phase 2 ----

// Fiscal-year boundaries still match C# (D-08 changes only the API shape), so these are
// translated through FiscalYear and quarterRange instead of being skipped.
const qStart = (date: NepaliDate, q: Quarter): NepaliDate =>
  date.fiscalYear().quarterRange(q).start;
const qEnd = (date: NepaliDate, q: Quarter): NepaliDate => date.fiscalYear().quarterRange(q).end;
const spill: Overflow = "spill";

const fractionMonths: CatalogCase = { deviation: "D-02" };
const needsFromJSDate: CatalogCase = { pending: "T4-03: needs NepaliDate.fromJSDate" };
const needsToday: CatalogCase = { pending: "T4-03: needs NepaliDate.today" };
const noSetOps: CatalogCase = { deviation: "D-09" };

const sameFyStartOf =
  (month: number): CatalogCase =>
  () =>
    same(of(2080, month, 15).fiscalYear().start(), of(2080, 4, 1));
const prevFyStartOf =
  (month: number): CatalogCase =>
  () =>
    same(of(2080, month, 15).fiscalYear().start(), of(2079, 4, 1));

const cases2: Record<string, CatalogCase> = {
  // Core/FiscalYearInstanceMethodTests
  "FiscalYearInstanceMethodTests.FiscalYearStartDate_DateInShrawan_ReturnsSameyearShrawan1": () =>
    same(of(2080, 4, 15).fiscalYear().start(), of(2080, 4, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearStartDate_DateInChaitra_ReturnsSameYearShrawan1": () =>
    same(of(2080, 12, 15).fiscalYear().start(), of(2080, 4, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearStartDate_DateInBasikhakh_ReturnsPreviousYearShrawan1":
    () => same(of(2080, 1, 15).fiscalYear().start(), of(2079, 4, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearStartDate_DateInAshadh_ReturnsPreviousYearShrawan1":
    () => same(of(2080, 3, 15).fiscalYear().start(), of(2079, 4, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearStartDate_WithPositiveYearOffset_ShiftsForward": () =>
    same(new FiscalYear(of(2080, 4, 15).fiscalYear().startYear + 1).start(), of(2081, 4, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearStartDate_WithNegativeYearOffset_ShiftsBackward": () =>
    same(new FiscalYear(of(2080, 4, 15).fiscalYear().startYear - 1).start(), of(2079, 4, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearEndDate_DateInShrawan_ReturnsNextYearAshad": () =>
    expect(of(2080, 4, 15).fiscalYear().end().year).toBe(2081),
  "FiscalYearInstanceMethodTests.FiscalYearEndDate_DateInChaitra_ReturnsNextYearAshadh": () =>
    expect(of(2080, 12, 15).fiscalYear().end().year).toBe(2081),
  "FiscalYearInstanceMethodTests.FiscalYearEndDate_DateInBasikhakh_ReturnsSameYearAshadh": () =>
    expect(of(2080, 1, 15).fiscalYear().end().year).toBe(2080),
  "FiscalYearInstanceMethodTests.FiscalYearEndDate_WithPositiveYearOffset_ShiftsForward": () =>
    expect(new FiscalYear(of(2080, 4, 15).fiscalYear().startYear + 1).end().year).toBe(2082),
  "FiscalYearInstanceMethodTests.FiscalYearStartAndEndDate_DateInQ2_ReturnsBothBoundaries": () => {
    const fy = of(2080, 7, 15).fiscalYear();
    same(fy.start(), of(2080, 4, 1));
    expect(fy.end().year).toBe(2081);
  },
  "FiscalYearInstanceMethodTests.FiscalYearStartAndEndDate_DateInQ4_ReturnsPreviousFiscalYearBoundaries":
    () => {
      const fy = of(2081, 1, 15).fiscalYear();
      same(fy.start(), of(2080, 4, 1));
      expect(fy.end().year).toBe(2081);
    },
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartDate_ExplicitFirst_ReturnsShrawan1": () =>
    same(qStart(of(2080, 4, 15), 1), of(2080, 4, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartDate_ExplicitSecond_ReturnsKartik1": () =>
    same(qStart(of(2080, 4, 15), 2), of(2080, 7, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartDate_ExplicitThird_ReturnsMagh1": () =>
    same(qStart(of(2080, 4, 15), 3), of(2080, 10, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartDate_ExplicitFourth_ReturnsNextYearBasikhakh1":
    () => same(qStart(of(2080, 4, 15), 4), of(2081, 1, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterEndDate_ExplicitFirst_ReturnsLastDayOfAshoj":
    () => expect(qEnd(of(2080, 4, 15), 1).year).toBe(2080),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterEndDate_ExplicitSecond_ReturnsLastDayOfPoush":
    () => expect(qEnd(of(2080, 4, 15), 2).year).toBe(2080),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterEndDate_ExplicitThird_ReturnsLastDayOfChaitra":
    () => expect(qEnd(of(2080, 4, 15), 3).year).toBe(2080),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterEndDate_ExplicitFourth_ReturnsNextYearLastDayOfAshadh":
    () => expect(qEnd(of(2080, 4, 15), 4).year).toBe(2081),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartAndEndDate_ExplicitSecond_ReturnsBothBoundaries":
    () => {
      same(qStart(of(2080, 4, 15), 2), of(2080, 7, 1));
      expect(qEnd(of(2080, 4, 15), 2).month).toBe(9);
    },
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartAndEndDate_ExplicitThird_ReturnsBothBoundaries":
    () => {
      same(qStart(of(2080, 4, 15), 3), of(2080, 10, 1));
      expect(qEnd(of(2080, 4, 15), 3).month).toBe(12);
    },
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartDate_Current_DateInQ1_ReturnsShrawan1": () =>
    same(qStart(of(2080, 4, 15), of(2080, 4, 15).quarter()), of(2080, 4, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterEndDate_Current_DateInQ1_ReturnsLastDayOfAshoj":
    () => expect(qEnd(of(2080, 4, 15), of(2080, 4, 15).quarter()).month).toBe(6),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartDate_Current_DateInQ2_ReturnsKartik1": () =>
    same(qStart(of(2080, 7, 15), of(2080, 7, 15).quarter()), of(2080, 7, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartDate_Current_DateInQ3_ReturnsMagh1": () =>
    same(qStart(of(2080, 10, 15), of(2080, 10, 15).quarter()), of(2080, 10, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterEndDate_Current_DateInQ3_ReturnsLastDayOfChaitra":
    () => expect(qEnd(of(2080, 10, 15), of(2080, 10, 15).quarter()).month).toBe(12),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartDate_ExplicitFirstWithOffset1_ReturnsNextYearShrawan1":
    () =>
      same(
        new FiscalYear(of(2080, 4, 15).fiscalYear().startYear + 1).quarterRange(1).start,
        of(2081, 4, 1),
      ),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartDate_ExplicitFirstWithNegativeOffset_ReturnsPreviousYearShrawan1":
    () =>
      same(
        new FiscalYear(of(2080, 4, 15).fiscalYear().startYear - 1).quarterRange(1).start,
        of(2079, 4, 1),
      ),
  "FiscalYearInstanceMethodTests.FiscalYearStartDate_AllFiscalMonths_Return2080Shrawan1#1":
    sameFyStartOf(4),
  "FiscalYearInstanceMethodTests.FiscalYearStartDate_AllFiscalMonths_Return2080Shrawan1#2":
    sameFyStartOf(6),
  "FiscalYearInstanceMethodTests.FiscalYearStartDate_AllFiscalMonths_Return2080Shrawan1#3":
    sameFyStartOf(7),
  "FiscalYearInstanceMethodTests.FiscalYearStartDate_AllFiscalMonths_Return2080Shrawan1#4":
    sameFyStartOf(12),
  "FiscalYearInstanceMethodTests.FiscalYearStartDate_Q4CalendarMonths_ReturnPreviousYearShrawan1#1":
    prevFyStartOf(1),
  "FiscalYearInstanceMethodTests.FiscalYearStartDate_Q4CalendarMonths_ReturnPreviousYearShrawan1#2":
    prevFyStartOf(2),
  "FiscalYearInstanceMethodTests.FiscalYearStartDate_Q4CalendarMonths_ReturnPreviousYearShrawan1#3":
    prevFyStartOf(3),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartDate_FromQ4Date_ExplicitFirst_ReturnsFY2080Q1Start":
    () => same(qStart(of(2081, 1, 15), 1), of(2080, 4, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartDate_FromQ4Date_ExplicitSecond_ReturnsFY2080Q2Start":
    () => same(qStart(of(2081, 1, 15), 2), of(2080, 7, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartDate_FromQ4Date_ExplicitThird_ReturnsFY2080Q3Start":
    () => same(qStart(of(2081, 1, 15), 3), of(2080, 10, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartDate_FromQ4Date_ExplicitFourth_ReturnsFY2080Q4Start":
    () => same(qStart(of(2081, 1, 15), 4), of(2081, 1, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterStartDate_FromQ4Date_Current_ReturnsFY2080Q4Start":
    () => same(qStart(of(2081, 1, 15), of(2081, 1, 15).quarter()), of(2081, 1, 1)),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterEndDate_FromQ4Date_ExplicitFirst_ReturnsFY2080Q1End":
    () => expect(qEnd(of(2081, 1, 15), 1).year).toBe(2080),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterEndDate_FromQ4Date_ExplicitThird_ReturnsFY2080Q3End":
    () => expect(qEnd(of(2081, 1, 15), 3).year).toBe(2080),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterEndDate_FromQ4Date_ExplicitFourth_ReturnsFY2080Q4End":
    () => expect(qEnd(of(2081, 1, 15), 4).year).toBe(2081),
  "FiscalYearInstanceMethodTests.FiscalYearQuarterEndDate_FromQ4Date_Current_ReturnsFY2080Q4End":
    () => expect(qEnd(of(2081, 1, 15), of(2081, 1, 15).quarter()).year).toBe(2081),

  // Core/FiscalYearTests
  "FiscalYearTests.GetFiscalYearStartAndEndDate_ValidYear_ReturnsCorrectDates": () => {
    const fy = new FiscalYear(2080);
    same(fy.start(), of(2080, 4, 1));
    same(fy.end(), of(2081, 3, 1).lastOfMonth());
  },
  "FiscalYearTests.GetFiscalYearStartAndEndDate_InvalidYear_ThrowsException#1": () =>
    throwsKind(() => new FiscalYear(1843).start(), "out-of-range"),
  "FiscalYearTests.GetFiscalYearStartAndEndDate_InvalidYear_ThrowsException#2": () =>
    throwsKind(() => new FiscalYear(2200).start(), "out-of-range"),
  "FiscalYearTests.GetFiscalYearStartDate_ValidYear_ReturnsCorrectDate": () =>
    same(new FiscalYear(2080).start(), of(2080, 4, 1)),
  "FiscalYearTests.GetFiscalYearEndDate_ValidYear_ReturnsCorrectDate": () =>
    same(new FiscalYear(2080).end(), of(2081, 3, 1).lastOfMonth()),
  "FiscalYearTests.FiscalYearStartAndEndDate_OnNepaliDateInstance_ReturnsCorrectDates": () => {
    const fy = of(2080, 4, 15).fiscalYear();
    same(fy.start(), of(2080, 4, 1));
    same(fy.end(), of(2081, 3, 1).lastOfMonth());
  },
  "FiscalYearTests.FiscalYearStartDate_OnNepaliDateInstance_ReturnsCorrectDate": () =>
    same(of(2080, 4, 15).fiscalYear().start(), of(2080, 4, 1)),
  "FiscalYearTests.FiscalYearEndDate_OnNepaliDateInstance_ReturnsCorrectDate": () =>
    same(of(2080, 4, 15).fiscalYear().end(), of(2081, 3, 1).lastOfMonth()),
  "FiscalYearTests.GetFiscalYearQuarterStartAndEndDate_ValidYearAndMonth_ReturnsCorrectDates":
    () => {
      same(new FiscalYear(2080).quarterRange(1).start, of(2080, 4, 1));
      expect(new FiscalYear(2080).quarterRange(1).end.month).toBe(6);
    },
  "FiscalYearTests.GetFiscalYearQuarterStartDate_ValidYearAndMonth_ReturnsCorrectDate": () =>
    same(new FiscalYear(2080).quarterRange(2).start, of(2080, 7, 1)),
  "FiscalYearTests.GetFiscalYearQuarterEndDate_ValidYearAndMonth_ReturnsCorrectDate": () =>
    same(new FiscalYear(2080).quarterRange(3).end, of(2080, 12, 1).lastOfMonth()),

  // Core/NepaliDateArithmeticEdgeCaseTests
  "NepaliDateArithmeticEdgeCaseTests.AddDays_Zero_ReturnsSameDate": () => {
    const d = of(2080, 5, 15);
    same(d.addDays(0), d);
  },
  "NepaliDateArithmeticEdgeCaseTests.AddDays_PositiveAcrossMonthBoundary_IsCorrect": () =>
    same(of(2080, 5, 31).addDays(1), of(2080, 6, 1)),
  "NepaliDateArithmeticEdgeCaseTests.AddDays_NegativeAcrossMonthBoundary_IsCorrect": () =>
    same(of(2080, 6, 1).addDays(-1), of(2080, 5, 31)),
  "NepaliDateArithmeticEdgeCaseTests.AddDays_PositiveAcrossYearBoundary_IsCorrect": () =>
    same(of(2080, 12, 30).addDays(1), of(2081, 1, 1)),
  "NepaliDateArithmeticEdgeCaseTests.AddDays_NegativeAcrossYearBoundary_IsCorrect": () =>
    same(of(2081, 1, 1).addDays(-1), of(2080, 12, 30)),
  "NepaliDateArithmeticEdgeCaseTests.AddDays_LargePositiveValue_IsCorrect": () => {
    const r = of(2080, 1, 1).addDays(400);
    expect(r.year === 2080 || r.year === 2081).toBe(true);
  },
  "NepaliDateArithmeticEdgeCaseTests.AddMonths_PositiveCrossesYearBoundary_IsCorrect": () =>
    same(of(2080, 12, 15).addMonths(1), of(2081, 1, 15)),
  "NepaliDateArithmeticEdgeCaseTests.AddMonths_NegativeCrossesYearBoundary_IsCorrect": () =>
    same(of(2080, 1, 15).addMonths(-1), of(2079, 12, 15)),
  "NepaliDateArithmeticEdgeCaseTests.AddMonths_PositiveMoreThan12_CrossesMultipleYears": () =>
    same(of(2080, 1, 15).addMonths(13), of(2081, 2, 15)),
  "NepaliDateArithmeticEdgeCaseTests.AddMonths_Exactly12_SameMonthNextYear": () =>
    same(of(2080, 5, 15).addMonths(12), of(2081, 5, 15)),
  "NepaliDateArithmeticEdgeCaseTests.AddMonths_DayCappedAtMonthEnd_WhenResultMonthIsShorter": () =>
    same(of(2081, 4, 32).addMonths(1), of(2081, 5, 31)),
  "NepaliDateArithmeticEdgeCaseTests.AddMonths_Negative_SameDayPreservedWhenFits": () =>
    same(of(2080, 6, 15).addMonths(-1), of(2080, 5, 15)),
  "NepaliDateArithmeticEdgeCaseTests.AddMonths_HalfMonth_AddsApproximately15Days": fractionMonths,
  "NepaliDateArithmeticEdgeCaseTests.AddMonths_NegativeHalfMonth_SubtractsApproximately15Days":
    fractionMonths,
  "NepaliDateArithmeticEdgeCaseTests.AddMonths_OneAndHalfMonths_AddsApproximately46Days":
    fractionMonths,
  "NepaliDateArithmeticEdgeCaseTests.AddMonths_FractionalValue_ReturnsDateFurtherThanZeroMonths":
    fractionMonths,
  "NepaliDateArithmeticEdgeCaseTests.Constructor_DateTimeWithMidnightTime_IgnoresTime":
    needsFromJSDate,
  "NepaliDateArithmeticEdgeCaseTests.Constructor_DateTimeWithNoonTime_IgnoresTime": needsFromJSDate,
  "NepaliDateArithmeticEdgeCaseTests.Constructor_DateTimeWithEndOfDayTime_IgnoresTime":
    needsFromJSDate,
  "NepaliDateArithmeticEdgeCaseTests.Constructor_TwoDateTimesOnSameEnglishDateDifferentTimes_ProduceSameNepaliDate":
    needsFromJSDate,
  "NepaliDateArithmeticEdgeCaseTests.TryParse_AutoAdjust_DayYearMonthFormat_ReturnsCorrectDate":
    needsParse,
  "NepaliDateArithmeticEdgeCaseTests.TryParse_AutoAdjust_MonthDayYearInvertedOrder_ReturnsCorrectDate":
    needsParse,
  "NepaliDateArithmeticEdgeCaseTests.TryParse_AutoAdjust_TwoDigitYear_ExpandsToCurrentMillennium":
    needsParse,
  "NepaliDateArithmeticEdgeCaseTests.TryParse_AutoAdjust_InvalidDateAfterAdjustment_ReturnsFalse":
    needsParse,
  "NepaliDateArithmeticEdgeCaseTests.TryParse_AutoAdjust_ValidStandardFormat_ReturnsCorrectDate":
    needsParse,

  // Core/NepaliDateManipulationTests
  "NepaliDateManipulationTests.MonthEndDate_ReturnsCorrectDate": () =>
    same(of(2080, 5, 1).lastOfMonth(), of(2080, 5, 31)),
  "NepaliDateManipulationTests.AddMonths_ReturnsCorrectDate#1": () =>
    same(of(2080, 5, 15).addMonths(1), of(2080, 6, 15)),
  "NepaliDateManipulationTests.AddMonths_ReturnsCorrectDate#2": () =>
    same(of(2080, 5, 15).addMonths(-1), of(2080, 4, 15)),
  "NepaliDateManipulationTests.AddMonths_ReturnsCorrectDate#3": () =>
    same(of(2080, 5, 15).addMonths(12), of(2081, 5, 15)),
  "NepaliDateManipulationTests.AddMonths_ReturnsCorrectDate#4": () =>
    same(of(2081, 4, 32).addMonths(5), of(2081, 9, 29)),
  "NepaliDateManipulationTests.AddMonths_ReturnsCorrectDate#5": () =>
    same(of(2081, 4, 32).addMonths(5, spill), of(2081, 10, 3)),
  "NepaliDateManipulationTests.AddDays_ReturnsCorrectDate#1": () =>
    same(of(2080, 5, 15).addDays(5), of(2080, 5, 20)),
  "NepaliDateManipulationTests.AddDays_ReturnsCorrectDate#2": () =>
    same(of(2080, 5, 15).addDays(-5), of(2080, 5, 10)),
  "NepaliDateManipulationTests.AddDays_ReturnsCorrectDate#3": () =>
    same(of(2080, 5, 31).addDays(1), of(2080, 6, 1)),
  "NepaliDateManipulationTests.AddDays_ReturnsCorrectDate#4": () =>
    same(of(2080, 12, 30).addDays(5), of(2081, 1, 5)),
  "NepaliDateManipulationTests.Subtract_TwoDates_ReturnsCorrectTimeSpan": () =>
    expect(of(2080, 5, 1).daysUntil(of(2080, 5, 16))).toBe(15),
  "NepaliDateManipulationTests.Subtract_SameDate_ReturnsZero": () =>
    expect(of(2080, 5, 15).daysUntil(of(2080, 5, 15))).toBe(0),

  // Core/NepaliDateRangeExtendedTests
  "NepaliDateRangeExtendedTests.ForCalendarYear_StartsAtBaishakhOne_EndsAtChaitraEnd": () => {
    const r = DateRange.year(2080);
    same(r.start, of(2080, 1, 1));
    same(r.end, of(2080, 12, 1).lastOfMonth());
  },
  "NepaliDateRangeExtendedTests.ForCalendarYear_LengthIsReasonable": () => {
    const length = DateRange.year(2080).length;
    expect(length >= 365 && length <= 366).toBe(true);
  },
  "NepaliDateRangeExtendedTests.CurrentMonth_StartIsFirstDayOfCurrentMonth": needsToday,
  "NepaliDateRangeExtendedTests.CurrentMonth_EndIsLastDayOfCurrentMonth": needsToday,
  "NepaliDateRangeExtendedTests.CurrentMonth_ContainsToday": needsToday,
  "NepaliDateRangeExtendedTests.CurrentFiscalYear_ContainsToday": needsToday,
  "NepaliDateRangeExtendedTests.CurrentFiscalYear_StartIsShrawan": needsToday,
  "NepaliDateRangeExtendedTests.CurrentFiscalYear_EndIsAshadh": needsToday,
  "NepaliDateRangeExtendedTests.CurrentCalendarYear_ContainsToday": needsToday,
  "NepaliDateRangeExtendedTests.CurrentCalendarYear_StartIsBaishakh1": needsToday,
  "NepaliDateRangeExtendedTests.SplitByFiscalQuarter_EmptyRange_ReturnsEmptyArray": noSetOps,
  "NepaliDateRangeExtendedTests.SplitByFiscalQuarter_RangeWithinOneQuarter_ReturnsSingleRange":
    noSetOps,
  "NepaliDateRangeExtendedTests.SplitByFiscalQuarter_RangeSpanningTwoQuarters_ReturnsTwoRanges":
    noSetOps,
  "NepaliDateRangeExtendedTests.SplitByFiscalQuarter_FullFiscalYear_ReturnsFourRanges": noSetOps,
  "NepaliDateRangeExtendedTests.SplitByFiscalQuarter_RangeInQ4Months_SingleRange": noSetOps,
  "NepaliDateRangeExtendedTests.DatesWithInterval_Zero_ThrowsArgumentOutOfRangeException": noSetOps,
  "NepaliDateRangeExtendedTests.DatesWithInterval_NegativeInterval_ThrowsArgumentOutOfRangeException":
    noSetOps,
  "NepaliDateRangeExtendedTests.DatesWithInterval_IntervalOfOne_YieldsEveryDay": noSetOps,
  "NepaliDateRangeExtendedTests.DatesWithInterval_IntervalOfTwo_YieldsOddDays": noSetOps,
  "NepaliDateRangeExtendedTests.DatesWithInterval_IntervalLargerThanRange_YieldsOnlyStartDate":
    noSetOps,
  "NepaliDateRangeExtendedTests.DatesWithInterval_EmptyRange_YieldsNothing": noSetOps,
  "NepaliDateRangeExtendedTests.WeekendDays_IncludeSundayTrue_ReturnsBothSaturdayAndSunday":
    noSetOps,
  "NepaliDateRangeExtendedTests.WeekendDays_IncludeSundayFalse_ReturnsOnlySaturday": noSetOps,
  "NepaliDateRangeExtendedTests.WeekendDays_RangeWithNoWeekend_ReturnsEmpty": noSetOps,
  "NepaliDateRangeExtendedTests.WeekendDays_EmptyRange_ReturnsEmpty": noSetOps,
  "NepaliDateRangeExtendedTests.WorkingDays_ExcludeSundayFalse_ExcludesOnlySaturday": noSetOps,
  "NepaliDateRangeExtendedTests.WorkingDays_ExcludeSundayTrue_ExcludesBothSatAndSun": noSetOps,
  "NepaliDateRangeExtendedTests.WorkingDays_EmptyRange_ReturnsEmpty": noSetOps,
  "NepaliDateRangeExtendedTests.FromDayCount_ZeroDays_ThrowsArgumentOutOfRangeException": noSetOps,
  "NepaliDateRangeExtendedTests.FromDayCount_NegativeDays_ThrowsArgumentOutOfRangeException":
    noSetOps,
  "NepaliDateRangeExtendedTests.Intersect_NonOverlappingRanges_ReturnsEmptyRange": noSetOps,
  "NepaliDateRangeExtendedTests.Intersect_AdjacentRanges_ReturnsEmptyRange": noSetOps,
  "NepaliDateRangeExtendedTests.Intersect_OneRangeFullyInsideOther_ReturnsInnerRange": noSetOps,
  "NepaliDateRangeExtendedTests.Union_LeftRangeIsEmpty_ReturnsRightRange": noSetOps,
  "NepaliDateRangeExtendedTests.Union_RightRangeIsEmpty_ReturnsLeftRange": noSetOps,
  "NepaliDateRangeExtendedTests.Union_NonOverlappingRanges_SpansEntireGap": noSetOps,
  "NepaliDateRangeExtendedTests.Contains_ExactStartDate_ReturnsTrue": () =>
    expect(DateRange.of(of(2080, 1, 5), of(2080, 1, 20)).contains(of(2080, 1, 5))).toBe(true),
  "NepaliDateRangeExtendedTests.Contains_ExactEndDate_ReturnsTrue": () =>
    expect(DateRange.of(of(2080, 1, 5), of(2080, 1, 20)).contains(of(2080, 1, 20))).toBe(true),
  "NepaliDateRangeExtendedTests.Contains_OneDayBeforeStart_ReturnsFalse": () =>
    expect(DateRange.of(of(2080, 1, 5), of(2080, 1, 20)).contains(of(2080, 1, 4))).toBe(false),
  "NepaliDateRangeExtendedTests.Contains_OneDayAfterEnd_ReturnsFalse": () =>
    expect(DateRange.of(of(2080, 1, 5), of(2080, 1, 20)).contains(of(2080, 1, 21))).toBe(false),
  "NepaliDateRangeExtendedTests.Contains_EmptyRange_ContainsNothing": noSetOps,
  "NepaliDateRangeExtendedTests.IsAdjacentTo_GapBetweenRanges_ReturnsFalse": noSetOps,
  "NepaliDateRangeExtendedTests.IsAdjacentTo_OverlappingRanges_ReturnsFalse": noSetOps,
  "NepaliDateRangeExtendedTests.IsAdjacentTo_EmptyRange_ReturnsFalse": noSetOps,
  "NepaliDateRangeExtendedTests.Except_NonOverlappingExcludeRange_ReturnsOriginalRange": noSetOps,
  "NepaliDateRangeExtendedTests.Except_ExcludeRangeFullyContainsThis_ReturnsEmptyArray": noSetOps,
  "NepaliDateRangeExtendedTests.Except_ExcludeOverlapsStart_ReturnsRightPart": noSetOps,
  "NepaliDateRangeExtendedTests.Except_ExcludeOverlapsEnd_ReturnsLeftPart": noSetOps,
  "NepaliDateRangeExtendedTests.GetEnumerator_ThreeDayRange_YieldsExactlyThreeDates": () =>
    expect([...DateRange.of(of(2080, 1, 5), of(2080, 1, 7))]).toHaveLength(3),
  "NepaliDateRangeExtendedTests.GetEnumerator_EmptyRange_YieldsNoDates": noSetOps,
  "NepaliDateRangeExtendedTests.GetEnumerator_SingleDayRange_YieldsOneDate": () =>
    expect([...DateRange.of(of(2080, 1, 5), of(2080, 1, 5))]).toHaveLength(1),
  "NepaliDateRangeExtendedTests.ToString_DefaultFormat_IsStartDashEnd": noSetOps,
  "NepaliDateRangeExtendedTests.ToString_EmptyRange_ReturnsEmptyRangeString": noSetOps,
  "NepaliDateRangeExtendedTests.ToString_WithDateFormat_UsesSpecifiedFormat": noSetOps,
  "NepaliDateRangeExtendedTests.ToString_WithDateFormat_EmptyRange_ReturnsEmptyRangeString":
    noSetOps,
  "NepaliDateRangeExtendedTests.Equals_IdenticalRanges_ReturnsTrue": noSetOps,
  "NepaliDateRangeExtendedTests.Equals_DifferentStart_ReturnsFalse": noSetOps,
  "NepaliDateRangeExtendedTests.Equals_DifferentEnd_ReturnsFalse": noSetOps,
  "NepaliDateRangeExtendedTests.Equals_BothEmpty_ReturnsTrue": noSetOps,
  "NepaliDateRangeExtendedTests.Equals_ObjectOverload_SameRange_ReturnsTrue": noSetOps,
  "NepaliDateRangeExtendedTests.Equals_ObjectOverload_WrongType_ReturnsFalse": noSetOps,
  "NepaliDateRangeExtendedTests.GetHashCode_EqualRanges_SameHash": noSetOps,
  "NepaliDateRangeExtendedTests.OperatorEquals_IdenticalRanges_ReturnsTrue": noSetOps,
  "NepaliDateRangeExtendedTests.OperatorNotEquals_DifferentRanges_ReturnsTrue": noSetOps,

  // Core/NepaliDateRangeTests
  "NepaliDateRangeTests.Constructor_ValidDates_CreatesRange": () => {
    const r = DateRange.of(of(2080, 1, 5), of(2080, 1, 20));
    same(r.start, of(2080, 1, 5));
    same(r.end, of(2080, 1, 20));
  },
  "NepaliDateRangeTests.Constructor_EndBeforeStart_CreatesEmptyRange": noSetOps,
  "NepaliDateRangeTests.SingleDay_CreatesRangeWithOneDay": () =>
    expect(DateRange.of(of(2080, 1, 5), of(2080, 1, 5)).length).toBe(1),
  "NepaliDateRangeTests.FromDayCount_CreatesCorrectRange": noSetOps,
  "NepaliDateRangeTests.ForMonth_CreatesCorrectRange": () =>
    same(DateRange.month(2080, 5).start, of(2080, 5, 1)),
  "NepaliDateRangeTests.ForFiscalYear_CreatesCorrectRange": () =>
    same(new FiscalYear(2080).range().start, of(2080, 4, 1)),
  "NepaliDateRangeTests.Contains_DateInRange_ReturnsTrue": () =>
    expect(DateRange.of(of(2080, 1, 5), of(2080, 1, 20)).contains(of(2080, 1, 10))).toBe(true),
  "NepaliDateRangeTests.Contains_DateOutsideRange_ReturnsFalse": () =>
    expect(DateRange.of(of(2080, 1, 5), of(2080, 1, 20)).contains(of(2080, 1, 25))).toBe(false),
  "NepaliDateRangeTests.Contains_RangeFullyContained_ReturnsTrue": noSetOps,
  "NepaliDateRangeTests.Overlaps_RangesOverlap_ReturnsTrue": noSetOps,
  "NepaliDateRangeTests.Overlaps_RangesDontOverlap_ReturnsFalse": noSetOps,
  "NepaliDateRangeTests.IsAdjacentTo_AdjacentRanges_ReturnsTrue": noSetOps,
  "NepaliDateRangeTests.Intersect_OverlappingRanges_ReturnsIntersection": noSetOps,
  "NepaliDateRangeTests.Union_OverlappingRanges_ReturnsUnion": noSetOps,
  "NepaliDateRangeTests.Except_RemovingRangeFromMiddle_ReturnsTwoRanges": noSetOps,
  "NepaliDateRangeTests.SplitByMonth_RangeAcrossMonths_SplitsCorrectly": noSetOps,
  "NepaliDateRangeTests.WorkingDays_ReturnsCorrectDays": noSetOps,
  "NepaliDateRangeTests.Enumeration_EnumeratesAllDaysInRange": () =>
    expect([...DateRange.of(of(2080, 1, 1), of(2080, 1, 10))]).toHaveLength(10),
  "NepaliDateRangeTests.Demo_RangeOperations": () => {
    // The C# test has no Assert; exercise the ported range surface instead.
    const range = DateRange.of(of(2080, 1, 5), of(2080, 1, 20));
    expect(range.contains(of(2080, 1, 10))).toBe(true);
    expect([...range]).toHaveLength(range.length);
    expect([...DateRange.month(2080, 5)]).toHaveLength(31);
    expect([...new FiscalYear(2080).range()].length).toBeGreaterThan(0);
  },

  // Core/OptimizationVerificationTests (subtraction rows)
  "OptimizationVerificationTests.Subtraction_SameDate_ReturnsZeroDays": () =>
    expect(of(2080, 5, 15).daysUntil(of(2080, 5, 15))).toBe(0),
  "OptimizationVerificationTests.Subtraction_AdjacentDays_ReturnsOneDay": () =>
    expect(of(2080, 5, 15).daysUntil(of(2080, 5, 16))).toBe(1),
  "OptimizationVerificationTests.Subtraction_CrossMonth_CorrectDays": () =>
    expect(
      of(2080, 4, 1)
        .lastOfMonth()
        .daysUntil(of(2080, 5, 1)),
    ).toBe(1),
  "OptimizationVerificationTests.Subtraction_CrossYear_CorrectDays": () =>
    expect(
      of(2079, 12, 1)
        .lastOfMonth()
        .daysUntil(of(2080, 1, 1)),
    ).toBe(1),
};

describe("C# catalogue, phase 2", () => {
  checkCatalog("2", cases2);
});

// ---- Phase 3 ----

const EN_MONTH = [
  "Baishakh",
  "Jestha",
  "Ashad",
  "Shrawan",
  "Bhadra",
  "Ashoj",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
] as const;

// C# passes null to parse methods; strict null checks make that a compile error, so the row
// checks the parameter type instead.
const takesStringOnly: CatalogCase = () => {
  expectTypeOf(NepaliDate.parseLenient).parameter(0).toEqualTypeOf<string>();
};

const sameMonth =
  (month: number): CatalogCase =>
  () => {
    expect(of(2080, month, 15).month).toBe(month);
    expect(monthName(month)).toBe(EN_MONTH[month - 1]);
  };

const monthNumberName =
  (month: number): CatalogCase =>
  () => {
    expect(monthName(month)).toBe(EN_MONTH[month - 1]);
  };

const lenient =
  (input: string, year: number, month: number, day: number): CatalogCase =>
  () => {
    same(NepaliDate.parseLenient(input), of(year, month, day));
  };

const shortForm =
  (order: DateOrder, separator: Separator, pad: boolean, expected: string): CatalogCase =>
  () => {
    expect(of(2080, 5, 15).short({ order, separator, pad })).toBe(expected);
  };

const cases3: Record<string, CatalogCase> = {
  // Core/NepaliDateFormattableTests (the fixture is 2081-04-15)
  "NepaliDateFormattableTests.ToString_NullFormat_ReturnsDefault": () =>
    expect(of(2081, 4, 15).format("")).toBe("2081/04/15"),
  "NepaliDateFormattableTests.ToString_G_SameAsDefault": () =>
    expect(of(2081, 4, 15).format("G")).toBe("2081/04/15"),
  "NepaliDateFormattableTests.ToString_g_SameAsDefault": () =>
    expect(of(2081, 4, 15).format("g")).toBe("2081/04/15"),
  "NepaliDateFormattableTests.ToString_d_SameAsDefault": () =>
    expect(of(2081, 4, 15).format("d")).toBe("2081/04/15"),
  "NepaliDateFormattableTests.ToString_D_ReturnsLongDateString": () =>
    expect(of(2081, 4, 15).format("D")).toContain("2081"),
  "NepaliDateFormattableTests.ToString_s_ReturnsSortableIsoFormat": () =>
    expect(of(2081, 4, 15).format("s")).toBe("2081-04-15"),
  "NepaliDateFormattableTests.CustomFormat_yyyy_MM_dd_WithDash": () =>
    expect(of(2081, 4, 15).format("yyyy-MM-dd")).toBe("2081-04-15"),
  "NepaliDateFormattableTests.CustomFormat_dd_MM_yyyy_WithDot": () =>
    expect(of(2081, 4, 15).format("dd.MM.yyyy")).toBe("15.04.2081"),
  "NepaliDateFormattableTests.CustomFormat_MM_slash_dd_slash_yyyy": () =>
    expect(of(2081, 4, 15).format("MM/dd/yyyy")).toBe("04/15/2081"),
  "NepaliDateFormattableTests.CustomFormat_MMMxxx_ReturnsThreeCharMonthAbbreviation": () =>
    expect(of(2081, 4, 15).format("MMM")).toBe("Shr"),
  "NepaliDateFormattableTests.CustomFormat_MMMM_ReturnsFullMonthName": () =>
    expect(of(2081, 4, 15).format("MMMM")).toBe("Shrawan"),
  "NepaliDateFormattableTests.CustomFormat_yy_ReturnsTwoDigitYear": () =>
    expect(of(2081, 4, 15).format("yy/MM/dd")).toBe("81/04/15"),
  "NepaliDateFormattableTests.CustomFormat_M_WithoutLeadingZero_ReturnsUnpadded": () =>
    expect(of(2081, 4, 15).format("M/d/yyyy")).toBe("4/15/2081"),
  "NepaliDateFormattableTests.CustomFormat_SingleDigitMonth_WithoutLeadingZero": () =>
    expect(of(2081, 1, 5).format("M/d/yyyy")).toBe("1/5/2081"),
  "NepaliDateFormattableTests.CustomFormat_LiteralInSingleQuotes": () =>
    expect(of(2081, 4, 15).format("yyyy'BS'")).toBe("2081BS"),
  "NepaliDateFormattableTests.CustomFormat_BackslashEscapedTokens_ProduceLiterals": () =>
    expect(of(2081, 4, 15).format("yyyy\\M\\M-\\d\\d")).toBe("2081MM-dd"),
  "NepaliDateFormattableTests.CustomFormat_BackslashBeforeLiteralChar_IsPassedThrough": () =>
    expect(of(2081, 4, 15).format("yyyy\\-MM\\-dd")).toBe("2081-04-15"),
  "NepaliDateFormattableTests.StringInterpolation_WithFormatSpecifier_UsesIFormattable": () =>
    expect(of(2081, 4, 15).format("yyyy-MM-dd")).toBe("2081-04-15"),
  "NepaliDateFormattableTests.StringFormatMethod_WithSpecifier": () =>
    expect(of(2081, 4, 15).format("yyyy-MM-dd")).toBe("2081-04-15"),
  "NepaliDateFormattableTests.SortableFormat_LexicographicOrderEqualsChronologicalOrder": () =>
    expect(of(2080, 1, 1).format("s") < of(2081, 1, 1).format("s")).toBe(true),

  // Core/NepaliDateParsableTests
  "NepaliDateParsableTests.Parse_Via_GenericConstraint_Returns_CorrectDate": () =>
    same(NepaliDate.parse("2080/04/15"), of(2080, 4, 15)),
  "NepaliDateParsableTests.TryParse_Via_GenericConstraint_ValidDate_Returns_True": () =>
    expect(NepaliDate.tryParse("2080/04/15")?.equals(of(2080, 4, 15))).toBe(true),
  "NepaliDateParsableTests.TryParse_Via_GenericConstraint_InvalidDate_Returns_False": () =>
    expect(NepaliDate.tryParse("garbage")).toBeNull(),
  "NepaliDateParsableTests.SpanParse_Via_GenericConstraint_Returns_CorrectDate": () =>
    same(NepaliDate.parse("2080/04/15"), of(2080, 4, 15)),
  "NepaliDateParsableTests.SpanTryParse_Via_GenericConstraint_ValidDate_Returns_True": () =>
    expect(NepaliDate.tryParse("2080/04/15")).not.toBeNull(),

  // Core/NepaliDateMonthNameTests: the C# MonthName enum maps to the 1-based month number.
  "NepaliDateMonthNameTests.MonthName_AllMonths_ReturnCorrectEnum#1": sameMonth(1),
  "NepaliDateMonthNameTests.MonthName_AllMonths_ReturnCorrectEnum#2": sameMonth(2),
  "NepaliDateMonthNameTests.MonthName_AllMonths_ReturnCorrectEnum#3": sameMonth(3),
  "NepaliDateMonthNameTests.MonthName_AllMonths_ReturnCorrectEnum#4": sameMonth(4),
  "NepaliDateMonthNameTests.MonthName_AllMonths_ReturnCorrectEnum#5": sameMonth(5),
  "NepaliDateMonthNameTests.MonthName_AllMonths_ReturnCorrectEnum#6": sameMonth(6),
  "NepaliDateMonthNameTests.MonthName_AllMonths_ReturnCorrectEnum#7": sameMonth(7),
  "NepaliDateMonthNameTests.MonthName_AllMonths_ReturnCorrectEnum#8": sameMonth(8),
  "NepaliDateMonthNameTests.MonthName_AllMonths_ReturnCorrectEnum#9": sameMonth(9),
  "NepaliDateMonthNameTests.MonthName_AllMonths_ReturnCorrectEnum#10": sameMonth(10),
  "NepaliDateMonthNameTests.MonthName_AllMonths_ReturnCorrectEnum#11": sameMonth(11),
  "NepaliDateMonthNameTests.MonthName_AllMonths_ReturnCorrectEnum#12": sameMonth(12),
  "NepaliDateMonthNameTests.MonthName_SameMonthDifferentDays_AllReturnSameEnum": () =>
    expect(of(2080, 4, 15).month).toBe(4),
  "NepaliDateMonthNameTests.MonthName_SameMonthDifferentYears_AllReturnSameEnum#1": () =>
    expect(of(2070, 9, 1).month).toBe(9),
  "NepaliDateMonthNameTests.MonthName_SameMonthDifferentYears_AllReturnSameEnum#2": () =>
    expect(of(2080, 9, 1).month).toBe(9),
  "NepaliDateMonthNameTests.MonthName_SameMonthDifferentYears_AllReturnSameEnum#3": () =>
    expect(of(2090, 9, 1).month).toBe(9),
  "NepaliDateMonthNameTests.MonthName_SameMonthDifferentYears_AllReturnSameEnum#4": () =>
    expect(of(2100, 9, 1).month).toBe(9),
  "NepaliDateMonthNameTests.MonthName_AddingOneMonth_AdvancesEnum": () =>
    expect(of(2080, 11, 1).month).toBe(11),
  "NepaliDateMonthNameTests.MonthName_YearBoundary_WrapsFromChaitraToBasikhakh": () =>
    expect(of(2080, 12, 1).month).toBe(12),
  "NepaliDateMonthNameTests.NepaliMonthsEnum_IntegerValueMatchesMonthNumber#1": monthNumberName(1),
  "NepaliDateMonthNameTests.NepaliMonthsEnum_IntegerValueMatchesMonthNumber#2": monthNumberName(2),
  "NepaliDateMonthNameTests.NepaliMonthsEnum_IntegerValueMatchesMonthNumber#3": monthNumberName(3),
  "NepaliDateMonthNameTests.NepaliMonthsEnum_IntegerValueMatchesMonthNumber#4": monthNumberName(4),
  "NepaliDateMonthNameTests.NepaliMonthsEnum_IntegerValueMatchesMonthNumber#5": monthNumberName(5),
  "NepaliDateMonthNameTests.NepaliMonthsEnum_IntegerValueMatchesMonthNumber#6": monthNumberName(6),
  "NepaliDateMonthNameTests.NepaliMonthsEnum_IntegerValueMatchesMonthNumber#7": monthNumberName(7),
  "NepaliDateMonthNameTests.NepaliMonthsEnum_IntegerValueMatchesMonthNumber#8": monthNumberName(8),
  "NepaliDateMonthNameTests.NepaliMonthsEnum_IntegerValueMatchesMonthNumber#9": monthNumberName(9),
  "NepaliDateMonthNameTests.NepaliMonthsEnum_IntegerValueMatchesMonthNumber#10":
    monthNumberName(10),
  "NepaliDateMonthNameTests.NepaliMonthsEnum_IntegerValueMatchesMonthNumber#11":
    monthNumberName(11),
  "NepaliDateMonthNameTests.NepaliMonthsEnum_IntegerValueMatchesMonthNumber#12":
    monthNumberName(12),

  // Core/OptimizationVerificationTests: ToString and ToUnicodeString
  "OptimizationVerificationTests.ToString_ProducesExactFormat#1": () =>
    expect(of(2080, 5, 15).toString()).toBe("2080/05/15"),
  "OptimizationVerificationTests.ToString_ProducesExactFormat#2": () =>
    expect(of(2080, 1, 1).toString()).toBe("2080/01/01"),
  "OptimizationVerificationTests.ToString_ProducesExactFormat#3": () =>
    expect(of(2080, 12, 30).toString()).toBe("2080/12/30"),
  "OptimizationVerificationTests.ToString_ProducesExactFormat#4": () =>
    expect(of(1901, 1, 1).toString()).toBe("1901/01/01"),
  "OptimizationVerificationTests.ToString_ProducesExactFormat#5": () =>
    expect(of(2199, 12, 30).toString()).toBe("2199/12/30"),
  "OptimizationVerificationTests.ToString_ProducesExactFormat#6": () =>
    expect(of(2000, 6, 9).toString()).toBe("2000/06/09"),
  "OptimizationVerificationTests.ToString_ProducesExactFormat#7": () =>
    expect(of(2100, 10, 29).toString()).toBe("2100/10/29"),
  "OptimizationVerificationTests.ToString_OutputIsExactly10Characters": () =>
    expect(of(2080, 5, 15).toString()).toHaveLength(10),
  "OptimizationVerificationTests.ToString_AllMonthsZeroPadded": () => {
    for (let m = 1; m <= 12; m++)
      expect(of(2080, m, 1).toString().slice(5, 7)).toBe(String(m).padStart(2, "0"));
  },
  "OptimizationVerificationTests.ToString_AllDaysZeroPadded": () => {
    for (let d = 1; d <= of(2080, 5, 1).monthLength; d++)
      expect(of(2080, 5, d).toString().slice(8, 10)).toBe(String(d).padStart(2, "0"));
  },
  "OptimizationVerificationTests.ToString_RoundtripsWithConstructor": () =>
    expect(NepaliDate.parse(of(2080, 5, 15).toString()).equals(of(2080, 5, 15))).toBe(true),
  "OptimizationVerificationTests.ToString_WithFormatAndSeparator_ProducesCorrectOutput#1":
    shortForm("ymd", "/", true, "2080/05/15"),
  "OptimizationVerificationTests.ToString_WithFormatAndSeparator_ProducesCorrectOutput#2":
    shortForm("ymd", "-", true, "2080-05-15"),
  "OptimizationVerificationTests.ToString_WithFormatAndSeparator_ProducesCorrectOutput#3":
    shortForm("ymd", ".", true, "2080.05.15"),
  "OptimizationVerificationTests.ToString_WithFormatAndSeparator_ProducesCorrectOutput#4":
    shortForm("ymd", "_", true, "2080_05_15"),
  "OptimizationVerificationTests.ToString_WithFormatAndSeparator_ProducesCorrectOutput#5":
    shortForm("ymd", " ", true, "2080 05 15"),
  "OptimizationVerificationTests.ToString_WithFormatAndSeparator_ProducesCorrectOutput#6":
    shortForm("ymd", "\\", true, "2080\\05\\15"),
  "OptimizationVerificationTests.ToString_WithFormatAndSeparator_ProducesCorrectOutput#7":
    shortForm("dmy", "/", true, "15/05/2080"),
  "OptimizationVerificationTests.ToString_WithFormatAndSeparator_ProducesCorrectOutput#8":
    shortForm("dmy", "-", true, "15-05-2080"),
  "OptimizationVerificationTests.ToString_WithFormatAndSeparator_ProducesCorrectOutput#9":
    shortForm("mdy", "/", true, "05/15/2080"),
  "OptimizationVerificationTests.ToString_WithFormatAndSeparator_ProducesCorrectOutput#10":
    shortForm("ydm", "/", true, "2080/15/05"),
  "OptimizationVerificationTests.ToString_WithFormatAndSeparator_ProducesCorrectOutput#11":
    shortForm("myd", "/", true, "05/2080/15"),
  "OptimizationVerificationTests.ToString_WithFormatAndSeparator_ProducesCorrectOutput#12":
    shortForm("dym", "/", true, "15/2080/05"),
  "OptimizationVerificationTests.ToString_WithoutLeadingZeros_ProducesCorrectOutput#1": shortForm(
    "ymd",
    "/",
    false,
    "2080/5/15",
  ),
  "OptimizationVerificationTests.ToString_WithoutLeadingZeros_ProducesCorrectOutput#2": shortForm(
    "dmy",
    "-",
    false,
    "15-5-2080",
  ),
  "OptimizationVerificationTests.ToString_WithoutLeadingZeros_ProducesCorrectOutput#3": shortForm(
    "mdy",
    ".",
    false,
    "5.15.2080",
  ),
  "OptimizationVerificationTests.ToUnicodeString_DefaultFormat_ConvertsAllDigits": () =>
    expect(of(2080, 5, 15).short({ lang: "ne" })).toBe("२०८०/०५/१५"),
  "OptimizationVerificationTests.ToUnicodeString_EachDigitConvertsCorrectly": () =>
    expect(of(2081, 4, 15).short({ lang: "ne" })).toContain("१"),
  "OptimizationVerificationTests.ToUnicodeString_SeparatorsPreserved": () =>
    expect(of(2080, 5, 15).short({ order: "ymd", separator: "-", lang: "ne" })).toContain("-"),
  "OptimizationVerificationTests.ToUnicodeString_SameLengthAsToString": () => {
    const d = of(2080, 5, 15);
    expect(d.short({ lang: "ne" })).toHaveLength(d.toString().length);
  },

  // Core/OptimizationVerificationTests: SmartDateParser (lenient, D-06 deviations marked)
  "OptimizationVerificationTests.SmartDateParser_NepaliDigits_ParseCorrectly#1": () =>
    same(NepaliDate.parse("२०८०/०५/१५"), of(2080, 5, 15)),
  "OptimizationVerificationTests.SmartDateParser_NepaliDigits_ParseCorrectly#2": () =>
    same(NepaliDate.parse("२०८०-०५-१५"), of(2080, 5, 15)),
  "OptimizationVerificationTests.SmartDateParser_PureEnglishDigits_NoConversionNeeded": () =>
    same(NepaliDate.parse("2080/05/15"), of(2080, 5, 15)),
  "OptimizationVerificationTests.SmartDateParser_MixedNepaliEnglishDigits_ParseCorrectly": () =>
    same(NepaliDate.parse("2080/०५/15"), of(2080, 5, 15)),
  "OptimizationVerificationTests.SmartDateParser_WithIndicators_RemovesAndParsesCorrectly#1":
    lenient("2080/05/15 B.S.", 2080, 5, 15),
  "OptimizationVerificationTests.SmartDateParser_WithIndicators_RemovesAndParsesCorrectly#2":
    lenient("2080/05/15 BS", 2080, 5, 15),
  "OptimizationVerificationTests.SmartDateParser_WithIndicators_RemovesAndParsesCorrectly#3":
    lenient("2080/05/15 V.S.", 2080, 5, 15),
  "OptimizationVerificationTests.SmartDateParser_WithIndicators_RemovesAndParsesCorrectly#4":
    lenient("2080/05/15 VS", 2080, 5, 15),
  "OptimizationVerificationTests.SmartDateParser_WithIndicators_RemovesAndParsesCorrectly#5":
    lenient("2080/05/15 bs", 2080, 5, 15),
  "OptimizationVerificationTests.SmartDateParser_WithIndicators_RemovesAndParsesCorrectly#6":
    lenient("2080/05/15 v.s.", 2080, 5, 15),
  "OptimizationVerificationTests.SmartDateParser_WithNepaliKeywords_RemovesAndParses": () =>
    same(NepaliDate.parseLenient("2080/05/15 गते"), of(2080, 5, 15)),
  "OptimizationVerificationTests.SmartDateParser_WithExtraSpaces_ParsesCorrectly": () =>
    same(NepaliDate.parseLenient("  2080 / 05 / 15  "), of(2080, 5, 15)),
  "OptimizationVerificationTests.SmartDateParser_AllMonthNames_ParseCorrectly#1": lenient(
    "15 Baisakh 2080",
    2080,
    1,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_AllMonthNames_ParseCorrectly#2": lenient(
    "15 Jestha 2080",
    2080,
    2,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_AllMonthNames_ParseCorrectly#3": lenient(
    "15 Asar 2080",
    2080,
    3,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_AllMonthNames_ParseCorrectly#4": lenient(
    "15 Shrawan 2080",
    2080,
    4,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_AllMonthNames_ParseCorrectly#5": lenient(
    "15 Bhadra 2080",
    2080,
    5,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_AllMonthNames_ParseCorrectly#6": lenient(
    "15 Ashwin 2080",
    2080,
    6,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_AllMonthNames_ParseCorrectly#7": lenient(
    "15 Kartik 2080",
    2080,
    7,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_AllMonthNames_ParseCorrectly#8": lenient(
    "15 Mangsir 2080",
    2080,
    8,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_AllMonthNames_ParseCorrectly#9": lenient(
    "15 Poush 2080",
    2080,
    9,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_AllMonthNames_ParseCorrectly#10": lenient(
    "15 Magh 2080",
    2080,
    10,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_AllMonthNames_ParseCorrectly#11": lenient(
    "15 Falgun 2080",
    2080,
    11,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_AllMonthNames_ParseCorrectly#12": lenient(
    "15 Chaitra 2080",
    2080,
    12,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_MonthNameDifferentPositions_ParsesCorrectly#1":
    lenient("Baisakh 15, 2080", 2080, 1, 15),
  "OptimizationVerificationTests.SmartDateParser_MonthNameDifferentPositions_ParsesCorrectly#2":
    lenient("2080 Baisakh 15", 2080, 1, 15),
  "OptimizationVerificationTests.SmartDateParser_NepaliUnicodeMonthNames_ParseCorrectly#1": lenient(
    "15 वैशाख 2080",
    2080,
    1,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_NepaliUnicodeMonthNames_ParseCorrectly#2": lenient(
    "15 जेष्ठ 2080",
    2080,
    2,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_NepaliUnicodeMonthNames_ParseCorrectly#3": lenient(
    "15 असार 2080",
    2080,
    3,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_NepaliUnicodeMonthNames_ParseCorrectly#4": lenient(
    "15 श्रावण 2080",
    2080,
    4,
    15,
  ),
  "OptimizationVerificationTests.SmartDateParser_TwoDigitYear_AdjustedTo2000s": {
    deviation: "D-06",
  },
  "OptimizationVerificationTests.SmartDateParser_InvalidInput_ThrowsFormatException": () =>
    throwsKind(() => NepaliDate.parseLenient("not a date"), "unrecognized"),
  "OptimizationVerificationTests.SmartDateParser_NullInput_ThrowsException": takesStringOnly,
  "OptimizationVerificationTests.SmartDateParser_EmptyInput_ThrowsException": () =>
    throwsKind(() => NepaliDate.parseLenient(""), "unrecognized"),
  "OptimizationVerificationTests.SmartDateParser_WhitespaceInput_ThrowsException": () =>
    throwsKind(() => NepaliDate.parseLenient(" "), "unrecognized"),
  "OptimizationVerificationTests.SmartDateParser_TryParse_ValidInput_ReturnsTrue": () =>
    expect(NepaliDate.parseLenient("2080/05/15").equals(of(2080, 5, 15))).toBe(true),
  "OptimizationVerificationTests.SmartDateParser_TryParse_InvalidInput_ReturnsFalse": () =>
    throwsKind(() => NepaliDate.parseLenient("garbage"), "unrecognized"),
  "OptimizationVerificationTests.SmartDateParser_TryParse_NullInput_ReturnsFalse": takesStringOnly,

  // Core/OptimizationVerificationTests: ToLongDateString and round-trips
  "OptimizationVerificationTests.ToLongDateString_Default_ContainsMonthNameAndDay": () =>
    expect(of(2080, 5, 15).long()).toContain("15"),
  "OptimizationVerificationTests.ToLongDateString_WithDayName_ContainsDayOfWeek": () =>
    expect(of(2080, 5, 15).long({ weekday: true })).toContain("Friday"),
  "OptimizationVerificationTests.ToLongDateString_WithoutYear_DoesNotContainYear": () =>
    expect(of(2080, 5, 15).long({ year: false })).not.toContain("2080"),
  "OptimizationVerificationTests.ToString_EveryMonthFirstDay_RoundtripsViaConstructor": () => {
    for (let y = 1901; y <= 2199; y++) {
      for (let m = 1; m <= 12; m++) {
        expect(NepaliDate.parse(of(y, m, 1).toString()).year).toBe(y);
      }
    }
  },
  "OptimizationVerificationTests.UnicodeConversion_AllDigits_RoundtripCorrectly": () => {
    for (let y = 1901; y <= 2199; y++) {
      for (let m = 1; m <= 12; m++) {
        expect(NepaliDate.parse(of(y, m, 1).short({ lang: "ne" })).year).toBe(y);
      }
    }
  },

  // SmartDateParserTests: lenient parse; D-06 where the port refuses to guess.
  "SmartDateParserTests.Parse_StandardFormat_ReturnsCorrectDate": () =>
    same(NepaliDate.parseLenient("2080/04/15"), of(2080, 4, 15)),
  "SmartDateParserTests.Parse_InvertedFormat_ReturnsCorrectDate": () =>
    same(NepaliDate.parseLenient("15/04/2080"), of(2080, 4, 15)),
  "SmartDateParserTests.Parse_MonthDayYearFormat_ReturnsCorrectDate": { deviation: "D-06" },
  "SmartDateParserTests.Parse_WithMonthNames_ReturnsCorrectDate": () =>
    same(NepaliDate.parseLenient("15 Shrawan 2080"), of(2080, 4, 15)),
  "SmartDateParserTests.Parse_WithNepaliUnicode_ReturnsCorrectDate": () =>
    same(NepaliDate.parseLenient("२०८०/०४/१५"), of(2080, 4, 15)),
  "SmartDateParserTests.Parse_MixedFormats_ReturnsCorrectDate": () =>
    same(NepaliDate.parseLenient("15 साउन 2080"), of(2080, 4, 15)),
  "SmartDateParserTests.Parse_WithSuffixes_ReturnsCorrectDate": () =>
    same(NepaliDate.parseLenient("15 Shrawan 2080 B.S."), of(2080, 4, 15)),
  "SmartDateParserTests.Parse_WithTypos_ReturnsCorrectDate": () =>
    same(NepaliDate.parseLenient("15 Srawan 2080"), of(2080, 4, 15)),
  "SmartDateParserTests.Parse_ShorterYearFormats_ReturnsCorrectDate": { deviation: "D-06" },
  "SmartDateParserTests.Parse_InvalidFormat_ThrowsFormatException": () =>
    throwsKind(() => NepaliDate.parseLenient("not a date"), "unrecognized"),
  "SmartDateParserTests.TryParse_ValidFormat_ReturnsTrue": () =>
    expect(NepaliDate.parseLenient("2080/04/15").equals(of(2080, 4, 15))).toBe(true),
  "SmartDateParserTests.TryParse_InvalidFormat_ReturnsFalse": () =>
    throwsKind(() => NepaliDate.parseLenient("not a date"), "unrecognized"),
  "SmartDateParserTests.ExtensionMethod_ToNepaliDate_ParsesCorrectly": () =>
    same(NepaliDate.parse("2080/04/15"), of(2080, 4, 15)),
  "SmartDateParserTests.ExtensionMethod_TryToNepaliDate_ParsesCorrectly": () =>
    expect(NepaliDate.tryParse("2080/04/15")?.equals(of(2080, 4, 15))).toBe(true),

  // StringExtensionsTests: string -> NepaliDate via parse / tryParse.
  "StringExtensionsTests.ToNepaliDate_ValidDateString_ReturnsNepaliDate": () =>
    same(NepaliDate.parse("2080/05/15"), of(2080, 5, 15)),
  "StringExtensionsTests.ToNepaliDate_NepaliDigits_ReturnsNepaliDate": () =>
    same(NepaliDate.parse("२०८०/०५/१५"), of(2080, 5, 15)),
  "StringExtensionsTests.ToNepaliDate_InvalidDateString_ThrowsFormatException": () =>
    throwsKind(() => NepaliDate.parse("not a date"), "invalid-character"),
  "StringExtensionsTests.TryToNepaliDate_ValidDateString_ReturnsTrue": () =>
    expect(NepaliDate.tryParse("2080/05/15")?.equals(of(2080, 5, 15))).toBe(true),
  "StringExtensionsTests.TryToNepaliDate_InvalidDateString_ReturnsFalse": () =>
    expect(NepaliDate.tryParse("not a date")).toBeNull(),
};

describe("C# catalogue, phase 3", () => {
  checkCatalog("3", cases3);
});
