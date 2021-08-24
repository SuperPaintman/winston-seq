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

export class Transport extends TransportStream {
  readonly name = 'seq';

  private levelMapper: LevelMapperHandler;

  private seqLoggerConfig: SeqLoggerConfig;

  private seqLogger: Logger;

  constructor(options: IOption = {}) {
    super(options);

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
    const level = info[LEVEL] ?? info['level'];

    const message = info[MESSAGE] ?? info['message'];

    const meta = info[SPLAT];

    const seqEvent: SeqEvent = {
      timestamp: new Date(),
      level: this.levelMapper(level),
      messageTemplate: message
    };

    const { properties, errors } = this.formatMeta(meta);

    if (errors.length !== 0) {
      seqEvent.exception =
        errors
          .map(({ error, id }) => this.getErrorStack(error, id))
          .join('\n\n');
    }

    if (properties !== null) {
      seqEvent.properties = properties;
    }

    this.seqLogger.emit(seqEvent);

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

  private isError(obj?: any): boolean {
    if (!obj) {
      return false;
    }

    if (obj instanceof Error) {
      return true;
    }

    if (obj.constructor.name === 'Error') {
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

  private isPrimitive(obj: any): boolean {
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

  private formatMeta(args?: any[]): IFormattedMeta {
    const errors: IFormattedMetaError[] = [];

    return {
      properties: this.formatProperty(args, errors),
      errors
    };
  }

  private getErrorStack(err: Error, id: IFormattedMetaErrorId): string {
    const stack =
      typeof err.stack !== 'undefined'
        ? err.stack
        : err.toString();

    return `@${id}: ${stack}`;
  }

  private formatProperty(prop: any, errors: IFormattedMetaError[]): IFormattedProperty {
    if (this.isError(prop)) {
      const id = errors.length;

      errors.push({ error: prop, id });

      return { error: this.formatError(prop, id) };
    }

    if (this.isPrimitive(prop)) {
      return prop;
    }

    if (prop instanceof Date) {
      return { timestamp: this.formatDate(prop) };
    }

    if (prop instanceof Buffer) {
      return { buffer: this.formatBuffer(prop) };
    }

    if (Array.isArray(prop)) {
      return { array: this.formatArray(prop, errors) };
    }

    if (typeof prop === 'function') {
      return { function: this.formatFunction(prop) };
    }

    if (typeof prop !== 'object') {
      if (typeof prop.toString === 'function') {
        return prop.toString();
      }

      return null;
    }

    const properties: { [key: string]: IFormattedProperty } = {};

    for (let key in prop) {
      const value = prop[key];

      properties[key] = this.formatProperty(value, errors);
    }

    return properties;
  }

  private formatError(err: Error, id: IFormattedMetaErrorId) {
    const result =
      Object.getOwnPropertyNames(err)
        .filter(key => key !== 'stack')
        .reduce<{ [key: string]: any }>((res, key: keyof Error) => {
          res[key] = err[key];

          return res;
        }, {});

    result.stack = `@${id}`;

    return result;
  }

  private formatDate(date: Date): number {
    return date.getTime();
  }

  private formatFunction(fn: Function): string {
    return fn.toString();
  }

  private formatArray(arr: any[], errors: IFormattedMetaError[]): IFormattedProperty[] {
    return arr.map(val => this.formatProperty(val, errors));
  }

  private formatBuffer(buffer: Buffer) {
    return buffer.slice(0);
  }
}
