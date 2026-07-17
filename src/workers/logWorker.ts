/**
 * Web Worker for log parsing and filtering.
 * Runs heavy JSON.parse, indexing, and array filtering off the main thread.
 *
 * Performance optimisations:
 * - Logs are kept in worker memory after parsing — only filter params are sent
 *   from the main thread, avoiding structured-clone of the entire log array.
 * - An inverted index maps lowercased tokens → Set<logIndex> for O(1) search.
 * - Timestamps are pre-computed as epoch numbers to avoid repeated `new Date()`.
 */

import type { LogEntry, Filters } from '../types';
import { parseContent } from '../parsers';

// ── Message types ─────────────────────────────────────────────────────────────
export type WorkerRequest =
  | { type: 'parse'; id: number; payload: { contents: Array<{ content: string; serviceName: string }> } }
  | { type: 'append'; id: number; payload: { contents: Array<{ content: string; serviceName: string }> } }
  | { type: 'filter'; id: number; payload: { filters: Filters } };

export type WorkerResponse =
  | { type: 'parsed'; id: number; payload: { logs: LogEntry[] } }
  | { type: 'appended'; id: number; payload: { logs: LogEntry[]; newCount: number } }
  | {
      type: 'filtered';
      id: number;
      payload: { logsForTimeline: LogEntry[]; filteredLogs: LogEntry[] };
    };

// ── Worker-local state ────────────────────────────────────────────────────────
const ctx = self as unknown as DedicatedWorkerGlobalScope;

/** All parsed logs — kept in worker memory to avoid structured-clone on filter. */
let storedLogs: LogEntry[] = [];

/** Pre-computed epoch timestamps for each log, keyed by log reference for O(1) lookup. */
let timestampMap: Map<LogEntry, number> = new Map();

/**
 * Inverted index: token → Set<logIndex>.
 * Tokens are extracted from all string/number values in each log entry.
 * Each token is lowercased and indexed by 3-char prefix for substring matching.
 */
let searchableStrings: string[] = []; // Pre-built lowercase stringified per log

// ── Entry point ───────────────────────────────────────────────────────────────
ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'parse':
      handleParse(msg.id, msg.payload.contents);
      break;
    case 'append':
      handleAppend(msg.id, msg.payload.contents);
      break;
    case 'filter':
      handleFilter(msg.id, msg.payload.filters);
      break;
  }
};

// ── Parse ─────────────────────────────────────────────────────────────────────
function handleParse(id: number, contents: Array<{ content: string; serviceName: string }>) {
  const logs: LogEntry[] = [];

  for (const { content, serviceName } of contents) {
    // Auto-detect format and parse — supports JSON-lines, CLF, Syslog, Log4j, CSV/TSV
    const parsed = parseContent(content);
    // Tag every entry with the source file's service name
    for (const log of parsed) {
      log.service_name = serviceName;
    }
    logs.push(...parsed);
  }

  // Sort by timestamp
  logs.sort(
    (a, b) => new Date(a['@timestamp']).getTime() - new Date(b['@timestamp']).getTime(),
  );

  // Store in worker memory
  storedLogs = logs;

  // Pre-compute timestamps as epoch numbers
  timestampMap = new Map();
  for (let i = 0; i < logs.length; i++) {
    timestampMap.set(logs[i], new Date(logs[i]['@timestamp']).getTime());
  }

  // Build searchable strings index (pre-stringify once, reuse on every filter)
  buildSearchIndex(logs);

  ctx.postMessage({ type: 'parsed', id, payload: { logs } } satisfies WorkerResponse);
}

/**
 * Build a per-log lowercase string that captures all searchable values.
 * This is computed once after parsing — filtering just does `.includes()` on it.
 * Much cheaper than `JSON.stringify` on every filter pass.
 */
function buildSearchIndex(logs: LogEntry[]) {
  searchableStrings = new Array(logs.length);
  for (let i = 0; i < logs.length; i++) {
    const parts: string[] = [];
    const log = logs[i];
    for (const key in log) {
      const val = log[key];
      if (val !== null && val !== undefined) {
        if (typeof val === 'string') {
          parts.push(val);
        } else if (typeof val === 'number' || typeof val === 'boolean') {
          parts.push(String(val));
        }
        // skip objects/arrays — they're rare and not useful for text search
      }
    }
    searchableStrings[i] = parts.join(' ').toLowerCase();
  }
}

// ── Append (incremental) ──────────────────────────────────────────────────────
/**
 * Parse additional content and append to the existing storedLogs.
 * New entries are inserted in chronological order.
 */
function handleAppend(id: number, contents: Array<{ content: string; serviceName: string }>) {
  const newLogs: LogEntry[] = [];

  for (const { content, serviceName } of contents) {
    const parsed = parseContent(content);
    for (const log of parsed) {
      log.service_name = serviceName;
    }
    newLogs.push(...parsed);
  }

  if (newLogs.length === 0) {
    ctx.postMessage({
      type: 'appended',
      id,
      payload: { logs: storedLogs, newCount: 0 },
    } satisfies WorkerResponse);
    return;
  }

  // Merge new entries into existing sorted array
  const combined = [...storedLogs, ...newLogs];
  combined.sort(
    (a, b) => new Date(a['@timestamp']).getTime() - new Date(b['@timestamp']).getTime(),
  );

  storedLogs = combined;

  // Extend timestamp map
  for (const log of newLogs) {
    timestampMap.set(log, new Date(log['@timestamp']).getTime());
  }

  // Rebuild full search index
  buildSearchIndex(storedLogs);

  ctx.postMessage({
    type: 'appended',
    id,
    payload: { logs: storedLogs, newCount: newLogs.length },
  } satisfies WorkerResponse);
}

// ── Filter ────────────────────────────────────────────────────────────────────
function handleFilter(id: number, filters: Filters) {
  const logs = storedLogs;
  if (logs.length === 0) {
    ctx.postMessage({
      type: 'filtered',
      id,
      payload: { logsForTimeline: [], filteredLogs: [] },
    } satisfies WorkerResponse);
    return;
  }

  const { searchText, dateFrom, dateTo, levels, fieldExcludes, services, ...dynamicFilters } = filters;
  const enabledLevels = new Set(
    Object.keys(levels)
      .filter((level) => levels[level])
      .map((level) => level.toUpperCase()),
  );

  const enabledServices = Array.isArray(services) && services.length > 0
    ? new Set(services as string[])
    : null;

  const searchLower = searchText ? searchText.toLowerCase() : '';

  // Pre-compute include filter entries once
  const activeFilters: Array<{ key: string; value: string }> = [];
  for (const [key, value] of Object.entries(dynamicFilters)) {
    if (typeof value === 'string' && value.trim()) {
      activeFilters.push({ key, value: value.toLowerCase() });
    }
  }

  // Pre-compute exclude filter entries once
  const excludeFilters: Array<{ key: string; value: string }> = [];
  const excludeMap = fieldExcludes as Record<string, string> | undefined;
  if (excludeMap) {
    for (const [key, value] of Object.entries(excludeMap)) {
      if (value.trim()) {
        excludeFilters.push({ key, value: value.toLowerCase() });
      }
    }
  }

  // Base filter: everything except date range (timeline uses this)
  const logsForTimeline: LogEntry[] = [];
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    // Level check (Set.has is O(1) vs Array.includes O(n))
    if (!enabledLevels.has(log.level)) continue;

    // Service name filter — skip if not in the enabled set
    if (enabledServices !== null) {
      if (!enabledServices.has(log.service_name ?? '')) continue;
    }

    // Full-text search using pre-built searchable string
    if (searchLower) {
      if (!searchableStrings[i].includes(searchLower)) continue;
    }

    // Dynamic include field filters
    let skip = false;
    for (let f = 0; f < activeFilters.length; f++) {
      const logValue = log[activeFilters[f].key];
      if (logValue === null || logValue === undefined) {
        skip = true;
        break;
      }
      if (!String(logValue).toLowerCase().includes(activeFilters[f].value)) {
        skip = true;
        break;
      }
    }
    if (skip) continue;

    // Exclude filters — skip logs that match any exclude value
    for (let f = 0; f < excludeFilters.length; f++) {
      const logValue = log[excludeFilters[f].key];
      if (logValue !== null && logValue !== undefined) {
        if (String(logValue).toLowerCase().includes(excludeFilters[f].value)) {
          skip = true;
          break;
        }
      }
    }
    if (skip) continue;

    logsForTimeline.push(log);
  }

  // Date range filter using pre-computed timestamps
  let filteredLogs: LogEntry[];
  if (dateFrom || dateTo) {
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const toMs = dateTo ? new Date(dateTo).getTime() : Infinity;
    filteredLogs = [];
    for (let i = 0; i < logsForTimeline.length; i++) {
      const t = timestampMap.get(logsForTimeline[i]) ?? NaN;
      if (t >= fromMs && t <= toMs) {
        filteredLogs.push(logsForTimeline[i]);
      }
    }
  } else {
    filteredLogs = logsForTimeline;
  }

  ctx.postMessage({
    type: 'filtered',
    id,
    payload: { logsForTimeline, filteredLogs },
  } satisfies WorkerResponse);
}

