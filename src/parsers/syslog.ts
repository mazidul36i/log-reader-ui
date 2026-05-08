import type { LogEntry } from '../types';
import type { LogParser } from './types';

/**
 * Syslog RFC 5424 parser.
 *
 * Format: <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID [STRUCTURED-DATA] MSG
 *
 * Examples:
 *   <134>1 2026-05-08T10:30:00.123Z myhost myapp 1234 ID47 - Application started
 *   <27>1 2026-05-08T10:30:01Z server sshd 5678 - [meta key="val"] Failed password for root
 *
 * Also handles BSD-style syslog (RFC 3164):
 *   <134>May  8 10:30:00 myhost myapp[1234]: Application started
 */

// RFC 5424
const RFC5424_REGEX =
  /^<(\d{1,3})>(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(?:\[([^\]]*)\]|-)\s*(.*)/;

// BSD/RFC 3164
const BSD_REGEX =
  /^<(\d{1,3})>(\w{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s*(.*)/;

// Syslog severity to level mapping (RFC 5424 §6.2.1)
const SEVERITY_LEVELS = ['ERROR', 'ERROR', 'ERROR', 'ERROR', 'WARN', 'INFO', 'INFO', 'DEBUG'];

function priToLevel(pri: string): string {
  const severity = parseInt(pri, 10) & 0x07; // low 3 bits
  return SEVERITY_LEVELS[severity] || 'INFO';
}

function parseBsdTimestamp(month: string, day: string, time: string): string {
  const year = new Date().getFullYear();
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };
  const mm = months[month] || '01';
  const dd = day.padStart(2, '0');
  return `${year}-${mm}-${dd}T${time}Z`;
}

export const syslogParser: LogParser = {
  format: 'syslog',

  detect(sampleLines: string[]): number {
    let matches = 0;
    for (const line of sampleLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('<') && /^<\d{1,3}>/.test(trimmed)) {
        matches++;
      }
    }
    return sampleLines.length > 0 ? matches / sampleLines.length : 0;
  },

  parse(content: string): LogEntry[] {
    const logs: LogEntry[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Try RFC 5424 first
      let m = RFC5424_REGEX.exec(trimmed);
      if (m) {
        const [, pri, , timestamp, hostname, appName, procId, , , msg] = m;
        logs.push({
          '@timestamp': timestamp,
          level: priToLevel(pri),
          message: msg || '',
          logger_name: appName !== '-' ? appName : undefined,
          thread_name: procId !== '-' ? procId : undefined,
          host: hostname !== '-' ? hostname : undefined,
        } as LogEntry);
        continue;
      }

      // Try BSD format
      m = BSD_REGEX.exec(trimmed);
      if (m) {
        const [, pri, month, day, time, hostname, appName, pid, msg] = m;
        logs.push({
          '@timestamp': parseBsdTimestamp(month, day, time),
          level: priToLevel(pri),
          message: msg || '',
          logger_name: appName || undefined,
          thread_name: pid || undefined,
          host: hostname || undefined,
        } as LogEntry);
        continue;
      }
    }
    return logs;
  },
};

