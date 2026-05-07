import { create } from 'zustand';
import type { LogEntry, ThreadModalState } from '../types';

interface UIStoreState {
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  isFiltersOpen: boolean;
  toggleFilters: () => void;
  showScrollTop: boolean;
  setShowScrollTop: (v: boolean) => void;
  threadModal: ThreadModalState;
  openThreadModal: (payload: Omit<ThreadModalState, 'isOpen'>) => void;
  closeThreadModal: () => void;
}

const useUIStore = create<UIStoreState>((set) => ({
  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  isDragging: false,
  setIsDragging: (v: boolean) => set({ isDragging: v }),

  // ── Filters panel ──────────────────────────────────────────────────────────
  isFiltersOpen: true,
  toggleFilters: () => set((s) => ({ isFiltersOpen: !s.isFiltersOpen })),

  // ── Scroll-to-top button ───────────────────────────────────────────────────
  showScrollTop: false,
  setShowScrollTop: (v: boolean) => set({ showScrollTop: v }),

  // ── Thread modal ───────────────────────────────────────────────────────────
  threadModal: {
    isOpen: false,
    threadName: '',
    logs: [] as LogEntry[],
    currentLogIndex: -1,
  },
  openThreadModal: (payload) => set({ threadModal: { isOpen: true, ...payload } }),
  closeThreadModal: () =>
    set({
      threadModal: { isOpen: false, threadName: '', logs: [], currentLogIndex: -1 },
    }),
}));

export default useUIStore;

