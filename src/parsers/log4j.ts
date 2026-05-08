import type { LogEntry } from '../types';
import type { LogParser } from './types';

/**
 * Log4j / Logback pattern layout parser.
 *
 * Handles common patterns including:
 *   2026-05-07 06:30:22.090 [main] INFO  tenantId=[] mtxs=[] x-process-id=[] x-crid=[] c.e.App : Message
 *   2026-05-07T06:29:49,188+0000 [1 1] com.newrelic INFO: Message
 *   [otel.javaagent 2026-05-07 06:30:26:684 +0000] [thread] WARN io.otel.Exporter - Message
 *   06:30:01,993 |-INFO in ch.qos.logback.classic.LoggerContext[default] - Message
 *   2026-05-08 10:30:00.123 [http-nio-8080-exec-1] ERROR c.e.Controller - Something failed
 *
 * Multiline handling: Lines that don't start with a recognized timestamp
 * pattern are appended to the previous entry's stack_trace.
 */

// ── Timestamp patterns ────────────────────────────────────────────────────────
const TIMESTAMP_PATTERNS: Array<{ regex: RegExp; otel?: boolean }> = [
  // [otel.javaagent 2026-05-07 06:30:26:684 +0000]
  { regex: /^\[(\S+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}:\d{3})\s*([+-]\d{4})?\]\s*/, otel: true },
  // yyyy-MM-ddTHH:mm:ss,SSS+ZZZZ or yyyy-MM-ddTHH:mm:ss.SSS+ZZZZ
  { regex: /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.,]\d{1,3})([+-]\d{4})?\s*/ },
  // yyyy-MM-dd HH:mm:ss.SSS
  { regex: /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}[.,]\d{1,3})\s*/ },
  // HH:mm:ss,SSS (logback internal, time-only)
  { regex: /^(\d{2}:\d{2}:\d{2}[.,]\d{1,3})\s*/ },
];

// ── Level detection ───────────────────────────────────────────────────────────
const LEVEL_REGEX = /\b(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\b/i;

// ── MDC key=value pattern ─────────────────────────────────────────────────────
const MDC_PAIR_REGEX = /^([\w.-]+)=\[([^\]]*)\]\s*/;

// ── Logback internal pattern ──────────────────────────────────────────────────
const LOGBACK_INTERNAL_REGEX = /^\|-(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s+in\s+(\S+)\s*-\s*(.*)/i;

interface ParsedLine {
  timestamp: string;
  level: string;
  thread?: string;
  logger?: string;
  message: string;
  mdc: Record<string, string>;
  prefix?: string;
}

function normalizeLevel(level: string): string {
  const l = level.toUpperCase();
  if (l === 'TRACE') return 'DEBUG';
  if (l === 'FATAL') return 'ERROR';
  return l;
}

function normalizeTimestamp(raw: string, tz?: string): string {
  let ts = raw.replace(/(\d{2}:\d{2}:\d{2}):(\d{3})/, '$1.$2');
  ts = ts.replace(',', '.');
  if (/^\d{4}-\d{2}-\d{2}\s/.test(ts)) {
    ts = ts.replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T');
  }
  if (/^\d{2}:\d{2}:\d{2}/.test(ts) && !ts.includes('-')) {
    const today = new Date().toISOString().slice(0, 10);
    ts = `${today}T${ts}`;
  }
  if (tz) {
    ts += tz.replace(/(\d{2})(\d{2})$/, '$1:$2');
  }
  return ts;
}

function tryParseLine(line: string): ParsedLine | null {
  let rest = line;
  let timestamp = '';
  let prefix: string | undefined;

  // Try each timestamp pattern
  let matched = false;
  for (const { regex, otel } of TIMESTAMP_PATTERNS) {
    const m = regex.exec(rest);
    if (m) {
      if (otel) {
        prefix = m[1];
        timestamp = normalizeTimestamp(m[2], m[3]);
      } else {
        timestamp = normalizeTimestamp(m[1], m[2]);
      }
      rest = rest.slice(m[0].length);
      matched = true;
      break;
    }
  }

  if (!matched) return null;

  // Check for logback internal format: |-LEVEL in class - message
  const logbackM = LOGBACK_INTERNAL_REGEX.exec(rest);
  if (logbackM) {
    return {
      timestamp,
      level: normalizeLevel(logbackM[1]),
      logger: logbackM[2],
      message: logbackM[3],
      mdc: {},
      prefix,
    };
  }

  // Try to extract [thread]
  let thread: string | undefined;
  const threadMatch = rest.match(/^\[([^\]]+)\]\s*/);
  if (threadMatch) {
    thread = threadMatch[1];
    rest = rest.slice(threadMatch[0].length);
  }

  // Extract level
  const levelMatch = LEVEL_REGEX.exec(rest);
  if (!levelMatch) {
    return {
      timestamp,
      level: 'INFO',
      thread,
      message: rest.trim(),
      mdc: {},
      prefix,
    };
  }

  const level = normalizeLevel(levelMatch[1]);
  rest = rest.slice(levelMatch.index! + levelMatch[0].length).replace(/^\s*:?\s*/, '');

  // If thread wasn't found before level, try after
  if (!thread) {
    const threadAfter = rest.match(/^\[([^\]]+)\]\s*/);
    if (threadAfter) {
      thread = threadAfter[1];
      rest = rest.slice(threadAfter[0].length);
    }
  }

  // Extract MDC key=value pairs (e.g., tenantId=[] mtxs=[] x-process-id=[])
  const mdc: Record<string, string> = {};
  while (true) {
    const mdcMatch = MDC_PAIR_REGEX.exec(rest);
    if (!mdcMatch) break;
    const key = mdcMatch[1];
    const value = mdcMatch[2];
    if (value) mdc[key] = value;
    rest = rest.slice(mdcMatch[0].length);
  }

  // Extract logger name (non-space characters before separator : or -)
  let logger: string | undefined;
  const loggerMatch = rest.match(/^(\S+)\s*[:|-]\s*/);
  if (loggerMatch) {
    logger = loggerMatch[1];
    rest = rest.slice(loggerMatch[0].length);
  }

  return {
    timestamp,
    level,
    thread,
    logger,
    message: rest.trim(),
    mdc,
    prefix,
  };
}

function isNewEntry(line: string): boolean {
  const trimmed = line.trimStart();
  for (const { regex } of TIMESTAMP_PATTERNS) {
    if (regex.test(trimmed)) return true;
  }
  return false;
}

export const log4jParser: LogParser = {
  format: 'log4j',

  detect(sampleLines: string[]): number {
    let matches = 0;
    for (const line of sampleLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (tryParseLine(trimmed)) matches++;
    }
    return sampleLines.length > 0 ? matches / sampleLines.length : 0;
  },

  parse(content: string): LogEntry[] {
    const logs: LogEntry[] = [];
    const lines = content.split('\n');
    let currentEntry: LogEntry | null = null;

    for (const line of lines) {
      const raw = line.trimEnd();
      if (!raw) continue;

      // Skip known non-log lines (JVM warnings, Spring Boot banner)
      if (
        raw.startsWith('Picked up JAVA_TOOL_OPTIONS') ||
        raw.startsWith('OpenJDK 64-Bit Server VM warning')
      ) {
        continue;
      }

      // Try to parse as new log entry
      if (isNewEntry(raw)) {
        const parsed = tryParseLine(raw.trimStart());
        if (parsed) {
          // Flush previous entry
          if (currentEntry) logs.push(currentEntry);

          const entry: LogEntry = {
            '@timestamp': parsed.timestamp,
            level: parsed.level,
            message: parsed.message,
            thread_name: parsed.thread,
            logger_name: parsed.logger,
          };

          // Add MDC fields
          if (parsed.mdc.tenantId) entry.tenantId = parsed.mdc.tenantId;
          if (parsed.mdc.mtxs) entry.mtxs = parsed.mdc.mtxs;
          for (const [key, value] of Object.entries(parsed.mdc)) {
            if (key !== 'tenantId' && key !== 'mtxs' && value) {
              entry[key] = value;
            }
          }

          if (parsed.prefix) {
            entry['source'] = parsed.prefix;
          }

          currentEntry = entry;
          continue;
        }
      }

      // Continuation line (stack trace or multiline message)
      if (currentEntry) {
        if (currentEntry.stack_trace) {
          currentEntry.stack_trace += '\n' + raw;
        } else {
          currentEntry.stack_trace = raw;
        }
      }
    }

    // Flush last entry
    if (currentEntry) logs.push(currentEntry);

    return logs;
  },
};

