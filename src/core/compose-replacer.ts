import { omitUnsafeKey, shouldOmitKey } from './omit-unsafe';

/**
 * `JSON.stringify` replacer function. `this` is the object that holds the property.
 *
 * @param key - Property name, or `""` for the root value
 * @param value - Property value after `toJSON`, when present
 * @returns The value to serialize, or `undefined` to omit the property
 */
export type QuietStringifyReplacerFn = (
  this: unknown,
  key: string,
  value: unknown,
) => unknown;

/**
 * Value for `QuietStringifyOptions.replacer`.
 * A function matches `JSON.stringify`. An array lists object keys to keep.
 */
export type QuietStringifyReplacer =
  | QuietStringifyReplacerFn
  | readonly (string | number)[];

/**
 * String or number entries become allow-list keys. Other entries are ignored, as in `JSON.stringify`.
 *
 * @param item - One element of an array replacer
 * @returns The property name to keep, or `undefined` when the element is not a string or number
 */
const allowListKey = (item: unknown): string | undefined => {
  if (typeof item === 'string' || item instanceof String) {
    return String(item);
  }
  if (typeof item === 'number' || item instanceof Number) {
    return String(item);
  }
  return undefined;
};

/**
 * Property names selected by an array replacer.
 *
 * @param items - Array replacer entries
 * @returns Keys that may be serialized on plain objects
 */
const allowListFrom = (items: readonly unknown[]): ReadonlySet<string> => {
  const allow = new Set<string>();
  for (const item of items) {
    const key = allowListKey(item);
    if (key === undefined) {
      continue;
    }
    allow.add(key);
  }
  return allow;
};

/**
 * True when an array replacer still serializes this property.
 * The root holder and array elements are kept. Other object keys must be listed.
 *
 * @param holder - `this` value from `JSON.stringify`
 * @param key - Property name
 * @param rootHolder - Holder from the first replacer call, which is the root
 * @param allow - Keys listed by the caller
 * @returns Whether the property is included
 */
const keepsListedProperty = (
  holder: unknown,
  key: string,
  rootHolder: unknown,
  allow: ReadonlySet<string>,
): boolean => {
  if (holder === rootHolder) {
    return true;
  }
  if (Array.isArray(holder)) {
    return true;
  }
  return allow.has(key);
};

/**
 * Array replacer that still drops unsafe keys.
 * The first call is the root. Each composed function is used for one `JSON.stringify` call.
 *
 * @param allow - Object keys to keep
 * @returns A replacer function
 */
const allowListReplacer = (allow: ReadonlySet<string>): QuietStringifyReplacerFn => {
  let rootHolder: unknown;
  let hasRootHolder = false;

  // `JSON.stringify` binds `this` to the holder. An arrow function would drop that binding.
  return function (this: unknown, key: string, value: unknown): unknown {
    if (!hasRootHolder) {
      hasRootHolder = true;
      rootHolder = this;
    }
    if (shouldOmitKey(key, value)) {
      return undefined;
    }
    if (keepsListedProperty(this, key, rootHolder, allow)) {
      return value;
    }
    return undefined;
  };
};

/**
 * Replacer that drops unsafe keys before applying the caller's replacer.
 * Unsafe keys are removed first, so a user function or allow-list cannot keep them.
 * With no user replacer, this is {@link omitUnsafeKey}.
 *
 * @param replacer - Caller replacer, or `undefined` to only drop unsafe keys
 * @returns Replacer to pass to `JSON.stringify`
 */
export const composeReplacer = (
  replacer: QuietStringifyReplacer | undefined,
): QuietStringifyReplacerFn => {
  if (typeof replacer === 'function') {
    // `JSON.stringify` binds `this` to the holder. An arrow function would drop that binding.
    return function (this: unknown, key: string, value: unknown): unknown {
      if (shouldOmitKey(key, value)) {
        return undefined;
      }
      return replacer.call(this, key, value);
    };
  }
  if (Array.isArray(replacer)) {
    return allowListReplacer(allowListFrom(replacer));
  }
  return omitUnsafeKey;
};
