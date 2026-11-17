import { quietStringify } from '../src';

const withUnsafeKeys = (): Record<string, unknown> => {
  const value: Record<string, unknown> = {
    keep: true,
    constructor: 'Engineer',
    prototype: { x: 1 },
  };
  Object.defineProperty(value, '__proto__', {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  return value;
};

describe('quietStringify replacer', () => {
  it('should pass space through and still omit unsafe keys', () => {
    const value = { a: 1, prototype: { x: 1 } };

    expect(quietStringify(value, { fallback: '', space: 2 })).toBe(
      JSON.stringify({ a: 1 }, null, 2),
    );
    expect(quietStringify(value, { fallback: '', space: '\t' })).toBe(
      JSON.stringify({ a: 1 }, null, '\t'),
    );
    expect(quietStringify(value, { fallback: '', space: '12345678901' })).toBe(
      JSON.stringify({ a: 1 }, null, '12345678901'),
    );
  });

  it('should convert BigInt in the user replacer', () => {
    expect(quietStringify({ n: 1n }, {
      fallback: '{}',
      replacer: (key, value) => (typeof value === 'bigint' || key === 'n' ? String(value) : value),
    })).toBe('{"n":"1"}');
  });

  it('should see a Date as an ISO string', () => {
    const seen: unknown[] = [];

    quietStringify({ at: new Date('2020-01-01T00:00:00.000Z') }, {
      fallback: '{}',
      replacer: (key, value) => {
        if (key === 'at') {
          seen.push(value);
        }
        return value;
      },
    });

    expect(seen).toEqual(['2020-01-01T00:00:00.000Z']);
  });

  it('should not call the user replacer for unsafe keys', () => {
    const keys: string[] = [];

    expect(JSON.parse(quietStringify(withUnsafeKeys(), {
      fallback: 'null',
      replacer: (key, value) => {
        keys.push(key);
        return value;
      },
    }))).toEqual({
      keep: true,
      constructor: 'Engineer',
    });
    expect(keys).toContain('keep');
    expect(keys).toContain('constructor');
    expect(keys).not.toContain('__proto__');
    expect(keys).not.toContain('prototype');
  });

  it('should bind this to the holder', () => {
    expect(quietStringify({ name: 'ada', title: 'eng' }, {
      fallback: '{}',
      replacer: function (this: unknown, key: string, value: unknown): unknown {
        if (key === 'title' && typeof this === 'object' && this !== null && 'name' in this) {
          return 'engineer';
        }
        return value;
      },
    })).toBe('{"name":"ada","title":"engineer"}');
  });

  it('should keep listed object keys and array elements', () => {
    expect(quietStringify({ a: 1, b: 2, prototype: { x: 1 } }, {
      fallback: '{}',
      replacer: ['a', 'prototype'],
    })).toBe('{"a":1}');
    expect(quietStringify([{ a: 1, b: 2 }, 3], {
      fallback: '[]',
      replacer: ['a'],
    })).toBe('[{"a":1},3]');
  });

  it('should omit unsafe keys inside a value returned by the replacer', () => {
    expect(quietStringify({ a: 1 }, {
      fallback: '',
      replacer: (key, value) => {
        if (key === 'a') {
          return { prototype: { x: 1 }, keep: true };
        }
        return value;
      },
    })).toBe('{"a":{"keep":true}}');
  });

  it('should return fallback and call onError when the replacer throws', () => {
    const thrown = new Error('replacer failed');
    const onError = jest.fn();

    expect(quietStringify({ a: 1 }, {
      fallback: '""',
      onError,
      replacer: () => {
        throw thrown;
      },
    })).toBe('""');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe(thrown);
  });

  it('should accept space and replacer on the positional extra options', () => {
    expect(quietStringify({ a: 1 }, '{}', { space: 2 })).toBe('{\n  "a": 1\n}');
  });
});
