import {
  QuietJsonParserMaxBytesError,
  QuietJsonParserMaxDepthError,
  QuietJsonParserOptionsError,
} from '../src/core/errors';
import { ensureJsonWithinLimits, ensureParseLimitOptions } from '../src/core/json-limits';

const DEPTH_MESSAGE = 'maxDepth must be a non-negative integer';
const BYTES_MESSAGE = 'maxBytes must be a non-negative integer';

describe('ensureParseLimitOptions', () => {
  it.each([
    ['no limits', {}],
    ['zero', { maxDepth: 0, maxBytes: 0 }],
    ['positive integers', { maxDepth: 20, maxBytes: 1024 }],
  ])('should accept %s', (_label, limits) => {
    expect(() => ensureParseLimitOptions(limits)).not.toThrow();
  });

  it.each([
    ['a fractional maxDepth', { maxDepth: 1.5 }, `Invalid parse limits: ${DEPTH_MESSAGE}.`],
    ['a negative maxDepth', { maxDepth: -1 }, `Invalid parse limits: ${DEPTH_MESSAGE}.`],
    ['an infinite maxDepth', { maxDepth: Number.POSITIVE_INFINITY }, `Invalid parse limits: ${DEPTH_MESSAGE}.`],
    ['NaN maxDepth', { maxDepth: Number.NaN }, `Invalid parse limits: ${DEPTH_MESSAGE}.`],
    ['a string maxDepth', { maxDepth: '1' }, `Invalid parse limits: ${DEPTH_MESSAGE}.`],
    ['a fractional maxBytes', { maxBytes: 1.5 }, `Invalid parse limits: ${BYTES_MESSAGE}.`],
    ['a negative maxBytes', { maxBytes: -1 }, `Invalid parse limits: ${BYTES_MESSAGE}.`],
    ['both invalid', { maxDepth: -1, maxBytes: Number.NaN }, `Invalid parse limits: ${DEPTH_MESSAGE}, ${BYTES_MESSAGE}.`],
  ])('should reject %s', (_label, limits, message) => {
    expect(() => ensureParseLimitOptions(limits)).toThrow(QuietJsonParserOptionsError);
    expect(() => ensureParseLimitOptions(limits)).toThrow(message);
  });
});

describe('ensureJsonWithinLimits', () => {
  it('should allow any text when limits are omitted', () => {
    expect(() => ensureJsonWithinLimits('[[[1]]]', {})).not.toThrow();
  });

  it.each([
    ['a primitive', '1', 0],
    ['null', 'null', 0],
    ['a string containing braces', '"{\\"a\\":1}"', 0],
    ['a stray closing brace', '}', 0],
    ['an empty object', '{}', 1],
    ['an empty array', '[]', 1],
    ['braces inside an escaped quote', '{"a":"\\"{"}', 1],
    ['an extra closing brace', '{}}', 1],
    ['a nested object', '{"a":{"b":1}}', 2],
    ['a nested array', '[[1]]', 2],
    ['a leading close brace then an object', '}{', 1],
  ] as Array<[string, string, number]>)(
    'should treat %s as depth %i',
    (_label, text, depth) => {
      expect(() => ensureJsonWithinLimits(text, { maxDepth: depth })).not.toThrow();
      if (depth === 0) {
        return;
      }
      expect(() => ensureJsonWithinLimits(text, { maxDepth: depth - 1 })).toThrow(
        new QuietJsonParserMaxDepthError(depth, depth - 1),
      );
    },
  );

  it('should stop at the first depth past the limit', () => {
    expect(() => ensureJsonWithinLimits('[[[1]]]', { maxDepth: 1 })).toThrow(
      new QuietJsonParserMaxDepthError(2, 1),
    );
  });

  it.each([
    ['ascii', '{}'],
    ['hiragana', '{"a":"あ"}'],
    ['an emoji', '😀'],
  ])('should use utf-8 byte length for %s', (_label, text) => {
    const size = Buffer.byteLength(text, 'utf8');

    expect(() => ensureJsonWithinLimits(text, { maxBytes: size })).not.toThrow();
    expect(() => ensureJsonWithinLimits(text, { maxBytes: size - 1 })).toThrow(
      new QuietJsonParserMaxBytesError(size, size - 1),
    );
  });

  it('should report maxBytes when both limits are exceeded', () => {
    expect(() => ensureJsonWithinLimits('{"a":{"b":1}}', { maxBytes: 1, maxDepth: 0 })).toThrow(
      QuietJsonParserMaxBytesError,
    );
  });

  it('should apply maxDepth when the text is within maxBytes', () => {
    const text = '{"a":{"b":1}}';
    const size = Buffer.byteLength(text, 'utf8');

    expect(() => ensureJsonWithinLimits(text, { maxBytes: size, maxDepth: 1 })).toThrow(
      new QuietJsonParserMaxDepthError(2, 1),
    );
  });
});
