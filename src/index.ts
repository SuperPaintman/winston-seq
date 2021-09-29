'use strict';

import { Format } from 'logform';

import { Logger, RemoteConfig, SeqEvent, SeqLoggerConfig, SeqLogLevel } from 'seq-logging';

import TransportStream from 'winston-transport';

type IFormattedMetaErrorId = number;
type IFormattedMetaError = { error: Error, id: IFormattedMetaErrorId };

type IFormattedProperty = IFormattedCircular | IFormattedError | IFormattedDate | IFormattedBuffer | IFormattedSymbol | IFormattedFunction | Array<IFormattedProperty> | { [key: string]: IFormattedProperty } | string | null;

interface IFormattedMeta {
  properties: IFormattedProperty;
  errors: IFormattedMetaError[];
}

interface IFormattedCircular {
  $circular: string;
}

interface IFormattedError {
  $error: { [key: string]: any };
}

interface IFormattedDate {
  $date: string;
}

interface IFormattedBuffer {
  $buffer: Buffer;
}

interface IFormattedSymbol {
  $symbol: string;
}

interface IFormattedFunction {
  $function: { [key: string]: string };
}

type ErrorHandler = (e: Error) => void;
type RemoteConfigChangeHandler = (remoteConfig: RemoteConfig) => void;
type LevelMapperHandler = (level: string) => SeqLogLevel;

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
  maxBufferLength?: number;
  maxFunctionSourceLength?: number;
}

function defaultLevelMapper(level: string): SeqLogLevel {
  switch (level?.toLowerCase()) {
    case 'verbose':
    case 'silly': return 'Verbose';

    case 'debug': return 'Debug';
    case 'info': return 'Information';
    case 'warn': return 'Warning';
    case 'error': return 'Error';

    /** Non standart */
    case 'fatal': return 'Fatal';

    default: return 'Information';
  }
}

function isError(obj?: any): boolean {
  if (!obj) {
    return false;
  }

  if (obj instanceof Error) {
    return true;
  }

  if (obj.constructor?.name === 'Error') {
    return true;
  }

  // quack-quack
  if (typeof obj.name === 'string'
    && typeof obj.message === 'string'
    && typeof obj.stack === 'string') {
    return true;
  }

  return false;
}

function isPrimitive(val: any): boolean {
  if (val === null) {
    return true;
  }

  switch (typeof val) {
    case 'undefined':
    case 'string':
    case 'number':
    case 'bigint':
    case 'boolean':
      return true;

    default: return false;
  }
}

function isComplex(val: any) {
  return val && (typeof val === 'object' || typeof val === 'function');
}

function formatMeta(options: IOption, meta?: any): IFormattedMeta {
  const errors: IFormattedMetaError[] = [];

  const allValues: any[] = [];

  return {
    properties: format(meta, '$root', errors, allValues, options),
    errors
  };
}

function getErrorStack(err: Error, id: IFormattedMetaErrorId): string {
  if (!err) {
    return `[${id}]: <No stack>`;
  }

  const stack =
    typeof err.stack !== 'undefined'
      ? err.stack
      : err.toString();

  return `[${id}]: ${stack}`;
}

function format(val: any, path: string, errors: IFormattedMetaError[], allValues: any[], options: IOption): IFormattedProperty {
  if (val == null) {
    return null;
  }

  const circularResult = checkCircular(val, path, allValues);

  if (circularResult) {
    return circularResult;
  }

  if (isError(val)) {
    const id = errors.length;

    errors.push({ error: val, id });

    return formatError(val, id);
  }

  if (isPrimitive(val)) {
    return val;
  }

  if (val instanceof Date) {
    return formatDate(val);
  }

  if (val instanceof Buffer) {
    return formatBuffer(val, options.maxBufferLength);
  }

  if (typeof val === 'symbol') {
    return formatSymbol(val);
  }

  if (typeof val === 'function') {
    return formatFunction(val, options.maxFunctionSourceLength);
  }

  if (Array.isArray(val)) {
    return formatArray(val, path, errors, allValues, options);
  }

  if (typeof val !== 'object') {
    return formatNonObject(val);
  }

  return formatProperties(val, path, errors, allValues, options);
}

function checkCircular(val: any, path: string, allValues: any[]): IFormattedCircular | undefined {
  if (isComplex(val)) {
    if (allValues.some(v => v.value === val)) {
      const existingValue = allValues.find(v => v.value === val);

      return { $circular: existingValue.path };
    }
    else {
      allValues.push({
        value: val,
        path
      });
    }
  }
}

function formatError(error: Error, id: IFormattedMetaErrorId): IFormattedError {
  const result: { [key: string]: any } = {};

  Object.getOwnPropertyNames(error)
    .filter(key => key !== 'stack')
    .forEach(key => result[key] = error[key as keyof Error]);

  result.stack = `*[${id}]`;

  return { $error: result };
}

function formatDate(date: Date): IFormattedDate {
  return { $date: date.toISOString() };
}

function formatBuffer(buffer: Buffer, maxLength?: number): IFormattedBuffer | string {
  if (maxLength != null && maxLength <= 0) {
    return '$buffer';
  }

  const length = buffer.length;

  return {
    $buffer:
      maxLength && length > maxLength
        ? buffer.slice(0, maxLength)
        : buffer.slice(0)
  };
}

function formatSymbol(symbol: Symbol): IFormattedSymbol {
  return { $symbol: Symbol.prototype.toString.call(symbol) };
}

function formatFunction(fn: Function, maxLength?: number): IFormattedFunction | string {
  if (maxLength != null && maxLength <= 0) {
    return '$function';
  }

  let src = fn.toString();

  if (maxLength && src.length > maxLength) {
    src = src.substring(0, maxLength - 8) + '\n// ...';
  }

  return {
    $function: {
      name: fn.name,
      src
    }
  };
}

function formatArray(val: Array<any>, path: string, errors: IFormattedMetaError[], allValues: any[], options: IOption): Array<IFormattedProperty> {
  return val.map((v, i) => format(v, `${path}[${i}]`, errors, allValues, options));
}

function formatNonObject(val: any): string | null {
  if (typeof val.toString === 'function') {
    return val.toString();
  }

  return null;
}

function formatProperties(val: any, path: string, errors: IFormattedMetaError[], allValues: any[], options: IOption): { [key: string]: IFormattedProperty } {
  const properties: { [key: string]: IFormattedProperty } = {};

  for (let key in val) {
    const value = val[key];

    properties[key] = format(value, `${path}.${key}`, errors, allValues, options);
  }

  return properties;
}

export class Transport extends TransportStream {
  readonly name = 'seq';

  private levelMapper: LevelMapperHandler;

  private seqLoggerConfig: SeqLoggerConfig;

  private seqLogger: Logger;

  private options: IOption;

  constructor(options: IOption = {}) {
    super(options);

    if (typeof options !== 'object' || options === null) {
      options = {};
    }

    if (typeof options.onError !== 'function') {
      options.onError = (err: Error) => this.emit('error', err);
    }

    this.seqLoggerConfig = options as SeqLoggerConfig;

    this.seqLogger = new Logger(this.seqLoggerConfig);

    this.levelMapper =
      typeof options.levelMapper === 'function'
        ? options.levelMapper
        : defaultLevelMapper;

    this.options = options;
  }

  log(info: any, next: () => void): any {
    setImmediate(() => {
      try {
        const { level, message, timestamp, ...meta } = info;

        const seqEvent: SeqEvent = {
          timestamp:
            timestamp && !Number.isNaN(Date.parse(timestamp))
              ? new Date(Date.parse(timestamp))
              : new Date(),
          level: this.levelMapper(level),
          messageTemplate: message
        };

        const { properties, errors } = formatMeta(this.options, meta);

        if (errors.length !== 0) {
          seqEvent.exception =
            errors
              .map(({ error, id }) => getErrorStack(error, id))
              .join('\n\n');
        }

        if (properties !== null) {
          seqEvent.properties = properties as object;
        }

        this.seqLogger.emit(seqEvent);
      } catch (err) {
        console.error('[@valuabletouch/winston-seq]', err);
      }
    });

    this.emit('logged', info);

    if (typeof next === 'function') {
      next();
    }
  }

  close(): Promise<void> {
    return this.seqLogger.close();
  }

  flush(): Promise<boolean> {
    return this.seqLogger.flush();
  }
}
