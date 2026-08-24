/**
 * JSON.parse reviver / JSON.stringify replacer that drops keys commonly used
 * for prototype pollution. Omits `__proto__`, `constructor`, and `prototype`
 * (including nested ones).
 *
 * @param key - Property name visited by JSON.parse or JSON.stringify
 * @param value - Property value visited by JSON.parse or JSON.stringify
 * @returns The original value, or `undefined` to omit the property
 */
const omitUnsafeKey = (key: string, value: unknown) => {
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    return undefined;
  }
  return value;
};

/**
 * Parses a JSON string while omitting prototype-pollution-prone keys.
 * Returns `fallback` when the input is nullish/empty or parsing fails.
 * Does not validate that the parsed value matches `T` at runtime.
 *
 * @typeParam T - Expected result type (compile-time only; not checked at runtime)
 * @param jsonString - JSON text to parse, or nullish/empty to skip parsing
 * @param fallback - Value returned for missing input or parse errors
 * @param onError - Optional callback invoked with the caught error on parse failure
 * @returns The parsed value cast to `T`, or `fallback`
 */
export const quietParse = <T>(
  jsonString: string | undefined | null,
  fallback: T,
  onError?: (error: unknown) => void,
): T => {
  if (!jsonString) {
    return fallback;
  }
  try {
    return JSON.parse(jsonString, omitUnsafeKey) as T;
  } catch (error) {
    onError?.(error);
    return fallback;
  }
};

/**
 * Stringifies a value while omitting prototype-pollution-prone keys.
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
