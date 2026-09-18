import {
  QuietJsonParserError,
  QuietJsonParserValidateError,
  quietParse,
  quietStringify,
} from '../src';

interface Config {
  name: string;
  enabled: boolean;
}

const configFallback: Config = { name: 'default', enabled: false };

const isConfig = (value: unknown): value is Config => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  if (!('name' in value) || !('enabled' in value)) {
    return false;
  }
  return typeof value.name === 'string' && typeof value.enabled === 'boolean';
};

describe('quietParse', () => {
  it('should parse valid JSON', () => {
    expect(quietParse('{"name":"ada","n":1}', null)).toEqual({
      name: 'ada',
      n: 1,
    });
  });

  it.each([null, undefined, ''] as const)(
    'should return fallback when input is %p',
    (input) => {
      const fallback = { ok: true };
      expect(quietParse(input, fallback)).toBe(fallback);
    },
  );

  it('should return fallback and call onError when JSON is invalid', () => {
    const fallback = { ok: false };
    const onError = jest.fn();

    expect(quietParse('{', fallback, onError)).toBe(fallback);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(SyntaxError);
  });

  it('should not call onError for nullish or empty input', () => {
    const onError = jest.fn();

    quietParse(undefined, null, onError);
    quietParse(null, null, onError);
    quietParse('', null, onError);

    expect(onError).not.toHaveBeenCalled();
  });

  it('should omit __proto__, prototype, and constructor.prototype only', () => {
    const json = [
      '{',
      '"keep":true,',
      '"__proto__":{"polluted":true},',
      '"constructor":"Engineer",',
      '"prototype":{"x":1},',
      '"nested":{',
      '"keep":true,',
      '"__proto__":{"polluted":true},',
      '"constructor":{"prototype":{"y":2},"name":"x"},',
      '"role":{"constructor":{"title":"Engineer"}}',
      '}',
      '}',
    ].join('');

    expect(quietParse(json, null)).toEqual({
      keep: true,
      constructor: 'Engineer',
      nested: {
        keep: true,
        role: {
          constructor: { title: 'Engineer' },
        },
      },
    });
  });

  it('should not pollute Object.prototype', () => {
    const marker = `__quiet_parse_${Date.now()}`;
    quietParse(`{"__proto__":{"${marker}":true}}`, null);

    expect(
      Object.prototype.hasOwnProperty.call(Object.prototype, marker),
    ).toBe(false);
    expect(({} as Record<string, unknown>)[marker]).toBeUndefined();
  });

  it('should omit constructor.prototype without leaving an empty constructor', () => {
    expect(
      quietParse('{"constructor":{"prototype":{"y":2}}}', null),
    ).toEqual({});
  });

  it('should keep constructor values that are not objects with prototype', () => {
    expect(quietParse('{"constructor":null}', null)).toEqual({
      constructor: null,
    });
    expect(quietParse('{"constructor":["Engineer"]}', null)).toEqual({
      constructor: ['Engineer'],
    });
    expect(quietParse('{"constructor":{}}', null)).toEqual({
      constructor: {},
    });
  });

  it('should return the parsed value when validate succeeds', () => {
    const onError = jest.fn();

    expect(
      quietParse('{"name":"ada","enabled":true}', configFallback, {
        validate: isConfig,
        onError,
      }),
    ).toEqual({ name: 'ada', enabled: true });
    expect(onError).not.toHaveBeenCalled();
  });

  it('should return fallback and call onError when validate fails', () => {
    const onError = jest.fn();

    expect(
      quietParse('{"name":"ada"}', configFallback, {
        validate: isConfig,
        onError,
      }),
    ).toBe(configFallback);
    expect(onError).toHaveBeenCalledTimes(1);

    const error = onError.mock.calls[0][0];
    expect(error).toBeInstanceOf(QuietJsonParserValidateError);
    expect(error).toBeInstanceOf(QuietJsonParserError);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toHaveProperty('value');
  });

  it('should return fallback and call onError when validate throws', () => {
    const thrown = new Error('validate failed');
    const onError = jest.fn();

    expect(
      quietParse('{"name":"ada"}', configFallback, {
        validate: () => {
          throw thrown;
        },
        onError,
      }),
    ).toBe(configFallback);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe(thrown);
  });

  it('should accept onError inside options for parse errors', () => {
    const onError = jest.fn();

    expect(quietParse('{', configFallback, { onError })).toBe(configFallback);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(SyntaxError);
  });

  it('should not call validate for nullish or empty input', () => {
    const validate = jest.fn();

    quietParse(undefined, configFallback, { validate });
    quietParse(null, configFallback, { validate });
    quietParse('', configFallback, { validate });

    expect(validate).not.toHaveBeenCalled();
  });

  it('should not call validate when JSON.parse throws', () => {
    const validate = jest.fn();
    const onError = jest.fn();

    expect(quietParse('{', configFallback, { validate, onError })).toBe(
      configFallback,
    );
    expect(validate).not.toHaveBeenCalled();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(SyntaxError);
  });

  it('should validate after omitting unsafe keys', () => {
    const validate = jest.fn(isConfig);
    const json = '{"name":"ada","enabled":true,"constructor":{"prototype":{}}}';

    expect(quietParse(json, configFallback, { validate })).toEqual({
      name: 'ada',
      enabled: true,
    });
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.calls[0][0]).toEqual({
      name: 'ada',
      enabled: true,
    });
  });
});

describe('QuietJsonParserValidateError', () => {
  it('should be a QuietJsonParserError', () => {
    const error = new QuietJsonParserValidateError();

    expect(error).toBeInstanceOf(QuietJsonParserValidateError);
    expect(error).toBeInstanceOf(QuietJsonParserError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('QuietJsonParserValidateError');
    expect(error.message).toBe('Parsed JSON did not match the expected shape');
  });
});

describe('quietStringify', () => {
  it('should stringify valid values', () => {
    expect(quietStringify({ name: 'ada', n: 1 }, '')).toBe('{"name":"ada","n":1}');
    expect(quietStringify([1, 'a', true], '')).toBe('[1,"a",true]');
    expect(quietStringify('ada', '')).toBe('"ada"');
    expect(quietStringify(1, '')).toBe('1');
    expect(quietStringify(true, '')).toBe('true');
    expect(quietStringify(null, '')).toBe('null');
  });

  it.each([
    ['undefined', undefined],
    ['a function', () => undefined],
    ['a symbol', Symbol('x')],
  ] as const)(
    'should return fallback when the result is not a string for %s',
    (_label, input) => {
      const onError = jest.fn();
      expect(quietStringify(input, '"fallback"', onError)).toBe('"fallback"');
      expect(onError).not.toHaveBeenCalled();
    },
  );

  it('should return fallback and call onError when stringify throws', () => {
    const circular: Record<string, unknown> = { name: 'ada' };
    circular.self = circular;
    const onError = jest.fn();

    expect(quietStringify(circular, '{"ok":false}', onError)).toBe('{"ok":false}');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(TypeError);
  });

  it('should return fallback and call onError for BigInt values', () => {
    const onError = jest.fn();

    expect(quietStringify({ n: 1n }, '{}', onError)).toBe('{}');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(TypeError);
  });

  it('should omit __proto__, prototype, and constructor.prototype only', () => {
    const value = {
      keep: true,
      constructor: 'Engineer',
      prototype: { x: 1 },
      nested: {
        keep: true,
        constructor: { prototype: { y: 2 }, name: 'x' },
        role: {
          constructor: { title: 'Engineer' },
        },
      },
    };
    Object.defineProperty(value, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
    });

    expect(JSON.parse(quietStringify(value, 'null'))).toEqual({
      keep: true,
      constructor: 'Engineer',
      nested: {
        keep: true,
        role: {
          constructor: { title: 'Engineer' },
        },
      },
    });
  });
});
