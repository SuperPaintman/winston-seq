'use strict';
/** Interfaces */
export interface ISeqLoggerConfig {
  serverUrl?:       string;
  apiKey?:          string;
  maxBatchingTime?: number;
  eventSizeLimit?:  number;
  batchSizeLimit?:  number;
  onError?:         (err: Error) => void;
}

export type ISeqLevels =
  | 'Verbose'
  | 'Debug'
  | 'Information'
  | 'Warning'
  | 'Error'
  | 'Fatal'
  ;

export interface ISeqEvent {
  timestamp?:       Date;
  level?:           ISeqLevels;
  messageTemplate?: string;
  exception?:       string;
  properties?: {
    [key: string]:    any;
  };
}

export interface ISeqLogger {
  close(): Promise<boolean>;
  flush(): Promise<boolean>;
  emit(event: ISeqEvent): void;
}

export interface ISeqLoggerStatic {
  new (config?: ISeqLoggerConfig): ISeqLogger;
}


/** Init */
/** @todo */
// tslint:disable-next-line: variable-name
const SeqLogger: ISeqLoggerStatic = require('seq-logging').Logger;

export default SeqLogger as ISeqLoggerStatic;
