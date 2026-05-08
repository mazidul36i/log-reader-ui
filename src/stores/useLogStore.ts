import { create } from 'zustand';
import type { LogEntry, Filters } from '../types';
import type { WorkerRequest, WorkerResponse } from '../workers/logWorker';

// ── Worker singleton ──────────────────────────────────────────────────────────
let worker: Worker | null = null;
let requestId = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/logWorker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return worker;
}

// ── Store ─────────────────────────────────────────────────────────────────────
interface LogStoreState {
  allLogs: LogEntry[];
  filteredLogs: LogEntry[];
  logsForTimeline: LogEntry[];
  isLoading: boolean;
  loadFiles: (files: FileList | File[]) => void;
  clearLogs: () => void;
  applyFilters: (filters: Filters) => void;
}

const useLogStore = create<LogStoreState>((set, get) => ({
  allLogs: [],
  filteredLogs: [],
  logsForTimeline: [],
  isLoading: false,

  /** Read file contents on the main thread, then send to worker for parsing. */
  loadFiles: (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    set({ isLoading: true });

    const fileContents: string[] = [];
    let filesRead = 0;
    const totalFiles = files.length;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        fileContents.push(e.target?.result as string);
        filesRead++;

        if (filesRead === totalFiles) {
          const id = ++requestId;
          const w = getWorker();

          const handler = (ev: MessageEvent<WorkerResponse>) => {
            if (ev.data.type === 'parsed' && ev.data.id === id) {
              w.removeEventListener('message', handler);
              set({ allLogs: ev.data.payload.logs, isLoading: false });
            }
          };
          w.addEventListener('message', handler);
          w.postMessage({
            type: 'parse',
            id,
            payload: { contents: fileContents },
          } satisfies WorkerRequest);
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
    }),

  /** Send filter request to worker — results arrive asynchronously.
   *  Logs are already stored in worker memory after parsing, so we only
   *  send the filter parameters (avoids structured-cloning the entire array). */
  applyFilters: (filters: Filters) => {
    const { allLogs } = get();
    if (allLogs.length === 0) {
      set({ filteredLogs: [], logsForTimeline: [] });
      return;
    }

    const id = ++requestId;
    const w = getWorker();

    const handler = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data.type === 'filtered' && ev.data.id === id) {
        w.removeEventListener('message', handler);
        set({
          logsForTimeline: ev.data.payload.logsForTimeline,
          filteredLogs: ev.data.payload.filteredLogs,
        });
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({
      type: 'filter',
      id,
      payload: { filters },
    } satisfies WorkerRequest);
  },
}));

export default useLogStore;

