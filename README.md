# Quiet Json Parser

[![NpmPackageVersion](https://img.shields.io/npm/v/quiet-json-parser)](https://www.npmjs.com/package/quiet-json-parser)
[![NpmPackageDownloads](https://img.shields.io/npm/dm/quiet-json-parser)](https://www.npmjs.com/package/quiet-json-parser)
[![Build Status](https://github.com/gammarers-labs/quiet-json-parser/actions/workflows/build.yml/badge.svg)](https://github.com/gammarers-labs/quiet-json-parser/actions/workflows/build.yml)
[![GitHub](https://img.shields.io/github/license/gammarers-labs/quiet-json-parser)](LICENSE)

A small helper to parse and stringify JSON safely by omitting keys commonly used for prototype pollution, with an optional fallback on invalid input or serialization failure.

## Features

- Parse JSON with a reviver that drops `__proto__`, `constructor`, and `prototype` keys (including nested ones)
- Stringify values with a replacer that drops the same keys
- Return a fallback value for nullish, empty, or invalid JSON input, and for stringify failures
- Optional `onError` callback for parse or stringify failures
- TypeScript generics for compile-time typing (not validated at runtime)

## Installation

npm:

```bash
npm install quiet-json-parser
```

yarn:

```bash
yarn add quiet-json-parser
```

## Usage

```ts
import { quietParse, quietStringify } from 'quiet-json-parser';

interface Config {
  name: string;
  enabled: boolean;
}

const fallback: Config = { name: 'default', enabled: false };

const config = quietParse<Config>(
  '{"name":"ada","enabled":true}',
  fallback,
);

// Invalid or missing input returns the fallback
const fromMissing = quietParse(undefined, fallback);

const fromInvalid = quietParse('{', fallback, (error) => {
  console.error('failed to parse config', error);
});

const json = quietStringify(config, '{}');

// Circular references or BigInt values return the fallback
const circular: Record<string, unknown> = { name: 'ada' };
circular.self = circular;
const fromCircular = quietStringify(circular, '{}', (error) => {
  console.error('failed to stringify config', error);
});
```

## Options

`quietParse(jsonString, fallback, onError?)`

| Parameter | Type | Description |
| --- | --- | --- |
| `jsonString` | `string \| undefined \| null` | JSON text to parse. Nullish or empty values skip parsing and return `fallback`. |
| `fallback` | `T` | Value returned when input is missing/empty or parsing fails. |
| `onError` | `(error: unknown) => void` (optional) | Called with the caught error when `JSON.parse` throws. Not called for nullish/empty input. |

Returns the parsed value cast to `T`, or `fallback`. The result is not schema-validated at runtime.

`quietStringify(value, fallback, onError?)`

| Parameter | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Value to serialize. |
| `fallback` | `string` | Value returned when serialization throws or yields a non-string (`undefined`, functions, symbols). |
| `onError` | `(error: unknown) => void` (optional) | Called with the caught error when `JSON.stringify` throws. Not called when the result is not a string. |

Returns the JSON string, or `fallback`. `__proto__`, `constructor`, and `prototype` keys are omitted.

## Requirements

- Node.js `>= 20.0.0`

## License

This project is licensed under the Apache-2.0 License.
