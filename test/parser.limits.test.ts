import {
  QuietJsonParserError,
  QuietJsonParserMaxBytesError,
  QuietJsonParserMaxDepthError,
  QuietJsonParserOptionsError,
  quietParse,
} from '../src';

const DEPTH_MESSAGE = 'maxDepth must be a non-negative integer';
const BYTES_MESSAGE = 'maxBytes must be a non-negative integer';

describe('quietParse limits', () => {
  it('should parse when the text is within maxBytes and maxDepth', () => {
    const json = '{"name":"ada","__proto__":{"polluted":true}}';
    const validate = jest.fn((value: unknown): boolean => typeof value === 'object');

    expect(quietParse(json, {
      fallback: null,
      maxBytes: Buffer.byteLength(json, 'utf8'),
      maxDepth: 3,
      validate,
    })).toEqual({ name: 'ada' });
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.calls[0][0]).toEqual({ name: 'ada' });
  });

  it('should measure maxBytes in utf-8 bytes', () => {
    const json = '{"a":"あ"}';
    const size = Buffer.byteLength(json, 'utf8');
    const onError = jest.fn();

    expect(size).toBeGreaterThan(json.length);
    expect(quietParse(json, { fallback: null, maxBytes: size })).toEqual({ a: 'あ' });
    expect(quietParse(json, { fallback: null, maxBytes: size - 1, onError })).toBeNull();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(QuietJsonParserMaxBytesError);
    expect(onError.mock.calls[0][0].message).toBe(
      `JSON input exceeds maxBytes: size is ${size}, expected at most ${size - 1}.`,
    );
  });

  it('should not call JSON.parse or validate when maxDepth is exceeded', () => {
    const parse = jest.spyOn(JSON, 'parse');
    const validate = jest.fn();
    const onError = jest.fn();

    try {
      expect(quietParse('{"a":{"b":1}}', {
        fallback: { ok: false },
        maxDepth: 1,
        validate,
        onError,
      })).toEqual({ ok: false });
      expect(parse).not.toHaveBeenCalled();
      expect(validate).not.toHaveBeenCalled();

      const error = onError.mock.calls[0][0];
      expect(error).toBeInstanceOf(QuietJsonParserMaxDepthError);
      expect(error).toBeInstanceOf(QuietJsonParserError);
      expect(error.message).toBe('JSON input exceeds maxDepth: depth is 2, expected at most 1.');
    } finally {
      parse.mockRestore();
    }
  });

  it('should report maxBytes and skip JSON.parse when both limits are exceeded', () => {
    const parse = jest.spyOn(JSON, 'parse');
    const onError = jest.fn();

    try {
      expect(quietParse('{"a":{"b":1}}', {
        fallback: null,
        maxBytes: 1,
        maxDepth: 0,
        onError,
      })).toBeNull();
      expect(parse).not.toHaveBeenCalled();
      expect(onError.mock.calls[0][0]).toBeInstanceOf(QuietJsonParserMaxBytesError);
    } finally {
      parse.mockRestore();
    }
  });

  it('should report maxDepth for deeply nested text that is also invalid', () => {
    const onError = jest.fn();

    expect(quietParse('[[[', { fallback: null, maxDepth: 1, onError })).toBeNull();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(QuietJsonParserMaxDepthError);
    expect(onError.mock.calls[0][0].message).toBe(
      'JSON input exceeds maxDepth: depth is 2, expected at most 1.',
    );
  });

  it('should return SyntaxError when the text is within limits but invalid', () => {
    const onError = jest.fn();

    expect(quietParse('{', {
      fallback: null,
      maxBytes: 100,
      maxDepth: 5,
      onError,
    })).toBeNull();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(SyntaxError);
  });

  it('should return fallback for empty input without calling onError', () => {
    const onError = jest.fn();
    const fallback = { ok: true };

    expect(quietParse('', {
      fallback,
      maxBytes: 0,
      maxDepth: 0,
      onError,
    })).toBe(fallback);
    expect(onError).not.toHaveBeenCalled();
  });

  it('should accept limits on the positional extra options', () => {
    const onError = jest.fn();

    expect(quietParse('{"a":1}', null, { maxDepth: 1, maxBytes: 100, onError })).toEqual({ a: 1 });
    expect(quietParse('{"a":{"b":1}}', null, { maxDepth: 1, onError })).toBeNull();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(QuietJsonParserMaxDepthError);
  });

  it.each([
    [{ maxDepth: -1 }, `Invalid parse limits: ${DEPTH_MESSAGE}.`],
    [{ maxBytes: 1.5 }, `Invalid parse limits: ${BYTES_MESSAGE}.`],
    [
      { maxDepth: -1, maxBytes: Number.NaN },
      `Invalid parse limits: ${DEPTH_MESSAGE}, ${BYTES_MESSAGE}.`,
    ],
  ])('should throw QuietJsonParserOptionsError for %j', (limits, message) => {
    const onError = jest.fn();

    expect(() => quietParse('{}', { fallback: null, ...limits, onError })).toThrow(
      QuietJsonParserOptionsError,
    );
    expect(() => quietParse('', { fallback: null, ...limits, onError })).toThrow(message);
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('parse limit errors', () => {
  it('should describe a byte overflow', () => {
    const error = new QuietJsonParserMaxBytesError(11, 10);

    expect(error).toBeInstanceOf(QuietJsonParserMaxBytesError);
    expect(error).toBeInstanceOf(QuietJsonParserError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('QuietJsonParserMaxBytesError');
    expect(error.message).toBe('JSON input exceeds maxBytes: size is 11, expected at most 10.');
  });

  it('should describe a depth overflow', () => {
    const error = new QuietJsonParserMaxDepthError(4, 3);

    expect(error).toBeInstanceOf(QuietJsonParserMaxDepthError);
    expect(error).toBeInstanceOf(QuietJsonParserError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('QuietJsonParserMaxDepthError');
    expect(error.message).toBe('JSON input exceeds maxDepth: depth is 4, expected at most 3.');
  });

  it('should describe invalid limit options', () => {
    const message = `Invalid parse limits: ${DEPTH_MESSAGE}.`;
    const error = new QuietJsonParserOptionsError(message);

    expect(error).toBeInstanceOf(QuietJsonParserOptionsError);
    expect(error).toBeInstanceOf(QuietJsonParserError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('QuietJsonParserOptionsError');
    expect(error.message).toBe(message);
  });
});
