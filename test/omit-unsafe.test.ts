import { omitUnsafeDeep, omitUnsafeKey } from '../src/core/omit-unsafe';

describe('omitUnsafeKey', () => {
  const keptObject = { x: 1 };
  const unsafeConstructor = { prototype: { y: 2 } };

  it.each([
    ['__proto__', { polluted: true }, true],
    ['prototype', { x: 1 }, true],
    ['constructor', unsafeConstructor, true],
    ['constructor', 'Engineer', false],
    ['constructor', null, false],
    ['constructor', {}, false],
    ['constructor', [], false],
    ['keep', true, false],
    ['keep', keptObject, false],
  ] as Array<[string, unknown, boolean]>)(
    'key %s',
    (key, value, omitted) => {
      const result = omitUnsafeKey(key, value);

      if (omitted) {
        expect(result).toBeUndefined();
        return;
      }

      expect(result).toBe(value);
    },
  );
});

describe('omitUnsafeDeep', () => {
  it.each([
    ['null', null, null],
    ['a number', 1, 1],
    ['a string', 'ada', 'ada'],
    ['a boolean', true, true],
    ['an array of primitives', [1, 'a', true], [1, 'a', true]],
  ] as Array<[string, unknown, unknown]>)(
    'should return %s unchanged',
    (_label, input, expected) => {
      expect(omitUnsafeDeep(input)).toEqual(expected);
    },
  );

  it.each([
    [
      'top-level __proto__ and prototype',
      JSON.parse(
        '{"keep":true,"__proto__":{"polluted":true},"prototype":{"x":1}}',
      ),
      { keep: true },
    ],
    [
      'unsafe constructor.prototype',
      JSON.parse('{"constructor":{"prototype":{"y":2}}}'),
      {},
    ],
    [
      'safe constructor string',
      JSON.parse('{"constructor":"Engineer"}'),
      { constructor: 'Engineer' },
    ],
    [
      'safe constructor without prototype',
      JSON.parse('{"constructor":{}}'),
      { constructor: {} },
    ],
    [
      'safe constructor array',
      JSON.parse('{"constructor":["Engineer"]}'),
      { constructor: ['Engineer'] },
    ],
    [
      'nested unsafe keys',
      JSON.parse(
        [
          '{',
          '"keep":true,',
          '"nested":{',
          '"__proto__":{"polluted":true},',
          '"constructor":{"prototype":{"y":2},"name":"x"},',
          '"role":{"constructor":{"title":"Engineer"}}',
          '}',
          '}',
        ].join(''),
      ),
      {
        keep: true,
        nested: {
          role: { constructor: { title: 'Engineer' } },
        },
      },
    ],
    [
      'arrays of objects',
      JSON.parse(
        '[{"__proto__":{"polluted":true},"keep":true},{"prototype":{"x":1}}]',
      ),
      [{ keep: true }, {}],
    ],
  ] as Array<[string, unknown, unknown]>)(
    'should sanitize %s',
    (_label, input, expected) => {
      expect(omitUnsafeDeep(input)).toEqual(expected);
    },
  );
});
