# Quiet Json Parser

[![npm version](https://img.shields.io/npm/v/quiet-json-parser?style=flat-square)](https://www.npmjs.com/package/quiet-json-parser)
[![license](https://img.shields.io/npm/l/quiet-json-parser?style=flat-square)](https://www.npmjs.com/package/quiet-json-parser)
[![Node.js](https://img.shields.io/node/v/quiet-json-parser?style=flat-square)](https://www.npmjs.com/package/quiet-json-parser)
[![build](https://img.shields.io/github/actions/workflow/status/gammarers-labs/quiet-json-parser/build.yml?label=build&style=flat-square)](https://github.com/gammarers-labs/quiet-json-parser/actions/workflows/build.yml)

A small helper to parse and stringify JSON safely by omitting keys commonly used for prototype pollution. Invalid input and serialization failures return a fallback, and parse results can be checked at runtime with an optional type guard.

## Features

- Parse JSON while dropping `__proto__` and `prototype` keys, and dropping `constructor` only when its value is an object that contains `prototype`
- Stringify values with a replacer that drops the same keys
- Return a fallback value for nullish, empty, or invalid JSON input, and for stringify failures
- Optional `onError` callback for parse or stringify failures
- Optional `validate` for `quietParse` (type guard or predicate); mismatch returns `fallback`
- TypeScript generics; runtime shape is checked only when `validate` is provided

## Installation

### npm

```bash
npm install quiet-json-parser
```

### yarn

```bash
yarn add quiet-json-parser
```

### pnpm

```bash
pnpm add quiet-json-parser
```

## Usage

```ts
import { quietParse, quietStringify } from 'quiet-json-parser';

interface Config {
  name: string;
  enabled: boolean;
}

const fallback: Config = { name: 'default', enabled: false };

const config = quietParse(
  '{"name":"ada","enabled":true}',
  fallback,
);

const json = quietStringify(config, '{}');
```

Invalid or missing input returns the fallback. Pass `onError` to observe parse or stringify failures:

```ts
const fromMissing = quietParse(undefined, fallback);

const fromInvalid = quietParse('{', fallback, (error) => {
  console.error('failed to parse config', error);
});

const circular: Record<string, unknown> = { name: 'ada' };
circular.self = circular;
const fromCircular = quietStringify(circular, '{}', (error) => {
  console.error('failed to stringify config', error);
});
```

Pass `validate` to check the sanitized parse result at runtime. On mismatch, `quietParse` returns `fallback` and calls `onError` with `QuietJsonParserValidateError`:

```ts
import { QuietJsonParserValidateError, quietParse } from 'quiet-json-parser';

const isConfig = (value: unknown): value is Config => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  if (!('name' in value) || !('enabled' in value)) {
    return false;
  }
  return typeof value.name === 'string' && typeof value.enabled === 'boolean';
};

const fromValidated = quietParse('{"name":"ada"}', fallback, {
  validate: isConfig,
  onError: (error) => {
    if (error instanceof QuietJsonParserValidateError) {
      console.error('config shape mismatch');
      return;
    }
    console.error('failed to parse config', error);
  },
});
```

## Options

`quietParse(jsonString, fallback, onErrorOrOptions?)`

| Parameter | Type | Description |
| --- | --- | --- |
| `jsonString` | `string \| undefined \| null` | JSON text to parse. Nullish or empty values skip parsing and return `fallback`. |
| `fallback` | `T` | Value returned when input is missing/empty, parsing fails, or `validate` rejects the value. |
| `onErrorOrOptions` | `((error: unknown) => void) \| QuietParseOptions<T>` (optional) | A callback invoked on parse or validation failure, or an options object. |

`QuietParseOptions<T>`

| Option | Type | Description |
| --- | --- | --- |
| `validate` | `(value: unknown) => boolean` (optional) | Type guard or predicate run on the sanitized parse result. Schema libraries can wrap `safeParse`. On `false`, `onError` receives `QuietJsonParserValidateError` and the function returns `fallback`. If the function throws, the thrown value is passed to `onError`. Not called for nullish/empty input or `JSON.parse` failures. |
| `onError` | `(error: unknown) => void` (optional) | Called when `JSON.parse` throws, when `validate` throws, or with `QuietJsonParserValidateError` when `validate` returns `false`. Not called for nullish/empty input. |

Returns the parsed value as `T`, or `fallback`. Runtime shape is checked only when `validate` is provided. When inspecting errors, check `QuietJsonParserValidateError` before `QuietJsonParserError`.

`quietStringify(value, fallback, onError?)`

| Parameter | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Value to serialize. |
| `fallback` | `string` | Value returned when serialization throws or yields a non-string (`undefined`, functions, symbols). |
| `onError` | `(error: unknown) => void` (optional) | Called with the caught error when `JSON.stringify` throws. Not called when the result is not a string. |

Returns the JSON string, or `fallback`. `__proto__` and `prototype` keys are omitted. A `constructor` key is omitted only when its value is an object that contains `prototype`.

## Requirements

- Node.js `>= 20.0.0`

## License

This project is licensed under the Apache-2.0 License.
