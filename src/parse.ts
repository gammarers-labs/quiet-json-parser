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
 * Optional settings for `quietParse`.
 *
 * @typeParam T - Expected result type
 */
export interface QuietParseOptions<T> {
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
 * Normalize the third `quietParse` argument: a callback stays `onError`,
 * an object is treated as options.
 *
 * @typeParam T - Expected result type
 * @param onErrorOrOptions - Legacy `onError` callback or an options object
 * @returns Options with `validate` and `onError` resolved
 */
const toParseOptions = <T>(
  onErrorOrOptions?: QuietParseOnError | QuietParseOptions<T>,
): QuietParseOptions<T> => {
  if (typeof onErrorOrOptions === 'function') {
    return { onError: onErrorOrOptions };
  }
  return onErrorOrOptions ?? {};
};

/**
 * Parses a JSON string while omitting prototype-pollution-prone keys
 * (`__proto__`, `prototype`, and `constructor` only when it contains `prototype`).
 * Returns `fallback` when the input is nullish/empty, parsing fails, or `validate`
 * rejects the parsed value. Shape is checked at runtime only when `validate` is set.
 *
 * @typeParam T - Expected result type (runtime-checked only when `validate` is set)
 * @param jsonString - JSON text to parse, or nullish/empty to skip parsing
 * @param fallback - Value returned for missing input, parse errors, or validation failure
 * @param onErrorOrOptions - Optional `onError` callback, or options with `validate` and `onError`
 * @returns The parsed value as `T`, or `fallback`
 */
export const quietParse = <T>(
  jsonString: string | undefined | null,
  fallback: T,
  onErrorOrOptions?: QuietParseOnError | QuietParseOptions<T>,
): T => {
  const { validate, onError } = toParseOptions(onErrorOrOptions);

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
