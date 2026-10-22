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
  | "not-an-integer"
  | "invalid-character"
  | "wrong-group-count"
  | "number-too-long"
  | "ambiguous"
  | "unrecognized";

/**
 * The one error type of `nepdate-core`. It extends `RangeError`, so `instanceof RangeError` still holds,
 * and `kind` says which check failed.
 * @example
 * const error = new NepDateError("invalid-month", "month 13 is outside 1..12");
 * error.kind; // => "invalid-month"
 */
export class NepDateError extends RangeError {
  /** Which check failed. */
  readonly kind: ErrorKind;
  override readonly name: "NepDateError" = "NepDateError";

  /** Creates an error of `kind` with a human-readable `message`. */
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}
