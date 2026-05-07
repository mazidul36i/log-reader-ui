import { create } from 'zustand';
import type { Filters } from '../types';

const DEFAULT_FILTERS: Filters = {
  searchText: '',
  traceId: '',
  tenantId: '',
  loggerName: '',
  dateFrom: '',
  dateTo: '',
  levels: { info: true, error: true, warn: true, debug: true },
};

interface FilterStoreState {
  filters: Filters;
  setFilters: (updater: Filters | ((prev: Filters) => Filters)) => void;
  resetFilters: () => void;
  clearDateRange: () => void;
}

const useFilterStore = create<FilterStoreState>((set) => ({
  filters: { ...DEFAULT_FILTERS },

  setFilters: (updater) =>
    set((state) => ({
      filters: typeof updater === 'function' ? updater(state.filters) : { ...state.filters, ...updater },
    })),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  clearDateRange: () =>
    set((state) => ({
      filters: { ...state.filters, dateFrom: '', dateTo: '' },
    })),
}));

export default useFilterStore;

