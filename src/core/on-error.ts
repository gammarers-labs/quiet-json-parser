/**
 * Callback invoked when parse, validate, or stringify fails.
 *
 * @param error - The caught error, or a {@link QuietJsonParserValidateError} on shape mismatch
 */
export type QuietJsonParserOnError = (error: unknown) => void;
