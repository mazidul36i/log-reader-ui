import type { LogEntry } from '../types';

/** Supported log formats. */
export type LogFormat = 'json-lines' | 'common-log' | 'syslog' | 'log4j' | 'csv' | 'tsv';

/** Interface that every parser must implement. */
export interface LogParser {
  /** Unique format identifier. */
  format: LogFormat;

  /**
   * Confidence score (0–1) that the given sample lines match this format.
   * Called with the first 10 non-empty lines of a file.
   */
  detect(sampleLines: string[]): number;

  /**
   * Parse the full file content into normalized LogEntry objects.
   * Must handle multiline entries (stack traces, continuation lines).
   */
  parse(content: string): LogEntry[];
}

