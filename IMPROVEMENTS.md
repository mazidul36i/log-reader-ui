# Log Reader UI — Improvement Roadmap

> A comprehensive plan to evolve this hobby log viewer into a production-grade observability tool.

---

## 📋 Current State Summary

The app is a **client-side-only** React SPA that:
- Accepts JSON-lines log files via drag-and-drop or file picker
- Parses logs with `@timestamp`, `level`, `message`, `traceId`, `thread_name`, etc.
- Displays a stacked bar timeline (Chart.js) with drag-to-zoom
- Offers dynamic field filters, level toggles, and date-range selection
- Shows thread context in a modal
- Uses Tailwind CSS, ships via Docker/nginx

**Tech stack:** React 19, Vite 8, TypeScript 6, Chart.js 4, Zustand 5, Tailwind 3.

---

## 🏗️ Architecture & Tooling

### ✅ 1. Migrate off Create React App
~~CRA is no longer maintained.~~ **DONE** — Migrated to **Vite 8** with `@vitejs/plugin-react`. Build time: ~550ms.

### ✅ 2. Add TypeScript
**DONE** — Full TypeScript migration with strict mode. `tsc --noEmit` passes with 0 errors. Shared types in `src/types.ts`.

### ✅ 3. State Management
**DONE** — Zustand stores: `useLogStore`, `useFilterStore`, `useUIStore`. Eliminated all prop-drilling.

### ✅ 4. Add a Linter & Formatter
**DONE** — ESLint 9 (flat config) with `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-config-prettier`. Prettier with `.prettierrc`. Scripts: `lint`, `lint:fix`, `format`.

---

## 🚀 Performance (Critical for a Log Viewer)

### ✅ 5. Virtualized Log List
**DONE** — `@tanstack/react-virtual` with 20 overscan. Only ~50 DOM nodes rendered regardless of dataset size.

### ✅ 6. Web Worker for Parsing & Filtering
**DONE** — `src/workers/logWorker.ts` handles both parsing and filtering off the main thread. Logs are kept in worker memory to avoid structured-clone on every filter call.

### ✅ 7. Debounce Search Input
**DONE** — `useDebouncedValue` hook with 200ms delay on `searchText`. Other filters apply instantly.

### ✅ 8. Memoize Child Components
**DONE** — `LogEntry`, `DetailRow`, `LogStats`, and `LogTimeline` all wrapped in `React.memo`. Callbacks stabilized with `useCallback`. Counts use `useMemo`.

### ✅ 9. Indexed Search
**DONE** — Pre-built per-log lowercase searchable strings computed once after parsing. Replaces `JSON.stringify().toLowerCase()` on every filter pass. Pre-computed timestamp Map for O(1) date lookups. `Set.has()` for level filtering.

---

## ✨ Feature Additions

### 10. Live Log Tailing (WebSocket / SSE)
Allow connecting to a backend log source (e.g., a simple Express server that streams a file, or a Loki/Elasticsearch endpoint) so logs arrive in real-time instead of only via file upload.

### ✅ 11. Multi-Format Parser Support
**DONE** — Auto-detecting parser system in `src/parsers/`. Supports:
- **JSON-lines** (with flexible timestamp/level field names)
- **Common Log Format** (Apache/nginx access logs)
- **Syslog** (RFC 5424 + BSD/RFC 3164)
- **Log4j / Logback** pattern layouts (multiline stack trace handling)
- **CSV / TSV** (auto-header mapping to LogEntry fields)
- Auto-detection from first 10 lines with confidence scoring

### ✅ 12. Saved Views & Shareable URLs
**DONE** — Bidirectional URL ↔ filter sync + saved presets:
- Filter state encoded in URL search params (`?search=timeout&level=error,warn&dateFrom=...`)
- URL auto-updates on filter changes (debounced 300ms via `history.replaceState`)
- On page load, filters restore from URL params
- Named presets saved to `localStorage` with save/load/delete UI
- "Copy shareable URL" button for quick sharing

### 13. Log Correlation: Trace Waterfall
The data already has `traceId` and `spanId`. Build a **trace waterfall** view (like Jaeger/Zipkin) grouping all entries under a trace into a timeline with parent-child span relationships.

### 14. Regex & Query Language Search
Replace or augment the plain-text search with:
- **Regex toggle** (already hinted at in ThreadModal's highlight code)
- A simple **query DSL**: `level:ERROR AND message:"timeout" AND tenantId:acme`
- Syntax highlighting in the search bar

### 15. Log Diffing
Select two time windows or two files and diff them — highlight new error patterns, changed frequencies, etc.

### 16. Alerting / Anomaly Highlight
- Detect spikes in ERROR rate automatically and surface them as annotations on the timeline
- Highlight repeated error messages (group by stack trace fingerprint)

### 17. Export & Reporting
- **Export filtered logs** as JSON, CSV, or clipboard-pasteable table
- **Download timeline chart** as PNG/SVG
- Generate a summary report: top errors, busiest threads, slowest traces

### 18. Keyboard-First Navigation
- `j/k` to navigate up/down in the log list
- `Enter` to expand, `Esc` to collapse
- `/` to focus search
- `[` / `]` to jump between errors
- Command palette (`Ctrl+K` already exists — extend it)

### 19. Dark Mode
The UI is light-only. Add a dark theme toggle using Tailwind's `dark:` variant and persist the preference.

### 20. Multi-File Merge & Source Labels
When multiple files are loaded, label each log with its source filename. Allow toggling individual sources on/off.

### 21. Log Entry Bookmarking / Annotations
Let users bookmark or annotate specific log entries to build an investigation timeline, exportable as a mini-report.

---

## 🎨 UI / UX Improvements

### 22. Resizable Panels
Make the timeline, filters, and log list independently resizable (drag handle between sections). Consider a split-panel layout for large screens.

### 23. Column Customisation
Let users choose which fields appear in the compact log row (currently hardcoded to level, timestamp, message, trace, tenant).

### 24. Syntax-Highlighted JSON Detail View
In the expanded log entry, render the full JSON with syntax highlighting (e.g., `react-json-view` or `@uiw/react-json-view`) instead of the flat detail grid.

### 25. Context Menu on Log Entries
Right-click → "Filter by this trace ID", "Exclude this level", "Copy as cURL" (for HTTP-related logs), etc.

### 26. Responsive / Mobile Layout
The current layout breaks on small screens. Add responsive breakpoints for tablet and mobile (collapsible sidebar filters, stacked timeline).

### 27. Accessibility (a11y)
- Add `aria-label`, `role`, and keyboard focus management throughout
- Ensure colour contrast meets WCAG AA
- Screen-reader-friendly log list

---

## 🧪 Testing & Quality

### 28. Unit & Integration Tests
Only a boilerplate `App.test.js` exists. Add:
- Unit tests for parsing logic, filter functions, bucket calculation
- Component tests for `LogEntry`, `LogFilters`, `LogTimeline` with Testing Library
- Snapshot tests for UI regressions

### 29. E2E Tests
Add Playwright or Cypress tests for:
- Drag-and-drop file loading
- Filter interaction → log list updates
- Timeline zoom → date filter sync
- Thread modal workflow

### 30. CI/CD Pipeline
Add a GitHub Actions workflow:
```yaml
- lint → typecheck → test → build → docker push
```

---

## 🔧 Backend / Infrastructure (Optional Growth Path)

### 31. Optional Backend API
Add a lightweight backend (Express or Fastify) that:
- Streams large files without loading everything into browser memory
- Connects to **Elasticsearch**, **Loki**, or **CloudWatch** as log sources
- Provides server-side filtering & pagination for datasets > 1M lines

### 32. SQLite / DuckDB-WASM for In-Browser Queries
For power users who want to stay fully client-side, embed **DuckDB-WASM** to run SQL queries directly against loaded logs — dramatically faster than JS array filtering for large datasets.

### 33. Plugin / Extension System
Allow users to write small plugins that:
- Add custom parsers for proprietary log formats
- Add computed columns (e.g., response-time extraction from message text)
- Add custom visualisations

---

## 📊 Priority Matrix

| Priority | Item | Impact | Effort | Status |
|----------|------|--------|--------|--------|
| 🔴 P0 | Virtualized log list (#5) | Very High | Medium | ✅ Done |
| 🔴 P0 | Migrate to Vite (#1) | High | Low | ✅ Done |
| 🟠 P1 | Web Worker parsing (#6) | High | Medium | ✅ Done |
| 🟠 P1 | TypeScript migration (#2) | High | Medium | ✅ Done |
| 🟠 P1 | Debounce + memoisation (#7, #8) | High | Low | ✅ Done |
| 🟠 P1 | Indexed Search (#9) | High | Medium | ✅ Done |
| 🟠 P1 | State Management (#3) | High | Medium | ✅ Done |
| 🟠 P1 | Linter & Formatter (#4) | Medium | Low | ✅ Done |
| 🟡 P2 | Dark mode (#19) | Medium | Low | |
| 🟡 P2 | Regex / query DSL search (#14) | High | Medium | |
| 🟡 P2 | URL-encoded filter state (#12) | Medium | Low | ✅ Done |
| 🟡 P2 | Multi-format parsers (#11) | High | Medium | ✅ Done |
| 🟢 P3 | Trace waterfall (#13) | High | High | |
| 🟢 P3 | Live tailing (#10) | High | High | |
| 🟢 P3 | DuckDB-WASM queries (#32) | Very High | High | |
| 🟢 P3 | Plugin system (#33) | Medium | High | |

---

## 🗓️ Suggested Phases

### ✅ Phase 1 — Foundation (COMPLETE)
Vite migration, TypeScript, ESLint/Prettier, Zustand, virtualized list, Web Worker, debounce, `React.memo`, indexed search.

### Phase 2 — Core Power Features (2–4 weeks)
Web Worker parsing, regex/query search, multi-format parsers, dark mode, URL state, export.

### Phase 3 — Observability Features (4–6 weeks)
Trace waterfall, live tailing, anomaly detection, log diffing, DuckDB-WASM.

### Phase 4 — Polish & Ecosystem (ongoing)
Plugin system, a11y audit, E2E tests, CI/CD, optional backend integrations, docs site.

---

*Generated for **log-reader-ui** · May 2026*
