import { create } from 'zustand';
import type { LogEntry, Filters, AutoReloadInterval } from '../types';
import type { WorkerRequest, WorkerResponse } from '../workers/logWorker';
import { saveHandles, clearHandles } from '../utils/fileHandleStorage';

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

  /** Persistent file handles from the File System Access API. */
  loadedFileHandles: FileSystemFileHandle[];
  /** Byte offset per file name — tracks how many bytes have been read. */
  fileOffsets: Record<string, number>;
  /** Auto-reload polling interval in ms. 0 = disabled. */
  autoReloadInterval: AutoReloadInterval;
  /** Timestamp of the last successful reload. */
  lastReloadedAt: Date | null;
  /** Handles loaded from IndexedDB that still need user permission. */
  pendingRestoreHandles: FileSystemFileHandle[];

  loadFiles: (files: FileList | File[]) => void;
  /** Load files via File System Access API handles (persists across sessions). */
  loadFileHandles: (handles: FileSystemFileHandle[]) => Promise<void>;
  /** Re-read only new bytes from each tracked handle and append to allLogs. */
  reloadFiles: () => Promise<void>;
  /** Set the auto-reload polling interval and persist it to localStorage. */
  setAutoReloadInterval: (ms: AutoReloadInterval) => void;
  /** Set handles that need permission re-prompting (from IndexedDB on startup). */
  setPendingRestoreHandles: (handles: FileSystemFileHandle[]) => void;
  clearLogs: () => void;
  applyFilters: (filters: Filters) => void;
}

const RELOAD_INTERVAL_KEY = 'log-reader:autoReloadInterval';

const useLogStore = create<LogStoreState>((set, get) => ({
  allLogs: [],
  filteredLogs: [],
  logsForTimeline: [],
  isLoading: false,
  loadedFileHandles: [],
  fileOffsets: {},
  autoReloadInterval: (Number(localStorage.getItem(RELOAD_INTERVAL_KEY)) ||
    0) as AutoReloadInterval,
  lastReloadedAt: null,
  pendingRestoreHandles: [],

  /** Read file contents on the main thread, then send to worker for parsing.
   *  Used as the fallback when File System Access API is unavailable. */
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
              set({ allLogs: ev.data.payload.logs, isLoading: false, lastReloadedAt: new Date() });
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

  /** Load via File System Access API. Reads full file content, then tracks offset
   *  for future incremental reads. Persists handles to IndexedDB. */
  loadFileHandles: async (handles: FileSystemFileHandle[]) => {
    if (!handles || handles.length === 0) return;
    set({ isLoading: true });

    const fileContents: string[] = [];
    const newOffsets: Record<string, number> = {};

    for (const handle of handles) {
      try {
        const file = await handle.getFile();
        const text = await file.text();
        fileContents.push(text);
        newOffsets[handle.name] = file.size;
      } catch {
        // Handle became unavailable — skip it
      }
    }

    if (fileContents.length === 0) {
      set({ isLoading: false });
      return;
    }

    await saveHandles(handles);

    const id = ++requestId;
    const w = getWorker();

    const handler = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data.type === 'parsed' && ev.data.id === id) {
        w.removeEventListener('message', handler);
        set({
          allLogs: ev.data.payload.logs,
          isLoading: false,
          loadedFileHandles: handles,
          fileOffsets: newOffsets,
          lastReloadedAt: new Date(),
        });
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({
      type: 'parse',
      id,
      payload: { contents: fileContents },
    } satisfies WorkerRequest);
  },

  /** Incremental reload: reads only new bytes from each tracked handle and appends. */
  reloadFiles: async () => {
    const { loadedFileHandles, fileOffsets } = get();
    if (loadedFileHandles.length === 0) return;

    const newContents: string[] = [];
    const updatedOffsets: Record<string, number> = { ...fileOffsets };
    let hasNew = false;

    for (const handle of loadedFileHandles) {
      try {
        const perm = await handle.queryPermission({ mode: 'read' });
        if (perm !== 'granted') continue;

        const file = await handle.getFile();
        const lastOffset = fileOffsets[handle.name] ?? 0;

        if (file.size > lastOffset) {
          const slice = file.slice(lastOffset);
          const text = await slice.text();
          newContents.push(text);
          updatedOffsets[handle.name] = file.size;
          hasNew = true;
        }
      } catch {
        // Handle became unavailable — skip silently
      }
    }

    if (!hasNew) {
      set({ lastReloadedAt: new Date() });
      return;
    }

    const id = ++requestId;
    const w = getWorker();

    const handler = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data.type === 'appended' && ev.data.id === id) {
        w.removeEventListener('message', handler);
        set({
          allLogs: ev.data.payload.logs,
          fileOffsets: updatedOffsets,
          lastReloadedAt: new Date(),
        });
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({
      type: 'append',
      id,
      payload: { contents: newContents },
    } satisfies WorkerRequest);
  },

  setAutoReloadInterval: (ms: AutoReloadInterval) => {
    localStorage.setItem(RELOAD_INTERVAL_KEY, String(ms));
    set({ autoReloadInterval: ms });
  },

  setPendingRestoreHandles: (handles: FileSystemFileHandle[]) => {
    set({ pendingRestoreHandles: handles });
  },

  /** Clear all loaded logs and file handles. */
  clearLogs: () => {
    void clearHandles();
    set({
      allLogs: [],
      filteredLogs: [],
      logsForTimeline: [],
      loadedFileHandles: [],
      fileOffsets: {},
      lastReloadedAt: null,
      pendingRestoreHandles: [],
    });
  },

  /** Send filter request to worker — results arrive asynchronously. */
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

