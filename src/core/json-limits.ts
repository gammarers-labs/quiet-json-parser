import {
  QuietJsonParserMaxBytesError,
  QuietJsonParserMaxDepthError,
  QuietJsonParserOptionsError,
} from './errors';

/**
 * Caller-supplied parse limits. Typed as `unknown` so a bad runtime value can be rejected.
 */
interface ParseLimits {
  readonly maxDepth?: unknown;
  readonly maxBytes?: unknown;
}

interface NestingScan {
  readonly inString: boolean;
  readonly escaped: boolean;
  readonly depth: number;
}

const IDLE_SCAN: NestingScan = {
  inString: false,
  escaped: false,
  depth: 0,
};

const INVALID_MAX_DEPTH = 'maxDepth must be a non-negative integer';
const INVALID_MAX_BYTES = 'maxBytes must be a non-negative integer';

type InvalidLimitField = 'maxDepth' | 'maxBytes';

const INVALID_LIMIT_REASON: Record<InvalidLimitField, string> = {
  maxDepth: INVALID_MAX_DEPTH,
  maxBytes: INVALID_MAX_BYTES,
};

/**
 * True when a limit is omitted or is a non-negative integer.
 *
 * @param value - Raw `maxDepth` or `maxBytes` option
 * @returns Whether the option may be enforced
 */
const isOptionalNonNegativeInteger = (value: unknown): boolean => {
  if (value === undefined) {
    return true;
  }
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
};

/**
 * Name only the limits that are present and invalid.
 * Callers pass one or more fields. An empty list is not used.
 *
 * @param fields - Invalid limit names, `maxDepth` before `maxBytes`
 * @returns Error message for {@link QuietJsonParserOptionsError}
 */
const invalidLimitsMessage = (fields: readonly InvalidLimitField[]): string => {
  const reasons = fields.map((field) => INVALID_LIMIT_REASON[field]);
  return `Invalid parse limits: ${reasons.join(', ')}.`;
};

/**
 * Reject limits that are present but not non-negative integers.
 * Omitted and valid limits return without throwing.
 *
 * @param limits - `maxDepth` and `maxBytes` from the caller
 * @throws {@link QuietJsonParserOptionsError} when a set limit is not a non-negative integer
 */
export const ensureParseLimitOptions = (limits: ParseLimits): void => {
  const fields: InvalidLimitField[] = [];
  if (!isOptionalNonNegativeInteger(limits.maxDepth)) {
    fields.push('maxDepth');
  }
  if (!isOptionalNonNegativeInteger(limits.maxBytes)) {
    fields.push('maxBytes');
  }

  // A bad limit is a caller bug. Swallowing it as a parse failure would hide a disabled guard.
  if (fields.length === 0) {
    return;
  }
  throw new QuietJsonParserOptionsError(invalidLimitsMessage(fields));
};

/**
 * Advance one character inside a JSON string. Escapes apply only here, so a quoted
 * `{` or `[` does not change depth.
 *
 * @param state - Scan position before this character
 * @param char - One Unicode code point from the JSON text
 * @returns The next scan position
 */
const stepStringChar = (state: NestingScan, char: string): NestingScan => {
  if (state.escaped) {
    return { inString: true, escaped: false, depth: state.depth };
  }
  if (char === '\\') {
    return { inString: true, escaped: true, depth: state.depth };
  }
  if (char === '"') {
    return { inString: false, escaped: false, depth: state.depth };
  }
  return state;
};

/**
 * Advance one character outside a JSON string. `{` and `[` each add one level of nesting.
 *
 * @param state - Scan position before this character
 * @param char - One Unicode code point from the JSON text
 * @returns The next scan position
 */
const stepValueChar = (state: NestingScan, char: string): NestingScan => {
  if (char === '"') {
    return { inString: true, escaped: false, depth: state.depth };
  }
  if (char === '{' || char === '[') {
    return { inString: false, escaped: false, depth: state.depth + 1 };
  }
  if (char === '}' || char === ']') {
    // A stray close brace is not valid JSON. Leave depth unchanged and let JSON.parse report it.
    if (state.depth === 0) {
      return state;
    }
    return { inString: false, escaped: false, depth: state.depth - 1 };
  }
  return state;
};

/**
 * Advance the nesting scan by one character.
 *
 * @param state - Scan position before this character
 * @param char - One Unicode code point from the JSON text
 * @returns The next scan position
 */
const stepNestingScan = (state: NestingScan, char: string): NestingScan => {
  if (state.inString) {
    return stepStringChar(state, char);
  }
  return stepValueChar(state, char);
};

/**
 * Throw when object and array nesting passes `maxDepth`.
 * Depth 0 is a primitive. `{}` and `[]` are depth 1. The walk stops at the first level past the limit.
 *
 * @param text - JSON text
 * @param maxDepth - Maximum allowed nesting
 * @throws {@link QuietJsonParserMaxDepthError} when nesting passes `maxDepth`
 */
const ensureMaxDepth = (text: string, maxDepth: number): void => {
  let state = IDLE_SCAN;
  for (const char of text) {
    state = stepNestingScan(state, char);
    if (state.depth > maxDepth) {
      throw new QuietJsonParserMaxDepthError(state.depth, maxDepth);
    }
  }
};

/**
 * Throw when JSON text is larger or more nested than the configured limits.
 * UTF-8 byte length is checked first, and is the size of the raw string rather than its UTF-16 length.
 *
 * @param text - JSON text that is about to be parsed
 * @param limits - Limits already accepted by {@link ensureParseLimitOptions}
 * @throws {@link QuietJsonParserMaxBytesError} when the UTF-8 size is above `maxBytes`
 * @throws {@link QuietJsonParserMaxDepthError} when nesting is above `maxDepth`
 */
export const ensureJsonWithinLimits = (text: string, limits: ParseLimits): void => {
  if (typeof limits.maxBytes === 'number') {
    const size = Buffer.byteLength(text, 'utf8');
    if (size > limits.maxBytes) {
      throw new QuietJsonParserMaxBytesError(size, limits.maxBytes);
    }
  }
  if (typeof limits.maxDepth === 'number') {
    ensureMaxDepth(text, limits.maxDepth);
  }
};
