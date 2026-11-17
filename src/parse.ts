import { QuietJsonParserValidateError } from './core/errors';
import { ensureJsonWithinLimits, ensureParseLimitOptions } from './core/json-limits';
import { omitUnsafeDeep } from './core/omit-unsafe';
import type { QuietJsonParserOnError } from './core/on-error';

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
 * `JSON.parse` reviver. `this` is the object that holds the property.
 * Return `undefined` to drop that property. The root call uses the key `""`.
 *
 * @param key - Property name, or `""` for the root value
 * @param value - Parsed property value, with nested values already revived
 * @returns The replacement value, or `undefined` to omit the property
 */
export type QuietParseReviver = (this: unknown, key: string, value: unknown) => unknown;

/**
 * Settings for `quietParse`. Prefer this object form so future options
 * (omit keys and similar) can be added without new positional args.
 *
 * @typeParam T - Expected result type
 */
export interface QuietParseOptions<T> {
  /**
   * Value returned for missing input, an over-limit payload, parse errors, or validation failure.
   */
  readonly fallback: T;
  /**
   * Maximum UTF-8 byte length of `jsonString`.
   * Checked before `JSON.parse`. Above this size, parsing is skipped,
   * `onError` receives {@link QuietJsonParserMaxBytesError}, and `fallback` is returned.
   * Omit for no size limit. Not applied to nullish or empty input.
   */
  readonly maxBytes?: number;
  /**
   * Maximum nesting of objects and arrays.
   * A primitive such as `1` has depth 0. `{}` and `{"a":1}` have depth 1.
   * `{"a":{"b":1}}` has depth 2. Braces inside strings do not count.
   * Checked before `JSON.parse`. Above this depth, parsing is skipped,
   * `onError` receives {@link QuietJsonParserMaxDepthError}, and `fallback` is returned.
   * The reported depth is the first level past the limit.
   * Omit for no depth limit. Not applied to nullish or empty input.
   */
  readonly maxDepth?: number;
  /**
   * Passed to `JSON.parse` before unsafe keys are removed.
   * The reviver may see `__proto__`, `prototype`, and an unsafe `constructor`.
   * `validate` receives the value after those keys are removed.
   * A throw is passed to `onError` and `fallback` is returned.
   */
  readonly reviver?: QuietParseReviver;
  /**
   * Runtime check run on the sanitized parse result.
   * On `false`, `onError` receives {@link QuietJsonParserValidateError} and `fallback` is returned.
   * If this function throws, the thrown value is passed to `onError`.
   * Not called when parsing is skipped or when `reviver` throws.
   */
  readonly validate?: QuietParseValidate<T>;
  /**
   * Called when a size or depth limit is exceeded, when `JSON.parse` or `reviver` throws, when `validate` throws,
   * or when `validate` returns `false`. Not called for nullish or empty input.
   * Not called when `maxDepth` or `maxBytes` is not a non-negative integer.
   * See {@link QuietJsonParserOnError}.
   */
  readonly onError?: QuietJsonParserOnError;
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
  onErrorOrOptions?: QuietJsonParserOnError | QuietParseExtraOptions<T>,
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
   * @throws {@link QuietJsonParserOptionsError} when `maxDepth` or `maxBytes` is not a non-negative integer
   */
  <T>(jsonString: string | undefined | null, options: QuietParseOptions<T>): T;
  /**
   * Parses JSON with a positional `fallback` (and optional `onError` or extra options).
   *
   * @typeParam T - Expected result type
   * @param jsonString - JSON text to parse, or nullish/empty to skip parsing
   * @param fallback - Value returned for missing input, an over-limit payload, parse errors, or validation failure
   * @param onErrorOrOptions - Optional `onError` callback, or options with `validate`, limits, `reviver`, and `onError`
   * @returns The parsed value as `T`, or `fallback`
   * @throws {@link QuietJsonParserOptionsError} when `maxDepth` or `maxBytes` is not a non-negative integer
   */
  <T>(
    jsonString: string | undefined | null,
    fallback: T,
    onErrorOrOptions?: QuietJsonParserOnError | QuietParseExtraOptions<T>,
  ): T;
};

/**
 * Parses a JSON string while omitting prototype-pollution-prone keys
 * (`__proto__`, `prototype`, and `constructor` only when it contains `prototype`).
 * Returns `fallback` when the input is nullish/empty, a size or depth limit is exceeded,
 * parsing fails, or `validate` rejects the parsed value. `maxBytes` and `maxDepth`, when set,
 * are enforced before `JSON.parse`. An optional `reviver` is passed to `JSON.parse`, and unsafe keys
 * are removed from its result before `validate`. Shape is checked at runtime only when `validate` is set.
 *
 * Prefer {@link QuietParseOptions} so the API can grow without new positional parameters.
 * The positional `(jsonString, fallback, onErrorOrOptions?)` form remains supported.
 *
 * @throws {@link QuietJsonParserOptionsError} when `maxDepth` or `maxBytes` is not a non-negative integer
 */
export const quietParse: QuietParseOverload = <T>(
  jsonString: string | undefined | null,
  fallbackOrOptions: T | QuietParseOptions<T>,
  onErrorOrOptions?: QuietJsonParserOnError | QuietParseExtraOptions<T>,
): T => {
  const { fallback, validate, onError, maxDepth, maxBytes, reviver } = toParseOptions(
    fallbackOrOptions,
    onErrorOrOptions,
  );
  ensureParseLimitOptions({ maxDepth, maxBytes });

  if (!jsonString) {
    return fallback;
  }

  let sanitized: unknown;
  try {
    // Size and depth are enforced before parse so an over-limit payload is never parsed.
    ensureJsonWithinLimits(jsonString, { maxDepth, maxBytes });
    // Revive during parse, then drop unsafe keys so `validate` does not see them.
    const parsed: unknown = JSON.parse(jsonString, reviver);
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
