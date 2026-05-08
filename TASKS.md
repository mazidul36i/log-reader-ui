# Performance Tasks

## Completed (Architecture & Tooling — Phase 1)
- [x] Migrate CRA → Vite
- [x] Add TypeScript (strict mode, 0 errors)
- [x] Add ESLint + Prettier
- [x] Add Zustand state management (useLogStore, useFilterStore, useUIStore)

## Completed (Performance — from previous iterations)
- [x] #5 Virtualized log list (`@tanstack/react-virtual`)
- [x] #6 Web Worker for parsing & filtering (`logWorker.ts`)
- [x] #7 Debounce search input (`useDebouncedValue`, 200ms)
- [x] #8 Memoize `LogEntry` and `DetailRow` with `React.memo`

## Completed (Performance — this iteration)
- [x] #8b Memoize `LogStats` and `LogTimeline` with `React.memo`
- [x] #9a Keep logs in worker memory — avoid structured-cloning allLogs on every filter
- [x] #9b Build search index after parsing — replace `JSON.stringify().toLowerCase().includes()` with pre-built per-log searchable strings
- [x] #9c Pre-compute timestamps as epoch numbers (Map<LogEntry, number>) — avoid repeated `new Date()` calls
- [x] #9d Use Set for enabled levels — O(1) `.has()` vs O(n) `.includes()`
- [x] #9e Use `useMemo` for LogStats counts computation
- [x] Fix: `useDebouncedValue` useRef TypeScript strictness

## In Progress — Feature #12: Saved Views & Shareable URLs
- [ ] Create URL serialization utils (`src/utils/filterUrl.ts`)
- [ ] Create `useUrlSync` hook (`src/hooks/useUrlSync.ts`)
- [ ] Wire `useUrlSync` into App.tsx
- [ ] Create preset storage utils (`src/utils/filterPresets.ts`)
- [ ] Create `SavedPresets` component (`src/components/SavedPresets.tsx`)
- [ ] Add `SavedPresets` to LogFilters
