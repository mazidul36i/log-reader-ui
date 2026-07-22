import type { LogEntry } from '../types';
import type { LogParser } from './types';

/**
 * CSV / TSV log parser.
 *
 * Auto-detects delimiter (comma vs tab) from the header row.
 * Maps columns to LogEntry fields by matching known column names.
 *
 * Known field mappings:
 *   timestamp/time/date/@timestamp → @timestamp
 *   level/severity/log_level       → level
 *   message/msg/log                → message
 *   thread/thread_name             → thread_name
 *   logger/logger_name/class       → logger_name
 *   trace_id/traceId              → traceId
 *   span_id/spanId                → spanId
 */

const TIMESTAMP_COLUMNS = new Set([
  'timestamp', 'time', 'date', '@timestamp', 'datetime', 'ts', 'log_time', 'created_at',
]);
const LEVEL_COLUMNS = new Set([
  'level', 'severity', 'log_level', 'loglevel', 'priority',
]);
const MESSAGE_COLUMNS = new Set([
  'message', 'msg', 'log', 'text', 'body', 'content',
]);
const THREAD_COLUMNS = new Set(['thread', 'thread_name', 'threadname']);
const LOGGER_COLUMNS = new Set(['logger', 'logger_name', 'loggername', 'class', 'category']);
const TRACE_COLUMNS = new Set(['trace_id', 'traceId', 'traceid', 'trace']);
const SPAN_COLUMNS = new Set(['span_id', 'spanId', 'spanid', 'span']);

function detectDelimiter(headerLine: string): string {
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function looksLikeHeader(columns: string[]): boolean {
  const normalized = columns.map((c) => c.toLowerCase().replace(/['"]/g, ''));
  // Must have at least one timestamp-like and one level-like column
  const hasTimestamp = normalized.some((c) => TIMESTAMP_COLUMNS.has(c));
  const hasLevel = normalized.some((c) => LEVEL_COLUMNS.has(c));
  const hasMessage = normalized.some((c) => MESSAGE_COLUMNS.has(c));
  return hasTimestamp && (hasLevel || hasMessage);
}

export const csvParser: LogParser = {
  format: 'csv',

  detect(sampleLines: string[]): number {
    if (sampleLines.length < 2) return 0;
    const firstLine = sampleLines[0].trim();
    const delimiter = detectDelimiter(firstLine);
    const columns = splitCsvLine(firstLine, delimiter);

    if (columns.length < 2) return 0;
    if (!looksLikeHeader(columns)) return 0;

    // Check that subsequent lines have same number of fields
    let consistent = 0;
    for (let i = 1; i < Math.min(sampleLines.length, 5); i++) {
      const fields = splitCsvLine(sampleLines[i].trim(), delimiter);
      if (Math.abs(fields.length - columns.length) <= 1) consistent++;
    }
    return consistent / Math.min(sampleLines.length - 1, 4);
  },

  parse(content: string): LogEntry[] {
    const lines = content.split('\n');
    if (lines.length < 2) return [];

    const headerLine = lines[0].trim();
    const delimiter = detectDelimiter(headerLine);
    const columns = splitCsvLine(headerLine, delimiter).map((c) =>
      c.toLowerCase().replace(/['"]/g, ''),
    );

    // Build column index mappings
    let tsIdx = -1, levelIdx = -1, msgIdx = -1, threadIdx = -1;
    let loggerIdx = -1, traceIdx = -1, spanIdx = -1;

    columns.forEach((col, i) => {
      if (tsIdx < 0 && TIMESTAMP_COLUMNS.has(col)) tsIdx = i;
      else if (levelIdx < 0 && LEVEL_COLUMNS.has(col)) levelIdx = i;
      else if (msgIdx < 0 && MESSAGE_COLUMNS.has(col)) msgIdx = i;
      else if (threadIdx < 0 && THREAD_COLUMNS.has(col)) threadIdx = i;
      else if (loggerIdx < 0 && LOGGER_COLUMNS.has(col)) loggerIdx = i;
      else if (traceIdx < 0 && TRACE_COLUMNS.has(col)) traceIdx = i;
      else if (spanIdx < 0 && SPAN_COLUMNS.has(col)) spanIdx = i;
    });

    if (tsIdx < 0) return []; // Can't parse without timestamps

    const logs: LogEntry[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields = splitCsvLine(line, delimiter);
      const timestamp = fields[tsIdx];
      if (!timestamp) continue;

      const entry: LogEntry = {
        '@timestamp': timestamp,
        level: (levelIdx >= 0 ? fields[levelIdx] || 'INFO' : 'INFO').toUpperCase(),
        message: msgIdx >= 0 ? fields[msgIdx] || '' : '',
        thread_name: threadIdx >= 0 ? fields[threadIdx] || undefined : undefined,
        logger_name: loggerIdx >= 0 ? fields[loggerIdx] || undefined : undefined,
        traceId: traceIdx >= 0 ? fields[traceIdx] || undefined : undefined,
        spanId: spanIdx >= 0 ? fields[spanIdx] || undefined : undefined,
      };

      // Add remaining columns as dynamic fields
      columns.forEach((col, idx) => {
        if (
          idx !== tsIdx && idx !== levelIdx && idx !== msgIdx &&
          idx !== threadIdx && idx !== loggerIdx && idx !== traceIdx && idx !== spanIdx &&
          fields[idx]
        ) {
          entry[col] = fields[idx];
        }
      });

      logs.push(entry);
    }
    return logs;
  },
};

/** TSV parser — same logic but forces tab delimiter. */
export const tsvParser: LogParser = {
  format: 'tsv',

  detect(sampleLines: string[]): number {
    if (sampleLines.length < 2) return 0;
    const firstLine = sampleLines[0].trim();
    // Only match if tabs are the dominant delimiter
    const tabCount = (firstLine.match(/\t/g) || []).length;
    if (tabCount < 1) return 0;

    const columns = firstLine.split('\t').map((c) => c.trim().toLowerCase().replace(/['"]/g, ''));
    if (columns.length < 2) return 0;

    const hasTimestamp = columns.some((c) => TIMESTAMP_COLUMNS.has(c));
    if (!hasTimestamp) return 0;

    let consistent = 0;
    for (let i = 1; i < Math.min(sampleLines.length, 5); i++) {
      const fields = sampleLines[i].split('\t');
      if (Math.abs(fields.length - columns.length) <= 1) consistent++;
    }
    return (consistent / Math.min(sampleLines.length - 1, 4)) * 0.95; // slightly below CSV to avoid tie
  },

  parse(content: string): LogEntry[] {
    // Reuse CSV parser with forced tab detection
    return csvParser.parse(content);
  },
};

