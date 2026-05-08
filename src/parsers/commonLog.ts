import type { LogEntry } from '../types';
import type { LogParser } from './types';

/**
 * Common Log Format / Combined Log Format parser.
 *
 * CLF:      host ident authuser [date] "request" status bytes
 * Combined: host ident authuser [date] "request" status bytes "referer" "useragent"
 *
 * Examples:
 *   127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326
 *   ::1 - - [08/May/2026:10:12:33 +0530] "POST /api/users HTTP/1.1" 500 1234 "-" "curl/7.68"
 */

// Regex captures: host, ident, authuser, dateStr, request, status, bytes, referer?, useragent?
const CLF_REGEX =
  /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d{3})\s+(\d+|-)\s*(?:"([^"]*)")?\s*(?:"([^"]*)")?$/;

// Parse CLF date: "10/Oct/2000:13:55:36 -0700"
const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function parseClfDate(dateStr: string): string {
  // Format: dd/Mon/yyyy:HH:mm:ss ±zzzz
  const m = dateStr.match(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+-]\d{4})?/);
  if (!m) return '';
  const [, day, mon, year, h, min, sec, tz] = m;
  const month = MONTHS[mon] || '01';
  const tzFormatted = tz ? `${tz.slice(0, 3)}:${tz.slice(3)}` : '+00:00';
  return `${year}-${month}-${day}T${h}:${min}:${sec}${tzFormatted}`;
}

function statusToLevel(status: string): string {
  const code = parseInt(status, 10);
  if (code >= 500) return 'ERROR';
  if (code >= 400) return 'WARN';
  if (code >= 300) return 'INFO';
  return 'INFO';
}

export const commonLogParser: LogParser = {
  format: 'common-log',

  detect(sampleLines: string[]): number {
    let matches = 0;
    for (const line of sampleLines) {
      if (CLF_REGEX.test(line.trim())) matches++;
    }
    return sampleLines.length > 0 ? matches / sampleLines.length : 0;
  },

  parse(content: string): LogEntry[] {
    const logs: LogEntry[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const m = CLF_REGEX.exec(trimmed);
      if (!m) continue;

      const [, host, , authuser, dateStr, request, status, bytes, referer, useragent] = m;
      const timestamp = parseClfDate(dateStr);
      if (!timestamp) continue;

      logs.push({
        '@timestamp': timestamp,
        level: statusToLevel(status),
        message: request,
        host,
        authuser: authuser !== '-' ? authuser : undefined,
        status: parseInt(status, 10),
        bytes: bytes !== '-' ? parseInt(bytes, 10) : 0,
        referer: referer && referer !== '-' ? referer : undefined,
        useragent: useragent && useragent !== '-' ? useragent : undefined,
      } as LogEntry);
    }
    return logs;
  },
};

