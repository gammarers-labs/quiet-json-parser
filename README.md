# Quiet Json Parser

[![NpmPackageVersion](https://img.shields.io/npm/v/quiet-json-parser)](https://www.npmjs.com/package/quiet-json-parser)
[![NpmPackageDownloads](https://img.shields.io/npm/dm/quiet-json-parser)](https://www.npmjs.com/package/quiet-json-parser)
[![Build Status](https://github.com/gammarers-labs/quiet-json-parser/actions/workflows/build.yml/badge.svg)](https://github.com/gammarers-labs/quiet-json-parser/actions/workflows/build.yml)
[![GitHub](https://img.shields.io/github/license/gammarers-labs/quiet-json-parser)](LICENSE)

A small helper to parse JSON strings safely by omitting keys commonly used for prototype pollution, with an optional fallback on invalid or missing input.

## Features

- Parse JSON with a reviver that drops `__proto__`, `constructor`, and `prototype` keys (including nested ones)
- Return a fallback value for nullish, empty, or invalid JSON input
- Optional `onError` callback for parse failures
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
import { quietParse } from 'quiet-json-parser';

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
```

## Options

`quietParse(jsonString, fallback, onError?)`

| Parameter | Type | Description |
| --- | --- | --- |
| `jsonString` | `string \| undefined \| null` | JSON text to parse. Nullish or empty values skip parsing and return `fallback`. |
| `fallback` | `T` | Value returned when input is missing/empty or parsing fails. |
| `onError` | `(error: unknown) => void` (optional) | Called with the caught error when `JSON.parse` throws. Not called for nullish/empty input. |

Returns the parsed value cast to `T`, or `fallback`. The result is not schema-validated at runtime.

## Requirements

- Node.js `>= 20.0.0`

## License

This project is licensed under the Apache-2.0 License.
