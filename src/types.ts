/** Shape of a single parsed log entry (JSON-lines format). */
export interface LogEntry {
  '@timestamp': string;
  '@version'?: string;
  level: string;
  message?: string;
  logger_name?: string;
  thread_name?: string;
  traceId?: string;
  spanId?: string;
  mtxs?: string;
  tenantId?: string;
  stack_trace?: string;
  /** Source file basename without extension — injected from the filename at load time. */
  service_name?: string;
  /** Any additional dynamic fields the log may carry. */
  [key: string]: unknown;
}

/** Filter state managed by useFilterStore. */
export interface Filters {
  searchText: string;
  dateFrom: string;
  dateTo: string;
  levels: Record<string, boolean>;
  /** Field values that must NOT be present (exclude filters). */
  fieldExcludes: Record<string, string>;
  /** Enabled service names — empty array means all services are shown. */
  services: string[];
  /** Dynamic include field filters (traceId, tenantId, loggerName, etc.) */
  [key: string]: string | string[] | Record<string, boolean | string>;
}

/** Auto-reload interval in milliseconds. 0 means disabled. Any positive number is valid. */
export type AutoReloadInterval = number;

/** Thread modal state. */
export interface ThreadModalState {
  isOpen: boolean;
  threadName: string;
  logs: LogEntry[];
  currentLogIndex: number;
}

export const TIMELINE_BUCKET_COUNT = 80;

export interface TimelineBucket {
  t: number;
  INFO: number;
  ERROR: number;
  WARN: number;
  DEBUG: number;
  total: number;
}

