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
- Optional `maxBytes` and `maxDepth` checks before parse, so oversized or deeply nested input returns `fallback` without parsing
- Options objects (`QuietParseOptions` / `QuietStringifyOptions`) as the preferred API, with room to grow
- Optional `onError` callback for limit failures, parse failures, and stringify failures
- Optional `validate` for `quietParse` (type guard or predicate); mismatch returns `fallback`
- TypeScript generics; runtime shape is checked only when `validate` is provided
- Positional `(value, fallback, onError?)` overloads remain available for compatibility

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

const config = quietParse('{"name":"ada","enabled":true}', { fallback });

const json = quietStringify(config, { fallback: '{}' });
```

Invalid or missing input returns the fallback. Pass `onError` to observe parse or stringify failures:

```ts
const fromMissing = quietParse(undefined, { fallback });

const fromInvalid = quietParse('{', {
  fallback,
  onError: (error) => {
    console.error('failed to parse config', error);
  },
});

const circular: Record<string, unknown> = { name: 'ada' };
circular.self = circular;
const fromCircular = quietStringify(circular, {
  fallback: '{}',
  onError: (error) => {
    console.error('failed to stringify config', error);
  },
});
```

For untrusted input, set `maxBytes` and `maxDepth`. Text over either limit is not parsed:

```ts
import {
  QuietJsonParserMaxBytesError,
  QuietJsonParserMaxDepthError,
  quietParse,
} from 'quiet-json-parser';

const untrustedJson = '{"name":"ada","enabled":true}';

const fromUntrusted = quietParse(untrustedJson, {
  fallback,
  maxBytes: 65536,
  maxDepth: 20,
  onError: (error) => {
    if (error instanceof QuietJsonParserMaxBytesError) {
      console.error('config payload is too large');
      return;
    }
    if (error instanceof QuietJsonParserMaxDepthError) {
      console.error('config nesting is too deep');
      return;
    }
    console.error('failed to parse config', error);
  },
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

const fromValidated = quietParse('{"name":"ada"}', {
  fallback,
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

Positional arguments still work:

```ts
quietParse('{', fallback, (error) => {
  console.error(error);
});
quietStringify(circular, '{}', (error) => {
  console.error(error);
});
```

## Options

`quietParse(jsonString, options)` (preferred)

| Parameter | Type | Description |
| --- | --- | --- |
| `jsonString` | `string \| undefined \| null` | JSON text to parse. Nullish or empty values skip parsing and return `fallback`. |
| `options` | `QuietParseOptions<T>` | Parse settings. `fallback` is required. |

`QuietParseOptions<T>`

| Option | Type | Description |
| --- | --- | --- |
| `fallback` | `T` | Value returned when input is missing/empty, a limit is exceeded, parsing fails, or `validate` rejects the value. |
| `maxBytes` | `number` (optional) | Maximum UTF-8 byte length of `jsonString`. Checked before `JSON.parse`. When the text is larger, parsing is skipped, `onError` receives `QuietJsonParserMaxBytesError`, and the function returns `fallback`. Omit for no size limit. Not applied to nullish or empty input. |
| `maxDepth` | `number` (optional) | Maximum nesting of objects and arrays. A primitive is depth 0. `{}` and `[]` are depth 1. Braces inside strings do not count. Checked before `JSON.parse`. When nesting is deeper, parsing is skipped, `onError` receives `QuietJsonParserMaxDepthError`, and the function returns `fallback`. The reported depth is the first level past the limit. Omit for no depth limit. Not applied to nullish or empty input. |
| `validate` | `(value: unknown) => boolean` (optional) | Type guard or predicate run on the sanitized parse result. Schema libraries can wrap `safeParse`. On `false`, `onError` receives `QuietJsonParserValidateError` and the function returns `fallback`. If the function throws, the thrown value is passed to `onError`. Not called for nullish/empty input, `JSON.parse` failures, or limit failures. |
| `onError` | `QuietJsonParserOnError` (optional) | Called with `QuietJsonParserMaxBytesError` or `QuietJsonParserMaxDepthError` when a limit is exceeded, when `JSON.parse` throws, when `validate` throws, or with `QuietJsonParserValidateError` when `validate` returns `false`. Not called for nullish or empty input. Not called when `quietParse` throws `QuietJsonParserOptionsError`. |

`quietParse(jsonString, fallback, onErrorOrOptions?)` remains supported. The third argument may be an `onError` callback or `{ validate?, onError?, maxDepth?, maxBytes? }` (`QuietParseExtraOptions`).

`maxDepth` and `maxBytes` must be non-negative integers when set. Otherwise `quietParse` throws `QuietJsonParserOptionsError` and does not call `onError`.

Returns the parsed value as `T`, or `fallback`. Runtime shape is checked only when `validate` is provided. When inspecting `onError`, check `QuietJsonParserMaxBytesError`, `QuietJsonParserMaxDepthError`, and `QuietJsonParserValidateError` before `QuietJsonParserError`.

`quietStringify(value, options)` (preferred)

| Parameter | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Value to serialize. |
| `options` | `QuietStringifyOptions` | Stringify settings. `fallback` is required. |

`QuietStringifyOptions`

| Option | Type | Description |
| --- | --- | --- |
| `fallback` | `string` | Value returned when serialization throws or yields a non-string (`undefined`, functions, symbols). |
| `onError` | `QuietJsonParserOnError` (optional) | Called with the caught error when `JSON.stringify` throws. Not called when the result is not a string. |

`quietStringify(value, fallback, onError?)` remains supported.

Returns the JSON string, or `fallback`. `__proto__` and `prototype` keys are omitted. A `constructor` key is omitted only when its value is an object that contains `prototype`.

## Requirements

- Node.js `>= 20.0.0`

## License

This project is licensed under the Apache-2.0 License.
