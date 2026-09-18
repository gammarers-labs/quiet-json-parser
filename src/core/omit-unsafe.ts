// JSON keys used in prototype-pollution payloads. Dropped during parse/stringify.
const PROTO_KEY = '__proto__';
const PROTOTYPE_KEY = 'prototype';
const CONSTRUCTOR_KEY = 'constructor';

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
  return Object.prototype.hasOwnProperty.call(value, PROTOTYPE_KEY);
};

/**
 * Whether a property should be omitted to avoid prototype pollution.
 *
 * @param key - Property name
 * @param value - Property value (used to detect `constructor.prototype`)
 * @returns `true` when the property should be dropped
 */
const shouldOmitKey = (key: string, value: unknown): boolean => {
  if (key === PROTO_KEY || key === PROTOTYPE_KEY) {
    return true;
  }
  if (key !== CONSTRUCTOR_KEY) {
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
export const omitUnsafeKey = (key: string, value: unknown): unknown => {
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
export const omitUnsafeDeep = (value: unknown): unknown => {
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
