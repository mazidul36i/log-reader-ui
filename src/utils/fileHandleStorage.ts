/**
 * Minimal IndexedDB wrapper for persisting FileSystem handles.
 * FileSystemHandle instances are not JSON-serializable, so localStorage
 * won't work — IndexedDB supports structured-cloning them natively.
 */

const DB_NAME = 'log-reader';
const DB_VERSION = 2;
const FILE_STORE = 'file-handles';
const DIR_STORE = 'directory-handle';
const HANDLES_KEY = 'selected-handles';
const DIR_KEY = 'selected-directory';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      // v1: file-handles store
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE);
      }
      // v2: directory-handle store
      if (e.oldVersion < 2 && !db.objectStoreNames.contains(DIR_STORE)) {
        db.createObjectStore(DIR_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── File handles ──────────────────────────────────────────────────────────────

/** Persist an array of FileSystemFileHandles to IndexedDB. */
export async function saveHandles(handles: FileSystemFileHandle[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readwrite');
      tx.objectStore(FILE_STORE).put(handles, HANDLES_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Silently fail — feature degrades to no persistence
  }
}

/** Load persisted FileSystemFileHandles from IndexedDB. Returns [] if none. */
export async function loadHandles(): Promise<FileSystemFileHandle[]> {
  try {
    const db = await openDb();
    const result = await new Promise<FileSystemFileHandle[] | undefined>((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readonly');
      const req = tx.objectStore(FILE_STORE).get(HANDLES_KEY);
      req.onsuccess = () => resolve(req.result as FileSystemFileHandle[] | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result ?? [];
  } catch {
    return [];
  }
}

/** Remove all persisted file handles from IndexedDB. */
export async function clearHandles(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readwrite');
      tx.objectStore(FILE_STORE).delete(HANDLES_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Silently fail
  }
}

// ── Directory handle ──────────────────────────────────────────────────────────

/** Persist a FileSystemDirectoryHandle to IndexedDB. */
export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DIR_STORE, 'readwrite');
      tx.objectStore(DIR_STORE).put(handle, DIR_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Silently fail
  }
}

/** Load the persisted FileSystemDirectoryHandle from IndexedDB. Returns null if none. */
export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDb();
    const result = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
      const tx = db.transaction(DIR_STORE, 'readonly');
      const req = tx.objectStore(DIR_STORE).get(DIR_KEY);
      req.onsuccess = () => resolve(req.result as FileSystemDirectoryHandle | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result ?? null;
  } catch {
    return null;
  }
}

/** Remove the persisted directory handle from IndexedDB. */
export async function clearDirectoryHandle(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DIR_STORE, 'readwrite');
      tx.objectStore(DIR_STORE).delete(DIR_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Silently fail
  }
}

// ── Feature detection ─────────────────────────────────────────────────────────

/** Whether the File System Access API (file picker) is available in this browser. */
export function isFsaSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

/** Whether the File System Access API directory picker is available in this browser. */
export function isFsaDirectorySupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}
