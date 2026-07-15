import { useEffect, useRef } from 'react';
import useLogStore from '../stores/useLogStore';

/**
 * Sets up a polling interval that calls `reloadFiles()` whenever
 * `autoReloadInterval > 0` and there are loaded file handles.
 * Cleans up the interval on unmount or when the interval changes.
 */
export function useAutoReload() {
  const autoReloadInterval = useLogStore((s) => s.autoReloadInterval);
  const loadedFileHandles = useLogStore((s) => s.loadedFileHandles);
  const reloadFiles = useLogStore((s) => s.reloadFiles);

  const reloadRef = useRef(reloadFiles);
  reloadRef.current = reloadFiles;

  useEffect(() => {
    if (autoReloadInterval === 0 || loadedFileHandles.length === 0) return;

    const id = setInterval(() => {
      void reloadRef.current();
    }, autoReloadInterval);

    return () => clearInterval(id);
  }, [autoReloadInterval, loadedFileHandles.length]);
}
