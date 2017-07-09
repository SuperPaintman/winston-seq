'use strict';
/** Imports */
import { transports, TransportInstance, Transport }     from 'winston';

import SeqLogger, { ISeqLogger, ISeqEvent, ISeqLevels } from './seq-logging';


/** Interfaces */
type IErrorExchange = { error: Error, id: number }[];

export type IWinstonLogCallback = (err?: any, res?: any) => void;

export interface ISeqOption {
  serverUrl?:       string;
  apiKey?:          string;
  maxBatchingTime?: number;
  eventSizeLimit?:  number;
  batchSizeLimit?:  number;
  levelMapper?(level: string): ISeqLevels;
}

export interface ISeqTransportInstance extends TransportInstance {
  new (options?: ISeqOption): ISeqTransportInstance;
}

declare module 'winston' {
  // tslint:disable-next-line: interface-name
  interface Transports {
    Seq: ISeqTransportInstance;
  }
}


export class Seq extends Transport implements ISeqTransportInstance {
  readonly name = 'seq';

  serverUrl?:       string;
  apiKey?:          string;
  maxBatchingTime?: number;
  eventSizeLimit?:  number;
  batchSizeLimit?:  number;
  levelMapper:      (level: string) => ISeqLevels;

  private _seq: ISeqLogger;

  constructor(options: ISeqOption = {}) {
    super(options);

    this.serverUrl       = options.serverUrl;
    this.apiKey          = options.apiKey;
    this.maxBatchingTime = options.maxBatchingTime;
    this.eventSizeLimit  = options.eventSizeLimit;
    this.batchSizeLimit  = options.batchSizeLimit;
    this.levelMapper     = options.levelMapper !== undefined
                         ? options.levelMapper
                         : this._levelMapper;

    this.connect();
  }

  log(level: string, msg: string, meta: any, callback: IWinstonLogCallback): void {
    const seqLog: ISeqEvent = {
      level:           this.levelMapper(level),
      messageTemplate: msg
    };

    const { properties, errors } = this._formatMeta(meta);

    if (errors.length !== 0) {
      seqLog.exception = errors
        .map(({ error, id }) => this._getErrorStach(error, id))
        .join('\n\n');
    }

    if (properties !== null) {
      seqLog.properties = properties;
    }

    this._seq.emit(seqLog);

    this.emit('logged');
    callback(null, true);
  }

  connect(): Promise<void> {
    this._seq = new SeqLogger({
      serverUrl:       this.serverUrl,
      apiKey:          this.apiKey,
      maxBatchingTime: this.maxBatchingTime,
      eventSizeLimit:  this.eventSizeLimit,
      batchSizeLimit:  this.batchSizeLimit,
      onError:         (err) => this.emit('error', err)
    });

    return Promise.resolve();
  }

  close(): Promise<boolean> {
    return this._seq.close();
  }

  flush(): Promise<boolean> {
    return this._seq.flush();
  }

  private _isError(obj?: any): boolean {
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
    if (typeof obj.name       === 'string'
        && typeof obj.message === 'string'
        && typeof obj.stack   === 'string') {
      return true;
    }

    return false;
  }

  private _isPrimitive(obj: any) {
    if (obj === null || obj === undefined) {
      return true;
    }

    const typeOfObj = typeof obj;

    return typeOfObj === 'string'
        || typeOfObj === 'number'
        || typeOfObj === 'boolean';
  }

  private _levelMapper(level: string = ''): ISeqLevels {
    switch (level.toLowerCase()) {
      case 'error':         return 'Error';
      case 'warn':          return 'Warning';
      case 'info':          return 'Information';
      case 'debug':         return 'Debug';
      case 'verbose':       return 'Verbose';
      case 'silly':         return 'Verbose';

      /** Non standart */
      case 'fatal':         return 'Fatal';

      default:              return 'Information';
    }
  }

  private _formatMeta(meta: any): {
    properties: Object | null
    errors:     IErrorExchange
  } {
    /** Flat error list */
    const errors: IErrorExchange = [];

    return {
      properties: this._formatProperty(meta, errors),
      errors
    };
  }

  private _getErrorStach(err: Error, id: number): string {
    const stack = err.stack !== undefined
           ? err.stack
           : err.toString();

    return `@${id}: ${stack}`;
  }

  private _formatProperty(prop: any, errors: IErrorExchange) {
    if (this._isError(prop)) {
      const id = errors.length;

      errors.push({ error: prop, id });

      return { error: this._formatError(prop, id) };
    }

    if (prop instanceof Date) {
      return { timestamp: this._formatDate(prop) };
    }

    if (typeof prop === 'function') {
      return { function: this._formatFunction(prop) };
    }

    if (prop instanceof Buffer) {
      return { buffer: this._formatBuffer(prop) };
    }

    if (Array.isArray(prop)) {
      return { array: this._formatArray(prop, errors) };
    }

    if (this._isPrimitive(prop)) {
      return prop;
    }

    if (typeof prop !== 'object') {
      if (typeof prop.toString === 'function') {
        return prop.toString();
      }

      return null;
    }

    const properties: any = {};

    for (let key in prop) {
      const value = prop[key];

      properties[key] = this._formatProperty(value, errors);
    }

    return properties;
  }

  private _formatError(err: Error, id: number) {
    const result = Object.getOwnPropertyNames(err)
      .filter((key) => key !== 'stack')
      .reduce((res, key) => {
        res[key] = (err as any)[key];

        return res;
      }, {} as any);

    result.stack = `@${id}`;

    return result;
  }

  private _formatDate(date: Date): number {
    return date.getTime();
  }

  private _formatFunction(fn: Function): string {
    return fn.toString();
  }

  private _formatArray(arr: any[], errors: IErrorExchange): any[] {
    return arr.slice(0).map((val) => this._formatProperty(val, errors));
  }

  private _formatBuffer(buffer: Buffer) {
    return buffer.slice(0);
  }
}

/**
 * Define a getter so that `winston.transports.Seq`
 * is available and thus backwards compatible.
 */
transports.Seq = Seq as any; /** @todo */
