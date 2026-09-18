import { QuietJsonParserValidateError } from './errors';

export { QuietJsonParserError, QuietJsonParserValidateError } from './errors';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

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
  if (onErrorOrOptions === undefined) {
    return {};
  }
  return onErrorOrOptions;
};

/**
 * True when a `constructor` value is the dangerous `{ prototype: ... }` shape.
 *
 * @param value - Candidate `constructor` property value
 * @returns Whether the value is a plain object with an own `prototype` key
 */
const isUnsafeConstructorValue = (value: unknown): boolean => {
  if (!isPlainObject(value)) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(value, 'prototype');
};

/**
 * Whether a property should be omitted to avoid prototype pollution.
 *
 * @param key - Property name
 * @param value - Property value (used to detect `constructor.prototype`)
 * @returns `true` when the property should be dropped
 */
const shouldOmitKey = (key: string, value: unknown): boolean => {
  if (key === '__proto__' || key === 'prototype') {
    return true;
  }
  if (key !== 'constructor') {
    return false;
  }
  return isUnsafeConstructorValue(value);
};

/**
 * JSON.stringify replacer that drops prototype-pollution-prone keys.
 *
 * @param key - Property name visited by JSON.stringify
 * @param value - Property value visited by JSON.stringify
 * @returns The original value, or `undefined` to omit the property
 */
const omitUnsafeKey = (key: string, value: unknown) => {
  if (shouldOmitKey(key, value)) {
    return undefined;
  }
  return value;
};

/**
 * Drops prototype-pollution-prone keys from a parsed JSON value.
 * Inspects each object before recursing so `constructor.prototype` is still
 * visible (JSON.parse revivers run inside-out and would strip `prototype` first).
 *
 * @param value - Parsed JSON value
 * @returns A copy with unsafe keys omitted
 */
const omitUnsafeDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(omitUnsafeDeep);
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const nested = value[key];
    if (shouldOmitKey(key, nested)) {
      continue;
    }
    result[key] = omitUnsafeDeep(nested);
  }
  return result;
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

  onError?.(new QuietJsonParserValidateError());
  return fallback;
};

/**
 * Stringifies a value while omitting prototype-pollution-prone keys
 * (`__proto__`, `prototype`, and `constructor` only when it contains `prototype`).
 * Returns `fallback` when the value cannot be serialized (circular refs, BigInt,
 * throwing `toJSON`, or a result that is not a string such as `undefined`).
 *
 * @param value - Value to serialize
 * @param fallback - Value returned when serialization fails or yields a non-string
 * @param onError - Optional callback invoked with the caught error on stringify failure
 * @returns The JSON string, or `fallback`
 */
export const quietStringify = (
  value: unknown,
  fallback: string,
  onError?: (error: unknown) => void,
): string => {
  try {
    const json: unknown = JSON.stringify(value, omitUnsafeKey);
    if (typeof json !== 'string') {
      return fallback;
    }
    return json;
  } catch (error) {
    onError?.(error);
    return fallback;
  }
};
