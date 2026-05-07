import { create } from 'zustand';
import type { LogEntry, Filters } from '../types';

const LOGS_PER_PAGE = 100;

interface LogStoreState {
  allLogs: LogEntry[];
  filteredLogs: LogEntry[];
  logsForTimeline: LogEntry[];
  displayedLogsCount: number;
  isLoadingMore: boolean;
  loadFiles: (files: FileList | File[]) => void;
  clearLogs: () => void;
  applyFilters: (filters: Filters) => void;
  loadMoreLogs: () => void;
}

const useLogStore = create<LogStoreState>((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  allLogs: [],
  filteredLogs: [],
  logsForTimeline: [],
  displayedLogsCount: 0,
  isLoadingMore: false,

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Load and parse log files, sort by timestamp, and store. */
  loadFiles: (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const newAllLogs: LogEntry[] = [];
    let filesProcessed = 0;
    const totalFiles = files.length;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const lines = content.split('\n').filter((line: string) => line.trim());

        lines.forEach((line: string) => {
          try {
            const logEntry = JSON.parse(line);
            if (logEntry?.['@timestamp']) {
              newAllLogs.push(logEntry as LogEntry);
            }
          } catch (_err) {
            console.warn('Failed to parse log line:', line);
          }
        });

        filesProcessed++;

        if (filesProcessed === totalFiles) {
          newAllLogs.sort(
            (a, b) =>
              new Date(a['@timestamp'] || 0).getTime() -
              new Date(b['@timestamp'] || 0).getTime(),
          );
          set({ allLogs: newAllLogs });
        }
      };
      reader.readAsText(file);
    });
  },

  /** Clear all loaded logs. */
  clearLogs: () =>
    set({
      allLogs: [],
      filteredLogs: [],
      logsForTimeline: [],
      displayedLogsCount: 0,
    }),

  /** Apply filters against allLogs and update filteredLogs + logsForTimeline. */
  applyFilters: (filters: Filters) => {
    const { allLogs } = get();
    const { searchText, dateFrom, dateTo, levels, ...dynamicFilters } = filters;
    const enabledLevels = Object.keys(levels)
      .filter((level) => levels[level])
      .map((level) => level.toUpperCase());

    // Base filter: everything except date range (timeline uses this)
    const baseFiltered = allLogs.filter((log) => {
      if (!enabledLevels.includes(log?.level)) return false;

      if (searchText) {
        const logString = JSON.stringify(log).toLowerCase();
        if (!logString.includes(searchText.toLowerCase())) return false;
      }

      for (const [filterKey, filterValue] of Object.entries(dynamicFilters)) {
        if (typeof filterValue === 'string' && filterValue.trim()) {
          const logValue = log?.[filterKey];
          if (logValue === null || logValue === undefined) return false;
          const logValueString = String(logValue).toLowerCase();
          const filterValueString = filterValue.toLowerCase();
          if (!logValueString.includes(filterValueString)) return false;
        }
      }

      return true;
    });

    // Full filter: additionally apply date range (list uses this)
    const filtered = baseFiltered.filter((log) => {
      const logDate = new Date(log?.['@timestamp']);
      if (dateFrom && logDate < new Date(dateFrom)) return false;
      if (dateTo && logDate > new Date(dateTo)) return false;
      return true;
    });

    set({
      logsForTimeline: baseFiltered,
      filteredLogs: filtered,
      displayedLogsCount: Math.min(LOGS_PER_PAGE, filtered.length),
    });
  },

  /** Load next page of logs for infinite scroll. */
  loadMoreLogs: () => {
    const { isLoadingMore, displayedLogsCount, filteredLogs } = get();
    if (isLoadingMore || displayedLogsCount >= filteredLogs.length) return;

    set({ isLoadingMore: true });
    setTimeout(() => {
      set((state) => ({
        displayedLogsCount: Math.min(state.displayedLogsCount + LOGS_PER_PAGE, state.filteredLogs.length),
        isLoadingMore: false,
      }));
    }, 100);
  },
}));

export default useLogStore;

