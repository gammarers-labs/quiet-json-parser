/**
 * Base error for this package. Instantiate a subclass instead.
 */
export abstract class QuietJsonParserError extends Error {
  override readonly name: string = 'QuietJsonParserError';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, QuietJsonParserError.prototype);
  }
}

const VALIDATE_MISMATCH_MESSAGE = 'Parsed JSON did not match the expected shape';

/**
 * Passed to `onError` when parsed JSON does not match `validate`.
 * Does not include the rejected value, to avoid leaking data through logs.
 */
export class QuietJsonParserValidateError extends QuietJsonParserError {
  override readonly name: string = 'QuietJsonParserValidateError';

  constructor(message: string = VALIDATE_MISMATCH_MESSAGE) {
    super(message);
    Object.setPrototypeOf(this, QuietJsonParserValidateError.prototype);
  }
}
