import type { LogEntry } from '../types';
import type { LogParser } from './types';

/**
 * Log4j / Logback pattern layout parser.
 *
 * Handles common patterns like:
 *   2026-05-08 10:30:00.123 [main] INFO  com.example.App - Application started
 *   2026-05-08T10:30:00,123 [http-nio-8080-exec-1] ERROR c.e.Controller - Something failed
 *   08-05-2026 10:30:00 INFO  [thread-1] logger.Name: message
 *
 * Multiline handling: Lines that don't start with a recognized timestamp
 * pattern are appended to the previous entry's stack_trace.
 */

// ISO-style: 2026-05-08 10:30:00.123 or 2026-05-08T10:30:00,123
// Also handles: 08-05-2026 10:30:00
const TIMESTAMP_PATTERNS = [
  // yyyy-MM-dd HH:mm:ss[.SSS] or yyyy-MM-ddTHH:mm:ss[,SSS]
  /^(\d{4}[-/]\d{2}[-/]\d{2}[T ]\d{2}:\d{2}:\d{2}[.,]?\d{0,3})/,
  // dd-MM-yyyy HH:mm:ss[.SSS]
  /^(\d{2}[-/]\d{2}[-/]\d{4}\s+\d{2}:\d{2}:\d{2}[.,]?\d{0,3})/,
];

// After timestamp: [thread] LEVEL logger - message
// Variations:
//   [thread] LEVEL  logger - message
//   LEVEL [thread] logger - message
//   [thread] LEVEL logger : message
const PATTERN_A = /^\s*\[([^\]]+)\]\s+(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s+(\S+)\s*[-:]\s*(.*)/i;
const PATTERN_B = /^\s*(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s+\[([^\]]+)\]\s+(\S+)\s*[-:]\s*(.*)/i;
const PATTERN_C = /^\s*\[([^\]]+)\]\s+(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s+(.*)/i;
const PATTERN_D = /^\s*(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s+\[([^\]]+)\]\s+(.*)/i;
// Simplest: just level + message
const PATTERN_E = /^\s*(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s+(.*)/i;

function normalizeTimestamp(ts: string): string {
  // Replace comma with dot for millis, ensure T separator
  let normalized = ts.replace(',', '.');
  if (normalized[10] === ' ') {
    normalized = normalized.slice(0, 10) + 'T' + normalized.slice(11);
  }
  // Handle dd-MM-yyyy → yyyy-MM-dd
  if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(normalized)) {
    const parts = normalized.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(.*)/);
    if (parts) {
      normalized = `${parts[3]}-${parts[2]}-${parts[1]}${parts[4]}`;
    }
  }
  return normalized;
}

function normalizeLevel(level: string): string {
  const l = level.toUpperCase();
  if (l === 'TRACE') return 'DEBUG';
  if (l === 'FATAL') return 'ERROR';
  return l;
}

function parseAfterTimestamp(rest: string): { thread?: string; level: string; logger?: string; message: string } | null {
  let m: RegExpExecArray | null;

  // Pattern A: [thread] LEVEL logger - message
  m = PATTERN_A.exec(rest);
  if (m) return { thread: m[1], level: normalizeLevel(m[2]), logger: m[3], message: m[4] };

  // Pattern B: LEVEL [thread] logger - message
  m = PATTERN_B.exec(rest);
  if (m) return { thread: m[2], level: normalizeLevel(m[1]), logger: m[3], message: m[4] };

  // Pattern C: [thread] LEVEL message (no logger separator)
  m = PATTERN_C.exec(rest);
  if (m) return { thread: m[1], level: normalizeLevel(m[2]), message: m[3] };

  // Pattern D: LEVEL [thread] message
  m = PATTERN_D.exec(rest);
  if (m) return { thread: m[2], level: normalizeLevel(m[1]), message: m[3] };

  // Pattern E: LEVEL message
  m = PATTERN_E.exec(rest);
  if (m) return { level: normalizeLevel(m[1]), message: m[2] };

  return null;
}

function detectTimestamp(line: string): { timestamp: string; rest: string } | null {
  for (const pattern of TIMESTAMP_PATTERNS) {
    const m = pattern.exec(line);
    if (m) {
      return { timestamp: normalizeTimestamp(m[1]), rest: line.slice(m[1].length) };
    }
  }
  return null;
}

export const log4jParser: LogParser = {
  format: 'log4j',

  detect(sampleLines: string[]): number {
    let matches = 0;
    for (const line of sampleLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const tsResult = detectTimestamp(trimmed);
      if (tsResult) {
        const parsed = parseAfterTimestamp(tsResult.rest);
        if (parsed) matches++;
      }
    }
    return sampleLines.length > 0 ? matches / sampleLines.length : 0;
  },

  parse(content: string): LogEntry[] {
    const logs: LogEntry[] = [];
    const lines = content.split('\n');
    let currentEntry: LogEntry | null = null;

    for (const line of lines) {
      const trimmed = line.trimEnd(); // preserve leading whitespace for stack traces
      if (!trimmed) continue;

      const tsResult = detectTimestamp(trimmed.trimStart());
      if (tsResult) {
        const parsed = parseAfterTimestamp(tsResult.rest);
        if (parsed) {
          // Flush previous entry
          if (currentEntry) logs.push(currentEntry);

          currentEntry = {
            '@timestamp': tsResult.timestamp,
            level: parsed.level,
            message: parsed.message,
            thread_name: parsed.thread,
            logger_name: parsed.logger,
          } as LogEntry;
          continue;
        }
      }

      // Continuation line (stack trace or multiline message)
      if (currentEntry) {
        if (currentEntry.stack_trace) {
          currentEntry.stack_trace += '\n' + trimmed;
        } else {
          currentEntry.stack_trace = trimmed;
        }
      }
    }

    // Flush last entry
    if (currentEntry) logs.push(currentEntry);

    return logs;
  },
};

