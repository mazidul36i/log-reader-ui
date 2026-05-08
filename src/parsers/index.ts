/**
 * Multi-format log parser with auto-detection.
 *
 * Detects the format from the first 10 non-empty lines, then delegates
 * to the appropriate parser. Falls back to JSON-lines.
 */

import type { LogEntry } from '../types';
import type { LogParser, LogFormat } from './types';
import { jsonLinesParser } from './jsonLines';
import { commonLogParser } from './commonLog';
import { syslogParser } from './syslog';
import { log4jParser } from './log4j';
import { csvParser, tsvParser } from './csv';

// ── Parser registry (ordered by detection priority) ───────────────────────────
const parsers: LogParser[] = [
  jsonLinesParser,
  syslogParser,     // syslog before log4j (both have timestamps, but syslog has <PRI>)
  commonLogParser,
  log4jParser,
  csvParser,
  tsvParser,
];

/** Detection threshold — parser must score at least this to be selected. */
const CONFIDENCE_THRESHOLD = 0.5;

/** Number of sample lines to use for format detection. */
const SAMPLE_SIZE = 10;

/**
 * Detect the log format from a content string.
 * Returns the best-matching parser (or JSON-lines as fallback).
 */
export function detectFormat(content: string): { parser: LogParser; format: LogFormat } {
  // Extract sample lines for detection
  const lines = content.split('\n');
  const sampleLines: string[] = [];
  for (let i = 0; i < lines.length && sampleLines.length < SAMPLE_SIZE; i++) {
    const trimmed = lines[i].trim();
    if (trimmed) sampleLines.push(trimmed);
  }

  if (sampleLines.length === 0) {
    return { parser: jsonLinesParser, format: 'json-lines' };
  }

  // Score each parser
  let bestParser: LogParser = jsonLinesParser;
  let bestScore = 0;

  for (const parser of parsers) {
    const score = parser.detect(sampleLines);
    if (score > bestScore) {
      bestScore = score;
      bestParser = parser;
    }
  }

  // Fall back to JSON-lines if nothing passes threshold
  if (bestScore < CONFIDENCE_THRESHOLD) {
    return { parser: jsonLinesParser, format: 'json-lines' };
  }

  return { parser: bestParser, format: bestParser.format };
}

/**
 * Parse a file's content into normalized LogEntry objects.
 * Auto-detects the format and delegates to the appropriate parser.
 */
export function parseContent(content: string): LogEntry[] {
  const { parser } = detectFormat(content);
  return parser.parse(content);
}

// Re-export types and individual parsers for testing
export type { LogParser, LogFormat } from './types';
export { jsonLinesParser } from './jsonLines';
export { commonLogParser } from './commonLog';
export { syslogParser } from './syslog';
export { log4jParser } from './log4j';
export { csvParser, tsvParser } from './csv';

