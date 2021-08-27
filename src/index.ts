'use strict';

import { Format } from 'logform';

import { Logger, RemoteConfig, SeqEvent, SeqLoggerConfig, SeqLogLevel } from 'seq-logging';

import { LEVEL, MESSAGE, SPLAT } from 'triple-beam';

import TransportStream from 'winston-transport';

type IFormattedMetaErrorId = number;
type IFormattedMetaError = { error: Error, id: IFormattedMetaErrorId };
type IFormattedProperty = any;

interface IFormattedMeta {
  properties: IFormattedProperty | null;
  errors: IFormattedMetaError[];
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

function isPrimitive(obj: any): boolean {
  if (obj === null) {
    return true;
  }

  switch (typeof obj) {
    case 'undefined':
    case 'string':
    case 'number':
    case 'boolean':
      return true;

    default: return false;
  }
}

function formatMeta(args?: any[]): IFormattedMeta {
  const errors: IFormattedMetaError[] = [];

  return {
    properties: format(args, errors),
    errors
  };
}

function getErrorStack(err: Error, id: IFormattedMetaErrorId): string {
  if (!err) {
    return `@${id}: No stack`;
  }

  const stack =
    typeof err.stack !== 'undefined'
      ? err.stack
      : err.toString();

  return `@${id}: ${stack}`;
}

function format(val: any, errors: IFormattedMetaError[]): IFormattedProperty {
  if (val === null || typeof val === 'undefined') {
    return null;
  }

  if (isError(val)) {
    const id = errors.length;

    errors.push({ error: val, id });

    return { error: formatError(val, id) };
  }

  if (isPrimitive(val)) {
    return val;
  }

  if (val instanceof Date) {
    return { timestamp: formatDate(val) };
  }

  if (val instanceof Buffer) {
    return { buffer: formatBuffer(val) };
  }

  if (Array.isArray(val)) {
    return { array: formatArray(val, errors) };
  }

  if (typeof val === 'function') {
    return { function: formatFunction(val) };
  }

  if (typeof val !== 'object') {
    if (typeof val.toString === 'function') {
      return val.toString();
    }

    return null;
  }

  const properties: { [key: string]: IFormattedProperty } = {};

  for (let key in val) {
    const value = val[key];

    properties[key] = format(value, errors);
  }

  return properties;
}

function formatError(err: Error, id: IFormattedMetaErrorId) {
  const result: { [key: string]: any } = {};

  Object.getOwnPropertyNames(err)
    .filter(key => key !== 'stack')
    .forEach(key => result[key] = err[key as keyof Error]);

  result.stack = `@${id}`;

  return result;
}

function formatDate(date: Date): number {
  return date.getTime();
}

function formatFunction(fn: Function): string {
  return fn.toString();
}

function formatArray(arr: any[], errors: IFormattedMetaError[]): IFormattedProperty[] {
  return arr.map(val => format(val, errors));
}

function formatBuffer(buffer: Buffer) {
  return buffer.slice(0);
}

export class Transport extends TransportStream {
  readonly name = 'seq';

  private levelMapper: LevelMapperHandler;

  private seqLoggerConfig: SeqLoggerConfig;

  private seqLogger: Logger;

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
  }

  log(info: any, next: () => void): any {
    setImmediate(() => {
      try {
        const level = info[LEVEL] ?? info['level'];

        const message = info[MESSAGE] ?? info['message'];

        const meta = info[SPLAT];

        const seqEvent: SeqEvent = {
          timestamp: new Date(),
          level: this.levelMapper(level),
          messageTemplate: message
        };

        const { properties, errors } = formatMeta(meta);

        if (errors.length !== 0) {
          seqEvent.exception =
            errors
              .map(({ error, id }) => getErrorStack(error, id))
              .join('\n\n');
        }

        if (properties !== null) {
          seqEvent.properties = properties;
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
