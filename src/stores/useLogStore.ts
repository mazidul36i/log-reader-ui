import { create } from 'zustand';
import type { LogEntry, Filters, AutoReloadInterval } from '../types';
import type { WorkerRequest, WorkerResponse } from '../workers/logWorker';
import { saveDirectoryHandle, clearDirectoryHandle } from '../utils/fileHandleStorage';

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

/** Extract service name from a filename by stripping the extension. */
function serviceNameFromFile(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

// ── Store ─────────────────────────────────────────────────────────────────────
interface LogStoreState {
  allLogs: LogEntry[];
  filteredLogs: LogEntry[];
  logsForTimeline: LogEntry[];
  isLoading: boolean;

  /** Loaded directory handle from the File System Access API. */
  loadedDirectoryHandle: FileSystemDirectoryHandle | null;
  /** Name of the loaded directory for display. */
  loadedDirectoryName: string;
  /** Byte offset per filename — tracks how many bytes have been read. */
  fileOffsets: Record<string, number>;
  /** List of .log filenames currently loaded from the directory. */
  loadedFileNames: string[];
  /** Auto-reload polling interval in ms. 0 = disabled. */
  autoReloadInterval: AutoReloadInterval;
  /** Timestamp of the last successful reload. */
  lastReloadedAt: Date | null;
  /** Directory handle loaded from IndexedDB that still needs user permission. */
  pendingRestoreDirectoryHandle: FileSystemDirectoryHandle | null;

  /** Load all .log files from a directory handle. */
  loadDirectory: (handle: FileSystemDirectoryHandle) => Promise<void>;
  /** Re-scan the directory for new .log files and append any new content. */
  reloadDirectory: () => Promise<void>;
  /** Set the auto-reload polling interval and persist it to localStorage. */
  setAutoReloadInterval: (ms: AutoReloadInterval) => void;
  /** Set a directory handle that needs permission re-prompting (from IDB on startup). */
  setPendingRestoreDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void;
  clearLogs: () => void;
  applyFilters: (filters: Filters) => void;
}

const RELOAD_INTERVAL_KEY = 'log-reader:autoReloadInterval';

const useLogStore = create<LogStoreState>((set, get) => ({
  allLogs: [],
  filteredLogs: [],
  logsForTimeline: [],
  isLoading: false,
  loadedDirectoryHandle: null,
  loadedDirectoryName: '',
  fileOffsets: {},
  loadedFileNames: [],
  autoReloadInterval: (Number(localStorage.getItem(RELOAD_INTERVAL_KEY)) ||
    0) as AutoReloadInterval,
  lastReloadedAt: null,
  pendingRestoreDirectoryHandle: null,

  /** Read all .log files from a directory handle, tag each with service_name,
   *  send to worker for parsing. Persists the handle to IndexedDB. */
  loadDirectory: async (handle: FileSystemDirectoryHandle) => {
    set({ isLoading: true });

    const contents: Array<{ content: string; serviceName: string }> = [];
    const newOffsets: Record<string, number> = {};
    const fileNames: string[] = [];

    for await (const entry of handle.values()) {
      if (entry.kind !== 'file') continue;
      if (!entry.name.endsWith('.log')) continue;

      try {
        const file = await (entry as FileSystemFileHandle).getFile();
        const text = await file.text();
        const serviceName = serviceNameFromFile(entry.name);
        contents.push({ content: text, serviceName });
        newOffsets[entry.name] = file.size;
        fileNames.push(entry.name);
      } catch {
        // File unreadable — skip
      }
    }

    if (contents.length === 0) {
      set({ isLoading: false, loadedDirectoryHandle: handle, loadedDirectoryName: handle.name });
      return;
    }

    await saveDirectoryHandle(handle);

    const id = ++requestId;
    const w = getWorker();

    const handler = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data.type === 'parsed' && ev.data.id === id) {
        w.removeEventListener('message', handler);
        set({
          allLogs: ev.data.payload.logs,
          isLoading: false,
          loadedDirectoryHandle: handle,
          loadedDirectoryName: handle.name,
          fileOffsets: newOffsets,
          loadedFileNames: fileNames,
          lastReloadedAt: new Date(),
        });
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({
      type: 'parse',
      id,
      payload: { contents },
    } satisfies WorkerRequest);
  },

  /** Re-scan directory: discover new .log files and read incremental bytes from existing ones. */
  reloadDirectory: async () => {
    const { loadedDirectoryHandle, fileOffsets } = get();
    if (!loadedDirectoryHandle) return;

    const newContents: Array<{ content: string; serviceName: string }> = [];
    const updatedOffsets: Record<string, number> = { ...fileOffsets };
    const allFileNames: string[] = [];
    let hasNew = false;

    for await (const entry of loadedDirectoryHandle.values()) {
      if (entry.kind !== 'file') continue;
      if (!entry.name.endsWith('.log')) continue;

      allFileNames.push(entry.name);

      try {
        const file = await (entry as FileSystemFileHandle).getFile();
        const serviceName = serviceNameFromFile(entry.name);
        const lastOffset = fileOffsets[entry.name] ?? 0;

        if (file.size > lastOffset) {
          const slice = file.slice(lastOffset);
          const text = await slice.text();
          newContents.push({ content: text, serviceName });
          updatedOffsets[entry.name] = file.size;
          hasNew = true;
        }
      } catch {
        // File unreadable — skip
      }
    }

    if (!hasNew) {
      set({ lastReloadedAt: new Date(), loadedFileNames: allFileNames });
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
          loadedFileNames: allFileNames,
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

  setPendingRestoreDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => {
    set({ pendingRestoreDirectoryHandle: handle });
  },

  /** Clear all loaded logs and directory state. */
  clearLogs: () => {
    void clearDirectoryHandle();
    set({
      allLogs: [],
      filteredLogs: [],
      logsForTimeline: [],
      loadedDirectoryHandle: null,
      loadedDirectoryName: '',
      fileOffsets: {},
      loadedFileNames: [],
      lastReloadedAt: null,
      pendingRestoreDirectoryHandle: null,
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
