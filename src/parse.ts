import { QuietJsonParserValidateError } from './core/errors';
import { omitUnsafeDeep } from './core/omit-unsafe';

/**
 * Callback invoked when parsing or validation fails.
 *
 * @param error - The caught error, or a `QuietJsonParserValidateError` on shape mismatch
 */
export type QuietParseOnError = (error: unknown) => void;

/**
 * Runtime check for a parsed JSON value.
 * A type predicate (`value is T`) or any boolean-returning function is accepted.
 * Schema libraries can wrap `safeParse` here.
 *
 * @typeParam T - Expected result type when used as a type predicate
 * @param value - Sanitized parse result
 * @returns Whether `value` matches the expected shape
 */
export type QuietParseValidate<T> = ((value: unknown) => value is T) | ((value: unknown) => boolean);

/**
 * Settings for `quietParse`. Prefer this object form so future options
 * (reviver, omit keys, depth limits, and similar) can be added without new positional args.
 *
 * @typeParam T - Expected result type
 */
export interface QuietParseOptions<T> {
  /**
   * Value returned for missing input, parse errors, or validation failure.
   */
  readonly fallback: T;
  /**
   * Runtime check run on the sanitized parse result.
   * On `false`, `onError` receives `QuietJsonParserValidateError` and `fallback` is returned.
   * If this function throws, the thrown value is passed to `onError`.
   */
  readonly validate?: QuietParseValidate<T>;
  /**
   * Called when `JSON.parse` throws, when `validate` throws, or when `validate`
   * returns `false`. Not called for nullish or empty input.
   */
  readonly onError?: QuietParseOnError;
}

/**
 * Options for the positional third argument (without `fallback`).
 *
 * @typeParam T - Expected result type
 */
export type QuietParseExtraOptions<T> = Omit<QuietParseOptions<T>, 'fallback'>;

/**
 * Whether the second argument is an options object (has a `fallback` property).
 *
 * @param value - Second argument to `quietParse`
 * @returns `true` when `value` looks like {@link QuietParseOptions}
 */
const isParseOptions = <T>(value: unknown): value is QuietParseOptions<T> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'fallback' in value;
};

/**
 * Resolve positional or options-object arguments into {@link QuietParseOptions}.
 *
 * @typeParam T - Expected result type
 * @param fallbackOrOptions - Fallback value, or a full options object
 * @param onErrorOrOptions - Legacy `onError` callback, or extra options without `fallback`
 * @returns Normalized options including `fallback`
 */
const toParseOptions = <T>(
  fallbackOrOptions: T | QuietParseOptions<T>,
  onErrorOrOptions?: QuietParseOnError | QuietParseExtraOptions<T>,
): QuietParseOptions<T> => {
  if (isParseOptions<T>(fallbackOrOptions)) {
    return fallbackOrOptions;
  }

  if (typeof onErrorOrOptions === 'function') {
    return { fallback: fallbackOrOptions, onError: onErrorOrOptions };
  }

  return { fallback: fallbackOrOptions, ...onErrorOrOptions };
};

type QuietParseOverload = {
  /**
   * Parses JSON using an options object (`fallback` required).
   *
   * @typeParam T - Expected result type
   * @param jsonString - JSON text to parse, or nullish/empty to skip parsing
   * @param options - Parse options including `fallback`
   * @returns The parsed value as `T`, or `fallback`
   */
  <T>(jsonString: string | undefined | null, options: QuietParseOptions<T>): T;
  /**
   * Parses JSON with a positional `fallback` (and optional `onError` or extra options).
   *
   * @typeParam T - Expected result type
   * @param jsonString - JSON text to parse, or nullish/empty to skip parsing
   * @param fallback - Value returned for missing input, parse errors, or validation failure
   * @param onErrorOrOptions - Optional `onError` callback, or options with `validate` and `onError`
   * @returns The parsed value as `T`, or `fallback`
   */
  <T>(
    jsonString: string | undefined | null,
    fallback: T,
    onErrorOrOptions?: QuietParseOnError | QuietParseExtraOptions<T>,
  ): T;
};

/**
 * Parses a JSON string while omitting prototype-pollution-prone keys
 * (`__proto__`, `prototype`, and `constructor` only when it contains `prototype`).
 * Returns `fallback` when the input is nullish/empty, parsing fails, or `validate`
 * rejects the parsed value. Shape is checked at runtime only when `validate` is set.
 *
 * Prefer {@link QuietParseOptions} so the API can grow without new positional parameters.
 * The positional `(jsonString, fallback, onErrorOrOptions?)` form remains supported.
 */
export const quietParse: QuietParseOverload = <T>(
  jsonString: string | undefined | null,
  fallbackOrOptions: T | QuietParseOptions<T>,
  onErrorOrOptions?: QuietParseOnError | QuietParseExtraOptions<T>,
): T => {
  const { fallback, validate, onError } = toParseOptions(fallbackOrOptions, onErrorOrOptions);

  if (!jsonString) {
    return fallback;
  }

  let sanitized: unknown;
  try {
    const parsed: unknown = JSON.parse(jsonString);
    sanitized = omitUnsafeDeep(parsed);
  } catch (error) {
    onError?.(error);
    return fallback;
  }

  if (!validate) {
    // No runtime shape check: T is a compile-time contract only.
    return sanitized as T;
  }

  try {
    if (validate(sanitized)) {
      return sanitized as T;
    }
  } catch (error) {
    onError?.(error);
    return fallback;
  }

  // Shape mismatch is not an exception; report it through onError and use fallback.
  onError?.(new QuietJsonParserValidateError());
  return fallback;
};
