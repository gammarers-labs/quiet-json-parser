const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    const parsed: unknown = JSON.parse(jsonString);
    return omitUnsafeDeep(parsed) as T;
  } catch (error) {
    onError?.(error);
    return fallback;
  }
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
