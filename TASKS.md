# Architecture & Tooling — Tasks

## Task 1: Migrate from CRA to Vite ✅
- [x] Remove react-scripts and CRA config
- [x] Install Vite + @vitejs/plugin-react
- [x] Create vite.config.js
- [x] Move index.html to project root and update it
- [x] Update package.json scripts
- [x] Remove CRA boilerplate (reportWebVitals, setupTests)
- [x] Update Dockerfile for Vite build
- [x] Verify dev server and production build work

## Task 2: Add ESLint + Prettier ✅
- [x] Install ESLint, Prettier, and plugins
- [x] Create eslint.config.js (flat config)
- [x] Create .prettierrc config
- [x] Add lint/format scripts to package.json
- [x] Run formatter across codebase

## Task 3: Introduce State Management (Zustand) ✅
- [x] Install Zustand
- [x] Create useLogStore (allLogs, filteredLogs, logsForTimeline, loadFiles, applyFilters)
- [x] Create useFilterStore (filters, setFilters, clearDateRange)
- [x] Create useUIStore (isDragging, isFiltersOpen, showScrollTop, threadModal)
- [x] Refactor App.tsx to consume stores instead of prop-drilling

## Task 4: Add TypeScript ✅
- [x] Rename files .jsx → .tsx, .js → .ts
- [x] Install TypeScript + @types/react + @types/react-dom
- [x] Create tsconfig.json
- [x] Create src/types.ts with LogEntry, Filters, ThreadModalState interfaces
- [x] Create src/vite-env.d.ts for CSS/SVG module declarations
- [x] Add types to all three stores
- [x] Add types to all 5 components
- [x] `tsc --noEmit` passes with 0 errors
- [x] Vite production build passes


