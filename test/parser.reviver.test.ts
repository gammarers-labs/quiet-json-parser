import { quietParse } from '../src';

describe('quietParse reviver', () => {
  it('should revive values and then omit unsafe keys', () => {
    const keys: string[] = [];
    const validate = jest.fn((value: unknown): boolean => {
      expect(value).toEqual({ keep: true });
      return true;
    });

    expect(quietParse('{"keep":true,"__proto__":{"polluted":true},"constructor":{"prototype":{"y":1}}}', {
      fallback: null,
      validate,
      reviver: (key, value) => {
        keys.push(key);
        return value;
      },
    })).toEqual({ keep: true });
    expect(keys).toContain('__proto__');
    expect(keys).toContain('constructor');
    expect(keys).toContain('prototype');
    expect(validate).toHaveBeenCalledTimes(1);
  });

  it('should transform a property and drop a key that revives to undefined', () => {
    expect(quietParse('{"n":"1","b":2}', {
      fallback: null,
      reviver: (key, value) => {
        if (key === 'n') {
          return Number(value);
        }
        if (key === 'b') {
          return undefined;
        }
        return value;
      },
    })).toEqual({ n: 1 });
  });

  it('should bind this to the holder', () => {
    expect(quietParse('{"name":"ada","title":"eng"}', {
      fallback: null,
      reviver: function (this: unknown, key: string, value: unknown): unknown {
        if (key === 'title' && typeof this === 'object' && this !== null && 'name' in this) {
          return 'engineer';
        }
        return value;
      },
    })).toEqual({ name: 'ada', title: 'engineer' });
  });

  it('should return undefined when the root reviver returns undefined', () => {
    expect(quietParse('{"a":1}', {
      fallback: null,
      reviver: (key, value) => (key === '' ? undefined : value),
    })).toBeUndefined();
  });

  it('should return fallback and skip validate when the reviver throws', () => {
    const thrown = new Error('reviver failed');
    const validate = jest.fn((value: unknown): boolean => value !== undefined);
    const onError = jest.fn();

    expect(quietParse('{"a":1}', {
      fallback: { ok: false },
      reviver: () => {
        throw thrown;
      },
      validate,
      onError,
    })).toEqual({ ok: false });
    expect(validate).not.toHaveBeenCalled();
    expect(onError.mock.calls[0][0]).toBe(thrown);
  });

  it('should not call the reviver when maxDepth is exceeded', () => {
    const seen: string[] = [];

    expect(quietParse('{"a":{"b":1}}', {
      fallback: null,
      maxDepth: 1,
      reviver: (key, value) => {
        seen.push(key);
        return value;
      },
    })).toBeNull();
    expect(seen).toEqual([]);
  });

  it('should accept a reviver on the positional extra options', () => {
    expect(quietParse('{"n":"1"}', null, {
      reviver: (key, value) => (key === 'n' ? Number(value) : value),
    })).toEqual({ n: 1 });
  });
});
