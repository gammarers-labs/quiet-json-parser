/**
 * Base error for this package. Instantiate a subclass instead.
 */
export abstract class QuietJsonParserError extends Error {
  override readonly name: string = 'QuietJsonParserError';

  protected constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, QuietJsonParserError.prototype);
  }
}

const VALIDATE_MISMATCH_MESSAGE = 'Parsed JSON did not match the expected shape';

/**
 * Passed to {@link QuietJsonParserOnError} when JSON text is longer than `maxBytes`.
 * The message includes the UTF-8 size and the limit, not the text.
 */
export class QuietJsonParserMaxBytesError extends QuietJsonParserError {
  override readonly name: string = 'QuietJsonParserMaxBytesError';

  /**
   * @param size - UTF-8 byte length of the JSON text
   * @param maxBytes - Configured limit
   */
  constructor(size: number, maxBytes: number) {
    super(`JSON input exceeds maxBytes: size is ${size}, expected at most ${maxBytes}.`);
    Object.setPrototypeOf(this, QuietJsonParserMaxBytesError.prototype);
  }
}

/**
 * Passed to {@link QuietJsonParserOnError} when JSON nesting is deeper than `maxDepth`.
 * `depth` in the message is the first level past the limit. The rest of the text is not scanned.
 */
export class QuietJsonParserMaxDepthError extends QuietJsonParserError {
  override readonly name: string = 'QuietJsonParserMaxDepthError';

  /**
   * @param depth - First nesting level past `maxDepth`
   * @param maxDepth - Configured limit
   */
  constructor(depth: number, maxDepth: number) {
    super(`JSON input exceeds maxDepth: depth is ${depth}, expected at most ${maxDepth}.`);
    Object.setPrototypeOf(this, QuietJsonParserMaxDepthError.prototype);
  }
}

/**
 * Thrown when `maxDepth` or `maxBytes` is set to a value that is not a non-negative integer.
 * `quietParse` does not catch this error and does not pass it to `onError`.
 */
export class QuietJsonParserOptionsError extends QuietJsonParserError {
  override readonly name: string = 'QuietJsonParserOptionsError';

  /**
   * @param message - Which configured limits are invalid
   */
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, QuietJsonParserOptionsError.prototype);
  }
}

/**
 * Passed to {@link QuietJsonParserOnError} when parsed JSON does not match `validate`.
 * Does not include the rejected value, to avoid leaking data through logs.
 */
export class QuietJsonParserValidateError extends QuietJsonParserError {
  override readonly name: string = 'QuietJsonParserValidateError';

  constructor(message: string = VALIDATE_MISMATCH_MESSAGE) {
    super(message);
    Object.setPrototypeOf(this, QuietJsonParserValidateError.prototype);
  }
}
