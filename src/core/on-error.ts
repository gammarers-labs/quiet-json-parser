/**
 * Callback invoked when a parse limit is exceeded, or when parse, validate, or stringify fails.
 *
 * @param error - The caught error, a limit error, or a {@link QuietJsonParserValidateError} on shape mismatch
 */
export type QuietJsonParserOnError = (error: unknown) => void;
