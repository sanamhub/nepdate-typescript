/**
 * What went wrong, for code that handles a {@link NepDateError}.
 * @example
 * new NepDateError("invalid-month", "month 13 is outside 1..12").kind; // => "invalid-month"
 */
export type ErrorKind =
  | "out-of-range"
  | "invalid-month"
  | "invalid-day"
  | "invalid-gregorian"
  | "invalid-zone"
  | "not-an-integer"
  | "invalid-character"
  | "wrong-group-count"
  | "number-too-long"
  | "ambiguous"
  | "unrecognized";

/**
 * The one error type of `nepdate-core`. It extends `Error`, so `instanceof Error` holds and `kind`
 * says which check failed. An unknown time zone is reported as `"invalid-zone"` instead of the raw
 * `RangeError` that `Intl` throws, so one `instanceof NepDateError` test catches every failure of
 * this package.
 * @example
 * const error = new NepDateError("invalid-month", "month 13 is outside 1..12");
 * error.kind; // => "invalid-month"
 */
export class NepDateError extends Error {
  /** Which check failed. */
  readonly kind: ErrorKind;
  override readonly name: "NepDateError" = "NepDateError";

  /** Creates an error of `kind` with a human-readable `message`. */
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}
