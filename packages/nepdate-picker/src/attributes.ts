// Types only, for declaring the elements in a framework's JSX or template types (README,
// "TypeScript in frameworks"). Nothing here depends on React, Vue or any other framework.

/**
 * The attributes of `<nepdate-calendar>`, for a framework's element types.
 */
export interface NepDateCalendarAttributes {
  /** The chosen date, `YYYY-MM-DD` in BS. */
  value?: string;
  /** The earliest date that can be chosen. */
  min?: string;
  /** The latest date that can be chosen. */
  max?: string;
  /** `en` or `ne`; without it, the nearest ancestor's `lang`. */
  lang?: string;
  /** 0 = Sunday (the default) to 6 = Saturday. */
  "first-day-of-week"?: number | string;
  /** Shows the AD day under each BS day. */
  "show-gregorian"?: boolean;
}

/**
 * The attributes of `<nepdate-input>`, for a framework's element types.
 */
export interface NepDateInputAttributes extends NepDateCalendarAttributes {
  /** The form field name. */
  name?: string;
  /** The form needs a date. */
  required?: boolean;
  /** No typing, no calendar, not submitted. */
  disabled?: boolean;
  /** No typing and no calendar, but submitted. */
  readonly?: boolean;
  /** The hint in the empty field. */
  placeholder?: string;
}
