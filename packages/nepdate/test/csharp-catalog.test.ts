// C# NepDate's own tests (shared/spec/vectors/csharp-tests/catalog.tsv), translated to this API.
// One test per catalogue row (docs/plan/00-ROADMAP.md, "C# test catalogue").

import { describe, expect, expectTypeOf } from "vitest";
import { type ErrorKind, NepaliDate, NepDateError } from "../src/index.js";
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
