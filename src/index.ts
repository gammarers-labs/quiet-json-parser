/**
 * JSON.parse reviver that drops keys commonly used for prototype pollution.
 * Omits `__proto__`, `constructor`, and `prototype` (including nested ones).
 *
 * @param key - Property name visited by JSON.parse
 * @param value - Property value visited by JSON.parse
 * @returns The original value, or `undefined` to omit the property
 */
const safeReviver = (key: string, value: unknown) => {
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
    return JSON.parse(jsonString, safeReviver) as T;
  } catch (error) {
    onError?.(error);
    return fallback;
  }
};
