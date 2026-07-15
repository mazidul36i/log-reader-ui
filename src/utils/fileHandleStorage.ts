/**
 * Minimal IndexedDB wrapper for persisting FileSystemFileHandle objects.
 * FileSystemFileHandle instances are not JSON-serializable, so localStorage
 * won't work — IndexedDB supports structured-cloning them natively.
 */

const DB_NAME = 'log-reader';
const DB_VERSION = 1;
const STORE_NAME = 'file-handles';
const HANDLES_KEY = 'selected-handles';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Persist an array of FileSystemFileHandles to IndexedDB. */
export async function saveHandles(handles: FileSystemFileHandle[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handles, HANDLES_KEY);
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
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(HANDLES_KEY);
      req.onsuccess = () => resolve(req.result as FileSystemFileHandle[] | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result ?? [];
  } catch {
    return [];
  }
}

/** Remove all persisted handles from IndexedDB. */
export async function clearHandles(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(HANDLES_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Silently fail
  }
}

/** Whether the File System Access API is available in this browser. */
export function isFsaSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}
