/** Shape of a single parsed log entry (JSON-lines format). */
export interface LogEntry {
  '@timestamp': string;
  '@version'?: string;
  level: string;
  message?: string;
  logger_name?: string;
  thread_name?: string;
  trace_id?: string;
  span_id?: string;
  mtxs?: string;
  tenantId?: string;
  stack_trace?: string;
  /** Any additional dynamic fields the log may carry. */
  [key: string]: unknown;
}

/** Filter state managed by useFilterStore. */
export interface Filters {
  searchText: string;
  dateFrom: string;
  dateTo: string;
  levels: Record<string, boolean>;
  /** Dynamic field filters (trace_id, tenantId, loggerName, etc.) */
  [key: string]: string | Record<string, boolean>;
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

