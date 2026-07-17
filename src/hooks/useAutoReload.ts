import { useEffect, useRef } from 'react';
import useLogStore from '../stores/useLogStore';

/**
 * Sets up a polling interval that calls `reloadDirectory()` whenever
 * `autoReloadInterval > 0` and a directory has been loaded.
 * Cleans up the interval on unmount or when the interval changes.
 */
export function useAutoReload() {
  const autoReloadInterval = useLogStore((s) => s.autoReloadInterval);
  const loadedDirectoryHandle = useLogStore((s) => s.loadedDirectoryHandle);
  const reloadDirectory = useLogStore((s) => s.reloadDirectory);

  const reloadRef = useRef(reloadDirectory);
  reloadRef.current = reloadDirectory;

  useEffect(() => {
    if (autoReloadInterval === 0 || !loadedDirectoryHandle) return;

    const id = setInterval(() => {
      void reloadRef.current();
    }, autoReloadInterval);

    return () => clearInterval(id);
  }, [autoReloadInterval, loadedDirectoryHandle]);
}
