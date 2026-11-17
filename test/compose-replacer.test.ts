import { composeReplacer } from '../src/core/compose-replacer';

describe('composeReplacer', () => {
  it('should only drop unsafe keys when replacer is omitted', () => {
    const value = { keep: true, prototype: { x: 1 }, constructor: 'Engineer' };

    expect(JSON.parse(JSON.stringify(value, composeReplacer(undefined)))).toEqual({
      keep: true,
      constructor: 'Engineer',
    });
  });

  it('should not call the user replacer for unsafe keys', () => {
    const user = jest.fn((key: string, value: unknown) => {
      expect(key).toBe('keep');
      return value;
    });
    const visit = composeReplacer(user);
    const prototype = { x: 1 };

    expect(visit.call({}, 'prototype', prototype)).toBeUndefined();
    expect(user).not.toHaveBeenCalled();
    expect(visit.call({ keep: true }, 'keep', true)).toBe(true);
    expect(user).toHaveBeenCalledTimes(1);
  });

  it('should forward this to the user replacer', () => {
    const holder = { a: 1 };
    const user = jest.fn(function (this: unknown, key: string, value: unknown) {
      expect(key).toBe('a');
      expect(value).toBe(1);
      return this;
    });
    const visit = composeReplacer(user);

    expect(visit.call(holder, 'a', 1)).toBe(holder);
  });

  it('should keep listed object keys, drop unsafe keys, and keep array elements', () => {
    const listed: readonly unknown[] = ['b', new String('a'), 2, new Number(1), true];
    const replacer = composeReplacer(listed as readonly (string | number)[]);

    expect(JSON.parse(JSON.stringify({
      a: 1,
      b: 3,
      1: 4,
      2: 5,
      c: 6,
      prototype: { x: 1 },
    }, replacer))).toEqual({
      a: 1,
      b: 3,
      1: 4,
      2: 5,
    });
    expect(JSON.stringify([1, { a: 1, b: 2 }], composeReplacer([]))).toBe('[1,{}]');
    expect(JSON.stringify(1, composeReplacer(['a']))).toBe('1');
  });
});
