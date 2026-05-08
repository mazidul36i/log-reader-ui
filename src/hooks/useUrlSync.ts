/**
 * Bidirectional sync between Zustand filter state and URL search params.
 *
 * - On mount: reads URL params → restores filters
 * - On filter change: debounce-writes to URL via history.replaceState
 * - Uses a guard flag to prevent circular updates
 */

import { useEffect, useRef } from 'react';
import useFilterStore from '../stores/useFilterStore';
import {
  searchParamsToFilters,
  filtersToUrl,
  isDefaultFilters,
} from '../utils/filterUrl';

/** Debounce interval for URL writes (ms). */
const URL_WRITE_DEBOUNCE = 300;

export function useUrlSync() {
  const isRestoringFromUrl = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── On mount: restore filters from URL ────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const restored = searchParamsToFilters(params);

    if (restored) {
      isRestoringFromUrl.current = true;
      useFilterStore.getState().setFilters(restored);

      // Reset guard after a tick so subsequent store updates write to URL
      requestAnimationFrame(() => {
        isRestoringFromUrl.current = false;
      });
    }
  }, []);

  // ── Subscribe to store changes → write URL ────────────────────────────────
  useEffect(() => {
    const unsubscribe = useFilterStore.subscribe((state) => {
      // Don't write back to URL while restoring from URL
      if (isRestoringFromUrl.current) return;

      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const url = isDefaultFilters(state.filters)
          ? window.location.pathname
          : window.location.pathname + filtersToUrl(state.filters);

        // Only update if URL actually changed
        if (window.location.pathname + window.location.search !== url) {
          history.replaceState(null, '', url);
        }
      }, URL_WRITE_DEBOUNCE);
    });

    return () => {
      unsubscribe();
      clearTimeout(debounceTimer.current);
    };
  }, []);
}

