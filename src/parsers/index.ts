/**
 * Multi-format log parser with auto-detection.
 *
 * Samples up to 50 non-empty lines spread across the file to detect format,
 * then delegates to the highest-confidence parser.
 * Falls back to JSON-lines only if no parser scored above 0.
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

/** Number of sample lines to use for format detection. */
const SAMPLE_SIZE = 50;

/**
 * Detect the log format from a content string.
 * Returns the best-matching parser (or JSON-lines as fallback).
 *
 * Strategy: sample lines from the beginning and middle of the file
 * to avoid being fooled by startup noise (JVM warnings, banners, etc.).
 */
export function detectFormat(content: string): { parser: LogParser; format: LogFormat } {
  const lines = content.split('\n');

  // Collect sample lines: first 30 + 20 from middle of file
  const sampleLines: string[] = [];
  const firstBatch = Math.min(lines.length, 200);
  for (let i = 0; i < firstBatch && sampleLines.length < 30; i++) {
    const trimmed = lines[i].trim();
    if (trimmed) sampleLines.push(trimmed);
  }
  // Also sample from 25% into the file (past startup noise)
  const midStart = Math.floor(lines.length * 0.25);
  for (let i = midStart; i < lines.length && sampleLines.length < SAMPLE_SIZE; i++) {
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

  // Use the best parser if it scored anything at all
  if (bestScore > 0) {
    return { parser: bestParser, format: bestParser.format };
  }

  // Absolute fallback
  return { parser: jsonLinesParser, format: 'json-lines' };
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

