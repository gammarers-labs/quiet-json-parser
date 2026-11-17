import { composeReplacer, type QuietStringifyReplacer } from './core/compose-replacer';
import type { QuietJsonParserOnError } from './core/on-error';

export type { QuietStringifyReplacer };

/**
 * Settings for `quietStringify`. Prefer this object form so future options
 * (omit keys and similar) can be added without new positional args.
 */
export interface QuietStringifyOptions {
  /**
   * Value returned when serialization throws or yields a non-string.
   */
  readonly fallback: string;
  /**
   * Indent passed through to `JSON.stringify`.
   * A number is that many spaces. A string is the indent text. `JSON.stringify` keeps at most 10 characters.
   * Omit for a single line.
   */
  readonly space?: number | string;
  /**
   * Called after unsafe keys are dropped.
   * A function matches `JSON.stringify`: `this` is the holder, and `toJSON` runs first,
   * so a `Date` is already an ISO string. A `BigInt` can be converted here.
   * An array lists object keys to keep. Array elements are still serialized.
   * Unsafe keys are dropped even when the function returns them or the array lists them.
   * Object key order stays the object's own order.
   */
  readonly replacer?: QuietStringifyReplacer;
  /**
   * Called with the caught error when `JSON.stringify` throws, including a throwing `replacer` or `toJSON`.
   * Not called when the result is not a string.
   * See {@link QuietJsonParserOnError}.
   */
  readonly onError?: QuietJsonParserOnError;
}

/**
 * Options for the positional third argument (without `fallback`).
 */
export type QuietStringifyExtraOptions = Omit<QuietStringifyOptions, 'fallback'>;

/**
 * Resolve positional or options-object arguments into {@link QuietStringifyOptions}.
 *
 * @param fallbackOrOptions - Fallback string, or a full options object
 * @param onErrorOrOptions - Legacy `onError` callback, or extra options without `fallback`
 * @returns Normalized options including `fallback`
 */
const toStringifyOptions = (
  fallbackOrOptions: string | QuietStringifyOptions,
  onErrorOrOptions?: QuietJsonParserOnError | QuietStringifyExtraOptions,
): QuietStringifyOptions => {
  if (typeof fallbackOrOptions !== 'string') {
    return fallbackOrOptions;
  }
  if (typeof onErrorOrOptions === 'function') {
    return { fallback: fallbackOrOptions, onError: onErrorOrOptions };
  }
  return { fallback: fallbackOrOptions, ...onErrorOrOptions };
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
   * Stringifies a value with a positional `fallback` (and optional `onError` or extra options).
   *
   * @param value - Value to serialize
   * @param fallback - Value returned when serialization fails or yields a non-string
   * @param onErrorOrOptions - Optional `onError` callback, or options with `space`, `replacer`, and `onError`
   * @returns The JSON string, or `fallback`
   */
  (
    value: unknown,
    fallback: string,
    onErrorOrOptions?: QuietJsonParserOnError | QuietStringifyExtraOptions,
  ): string;
};

/**
 * Stringifies a value while omitting prototype-pollution-prone keys
 * (`__proto__`, `prototype`, and `constructor` only when it contains `prototype`).
 * `space` and `replacer` are applied with `JSON.stringify` after those keys are dropped.
 * Returns `fallback` when the value cannot be serialized (circular refs, BigInt,
 * throwing `toJSON`, a throwing `replacer`, or a result that is not a string such as `undefined`).
 *
 * Prefer {@link QuietStringifyOptions} so the API can grow without new positional parameters.
 * The positional `(value, fallback, onErrorOrOptions?)` form remains supported.
 */
export const quietStringify: QuietStringifyOverload = (
  value: unknown,
  fallbackOrOptions: string | QuietStringifyOptions,
  onErrorOrOptions?: QuietJsonParserOnError | QuietStringifyExtraOptions,
): string => {
  const { fallback, onError: reportError, space, replacer } = toStringifyOptions(
    fallbackOrOptions,
    onErrorOrOptions,
  );

  try {
    const json: unknown = JSON.stringify(value, composeReplacer(replacer), space);
    if (typeof json !== 'string') {
      return fallback;
    }
    return json;
  } catch (error) {
    reportError?.(error);
    return fallback;
  }
};
