# @valuabletouch/winston-seq

[![NPM version][npm-v-image]][npm-url]
[![NPM Downloads][npm-dl-image]][npm-url]

Another Seq transport for Winston

## Installation

```sh
$ npm install --save @valuabletouch/winston-seq

# Or with yarn
$ yarn add @valuabletouch/winston-seq
```

## Usage

```ts
import { createLogger } from 'winston';
import { Transport as SeqTransport } from 'winston-seq';

const logger = createLogger({
  transports: [
    new SeqTransport({
      serverUrl: 'http://127.0.0.1:5341'
    })
  ]
});
```

Options object is a merge of the `TransportStreamOptions` interface of `'winston-transport'` and `SeqLoggerConfig` interface of `'seq-logging'`:

```ts
interface IOption {
  format?: Format;
  level?: string;
  silent?: boolean;
  handleExceptions?: boolean;

  serverUrl?: string;
  apiKey?: string;
  maxBatchingTime?: number;
  eventSizeLimit?: number;
  batchSizeLimit?: number;
  requestTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  onError?: ErrorHandler;
  onRemoteConfigChange?: RemoteConfigChangeHandler;

  levelMapper?: LevelMapperHandler;
}
```

Using non-standard levels? Transform them with `levelMapper`:

```ts
const logger = createLogger({
  transports: [
    new SeqTransport({
      levelMapper(level = '') {
        switch (level?.toLowerCase()) {
          // Winston   ->  Seq
          case 'error':    return 'Error';
          case 'warn':     return 'Warning';
          case 'info':     return 'Information';
          case 'debug':    return 'Debug';
          case 'verbose':  return 'Verbose';
          case 'silly':    return 'Verbose';
          case 'fatal':    return 'Fatal';
          default:         return 'Information';
        }
      }
    })
  ]
});
```

## Build

```sh
$ npm install

$ npm run build
```

## Contributing

1. Fork it (<https://github.com/valıuabletouch/winston-seq/fork>)
2. Create your feature branch (`git checkout -b feature/<feature_name>`)
3. Commit your changes (`git commit -am '<type>(<scope>): added some feature'`)
4. Push to the branch (`git push origin feature/<feature_name>`)
5. Create a Pull Request

## Contributors

- [SuperPaintman](https://github.com/SuperPaintman) Creator
- [Valuable Touch](https://github.com/valuabletouch) Maintainer

## Changelog
[Changelog][changelog-url]

## License

[MIT][license-url]


[license-url]: LICENSE
[changelog-url]: CHANGELOG.md
[npm-url]: https://www.npmjs.com/package/@valuabletouch/winston-seq
[npm-v-image]: https://img.shields.io/npm/v/@valuabletouch/winston-seq.svg
[npm-dl-image]: https://img.shields.io/npm/dm/@valuabletouch/winston-seq.svg
