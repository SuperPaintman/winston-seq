# winston-seq

[![Linux Build][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]
[![Commitizen friendly][commitizen-image]][commitizen-url]
[![NPM version][npm-v-image]][npm-url]
[![NPM Downloads][npm-dm-image]][npm-url]


--------------------------------------------------------------------------------


## Installation

```sh
$ npm install --save @valuabletouch/winston-seq
# Or with yarn
$ yarn add @valuabletouch/winston-seq
```


--------------------------------------------------------------------------------


## Usage

```ts
import { createLogger } from 'winston';
import { Transport as SeqTransport }    from 'winston-seq';

const logger = createLogger({
  transports: [
    new SeqTransport({
      serverUrl:  'http://127.0.0.1:5341'
      /* apiKey:     '7fs2V60izlkgau2ansjH' */
    })
  ]
});
```

Use non-standard levels? Overwrite the mapper:

```ts
// ...

const logger = createLogger({
  transports: [
    new SeqTransport({
      levelMapper(level = '') {
        switch (level.toLowerCase()) {
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

// ...
```


--------------------------------------------------------------------------------


## Build

```sh
$ npm install
$
$ npm run build
```


--------------------------------------------------------------------------------


## Contributing

1. Fork it (<https://github.com/valıuabletouch/winston-seq/fork>)
2. Create your feature branch (`git checkout -b feature/<feature_name>`)
3. Commit your changes (`git commit -am '<type>(<scope>): added some feature'`)
4. Push to the branch (`git push origin feature/<feature_name>`)
5. Create a new Pull Request


--------------------------------------------------------------------------------

## Contributors

- [SuperPaintman](https://github.com/SuperPaintman) SuperPaintman - creator, maintainer
- [Valuable Touch](https://github.com/valuabletouch) Fork maintainer


--------------------------------------------------------------------------------

## Changelog
[Changelog][changelog-url]


--------------------------------------------------------------------------------

## License

[MIT][license-url]


[license-url]: https://raw.githubusercontent.com/valuabletouch/winston-seq/master/LICENSE
[changelog-url]: https://raw.githubusercontent.com/valuabletouch/winston-seq/master/CHANGELOG.md
[npm-url]: https://www.npmjs.com/package/@valuabletouch/winston-seq
[npm-v-image]: https://img.shields.io/npm/v/@valuabletouch/winston-seq.svg
[npm-dm-image]: https://img.shields.io/npm/dm/@valuabletouch/winston-seq.svg
[travis-image]: https://img.shields.io/travis/valuabletouch/winston-seq/master.svg?label=linux
[travis-url]: https://travis-ci.org/valuabletouch/winston-seq
[coveralls-image]: https://img.shields.io/coveralls/valuabletouch/winston-seq/master.svg
[coveralls-url]: https://coveralls.io/r/valuabletouch/winston-seq?branch=master
[commitizen-image]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]: https://commitizen.github.io/cz-cli/
