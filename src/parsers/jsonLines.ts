import type { LogEntry } from '../types';
import type { LogParser } from './types';

/**
 * JSON-Lines parser.
 * Each line is a complete JSON object with at minimum `@timestamp`.
 */
export const jsonLinesParser: LogParser = {
  format: 'json-lines',

  detect(sampleLines: string[]): number {
    let jsonCount = 0;
    for (const line of sampleLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('{')) {
        try {
          const obj = JSON.parse(trimmed);
          if (obj?.['@timestamp'] || obj?.timestamp || obj?.time || obj?.ts) {
            jsonCount++;
          }
        } catch {
          // not valid JSON
        }
      }
    }
    return sampleLines.length > 0 ? jsonCount / sampleLines.length : 0;
  },

  parse(content: string): LogEntry[] {
    const logs: LogEntry[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        // Normalize timestamp field variations
        const timestamp =
          entry['@timestamp'] || entry.timestamp || entry.time || entry.ts || '';
        if (!timestamp) continue;

        const normalized: LogEntry = {
          ...entry,
          '@timestamp': timestamp,
          level: (entry.level || entry.severity || entry.log_level || 'INFO').toUpperCase(),
          message: entry.message || entry.msg || entry.log || '',
        };
        logs.push(normalized);
      } catch {
        // skip unparseable lines
      }
    }
    return logs;
  },
};

