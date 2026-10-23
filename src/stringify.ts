import { omitUnsafeKey } from './core/omit-unsafe';

/**
 * Callback invoked when stringification throws.
 *
 * @param error - The caught error from `JSON.stringify`
 */
export type QuietStringifyOnError = (error: unknown) => void;

/**
 * Settings for `quietStringify`. Prefer this object form so future options
 * (`space`, custom replacer hooks, omit keys, and similar) can be added without
 * new positional args.
 */
export interface QuietStringifyOptions {
  /**
   * Value returned when serialization throws or yields a non-string.
   */
  readonly fallback: string;
  /**
   * Called with the caught error when `JSON.stringify` throws.
   * Not called when the result is not a string.
   */
  readonly onError?: QuietStringifyOnError;
}

/**
 * Resolve positional or options-object arguments into {@link QuietStringifyOptions}.
 *
 * @param fallbackOrOptions - Fallback string, or a full options object
 * @param onError - Legacy `onError` callback used with a positional fallback
 * @returns Normalized options including `fallback`
 */
const toStringifyOptions = (
  fallbackOrOptions: string | QuietStringifyOptions,
  onError?: QuietStringifyOnError,
): QuietStringifyOptions => {
  if (typeof fallbackOrOptions === 'string') {
    return { fallback: fallbackOrOptions, onError };
  }
  return fallbackOrOptions;
};

type QuietStringifyOverload = {
  /**
   * Stringifies a value using an options object (`fallback` required).
   *
   * @param value - Value to serialize
   * @param options - Stringify options including `fallback`
   * @returns The JSON string, or `fallback`
   */
  (value: unknown, options: QuietStringifyOptions): string;
  /**
   * Stringifies a value with a positional `fallback` (and optional `onError`).
   *
   * @param value - Value to serialize
   * @param fallback - Value returned when serialization fails or yields a non-string
   * @param onError - Optional callback invoked with the caught error on stringify failure
   * @returns The JSON string, or `fallback`
   */
  (value: unknown, fallback: string, onError?: QuietStringifyOnError): string;
};

/**
 * Stringifies a value while omitting prototype-pollution-prone keys
 * (`__proto__`, `prototype`, and `constructor` only when it contains `prototype`).
 * Returns `fallback` when the value cannot be serialized (circular refs, BigInt,
 * throwing `toJSON`, or a result that is not a string such as `undefined`).
 *
 * Prefer {@link QuietStringifyOptions} so the API can grow without new positional parameters.
 * The positional `(value, fallback, onError?)` form remains supported.
 */
export const quietStringify: QuietStringifyOverload = (
  value: unknown,
  fallbackOrOptions: string | QuietStringifyOptions,
  onError?: QuietStringifyOnError,
): string => {
  const { fallback, onError: reportError } = toStringifyOptions(fallbackOrOptions, onError);

  try {
    const json: unknown = JSON.stringify(value, omitUnsafeKey);
    if (typeof json !== 'string') {
      return fallback;
    }
    return json;
  } catch (error) {
    reportError?.(error);
    return fallback;
  }
};
