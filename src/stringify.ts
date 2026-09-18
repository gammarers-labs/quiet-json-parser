import { omitUnsafeKey } from './core/omit-unsafe';

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
