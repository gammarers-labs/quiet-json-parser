import { safeJsonParse } from '../src';

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    expect(safeJsonParse('{"name":"ada","n":1}', null)).toEqual({
      name: 'ada',
      n: 1,
    });
  });

  it.each([null, undefined, ''] as const)(
    'should return fallback when input is %p',
    (input) => {
      const fallback = { ok: true };
      expect(safeJsonParse(input, fallback)).toBe(fallback);
    },
  );

  it('should return fallback and call onError when JSON is invalid', () => {
    const fallback = { ok: false };
    const onError = jest.fn();

    expect(safeJsonParse('{', fallback, onError)).toBe(fallback);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(SyntaxError);
  });

  it('should not call onError for nullish or empty input', () => {
    const onError = jest.fn();

    safeJsonParse(undefined, null, onError);
    safeJsonParse(null, null, onError);
    safeJsonParse('', null, onError);

    expect(onError).not.toHaveBeenCalled();
  });

  it('should omit __proto__, constructor, and prototype keys', () => {
    const json = [
      '{',
      '"keep":true,',
      '"__proto__":{"polluted":true},',
      '"constructor":"Engineer",',
      '"prototype":{"x":1},',
      '"nested":{',
      '"keep":true,',
      '"__proto__":{"polluted":true},',
      '"constructor":{"prototype":{"y":2}}',
      '}',
      '}',
    ].join('');

    expect(safeJsonParse(json, null)).toEqual({
      keep: true,
      nested: {
        keep: true,
      },
    });
  });

  it('should not pollute Object.prototype', () => {
    const marker = `__safe_json_parse_${Date.now()}`;
    safeJsonParse(`{"__proto__":{"${marker}":true}}`, null);

    expect(
      Object.prototype.hasOwnProperty.call(Object.prototype, marker),
    ).toBe(false);
    expect(({} as Record<string, unknown>)[marker]).toBeUndefined();
  });
});
