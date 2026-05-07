# Log Reader UI — Improvement Roadmap

> A comprehensive plan to evolve this hobby log viewer into a production-grade observability tool.

---

## 📋 Current State Summary

The app is a **client-side-only** React SPA that:
- Accepts JSON-lines log files via drag-and-drop or file picker
- Parses logs with `@timestamp`, `level`, `message`, `trace_id`, `thread_name`, etc.
- Displays a stacked bar timeline (Chart.js) with drag-to-zoom
- Offers dynamic field filters, level toggles, and date-range selection
- Shows thread context in a modal
- Uses Tailwind CSS, ships via Docker/nginx

**Tech stack:** React 19, Chart.js 4, Tailwind 3, CRA (react-scripts 5).

---

## 🏗️ Architecture & Tooling

### 1. Migrate off Create React App
CRA is no longer maintained. Switch to **Vite** for faster dev builds, HMR, and a modern plugin ecosystem.

```
npm create vite@latest -- --template react
```

### 2. Add TypeScript
The entire codebase is plain JS with no type safety. Migrating to TypeScript will:
- Catch bugs at compile time (e.g., optional-chaining on log fields everywhere hints at shape uncertainty)
- Make the dynamic filter system self-documenting
- Enable IDE autocompletion for log entry shapes

### 3. State Management
All state lives in `App.js` via `useState` and is prop-drilled 3+ levels deep. As features grow this becomes fragile.

**Recommendation:** Introduce a lightweight state solution:
- **Zustand** (minimal boilerplate) or **React Context + useReducer** for filter/log state
- Separate concerns: `useLogStore`, `useFilterStore`, `useUIStore`

### 4. Add a Linter & Formatter
- ESLint (with `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`)
- Prettier for consistent formatting
- Husky + lint-staged for pre-commit hooks

---

## 🚀 Performance (Critical for a Log Viewer)

### 5. Virtualized Log List
Currently every visible log renders a full DOM node. With 100k+ lines this will freeze the browser.

**Use `react-window` or `@tanstack/virtual`** to only render the ~30 rows visible in the viewport. This is the single highest-impact change.

### 6. Web Worker for Parsing & Filtering
`JSON.parse` on every line and `JSON.stringify(log).toLowerCase()` for full-text search both block the main thread.

- Move file parsing into a **Web Worker**
- Move filtering (especially the `JSON.stringify` search) into the same worker
- Post results back via `postMessage` with transfer

### 7. Debounce Search Input
Every keystroke in the search box re-filters all logs synchronously. Add a 200ms debounce to `searchText` changes.

### 8. Memoize Child Components
`LogEntry` and `LogStats` re-render on every filter change. Wrap them in `React.memo` and stabilise callback references with `useCallback`.

### 9. Indexed Search
Build a lightweight inverted index on load (or in the worker) so free-text search doesn't need `JSON.stringify` + `includes` on every log entry every time.

---

## ✨ Feature Additions

### 10. Live Log Tailing (WebSocket / SSE)
Allow connecting to a backend log source (e.g., a simple Express server that streams a file, or a Loki/Elasticsearch endpoint) so logs arrive in real-time instead of only via file upload.

### 11. Multi-Format Parser Support
Currently only JSON-lines are supported. Add parsers for:
- **Common Log Format** (Apache/nginx access logs)
- **Syslog (RFC 5424)**
- **Log4j / Logback pattern layouts** (configurable regex)
- **CSV / TSV logs**
- Auto-detection based on the first few lines

### 12. Saved Views & Shareable URLs
- Encode filter state in the URL query string so a view can be shared or bookmarked
- Persist recent filter presets to `localStorage`

### 13. Log Correlation: Trace Waterfall
The data already has `trace_id` and `span_id`. Build a **trace waterfall** view (like Jaeger/Zipkin) grouping all entries under a trace into a timeline with parent-child span relationships.

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

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| 🔴 P0 | Virtualized log list (#5) | Very High | Medium |
| 🔴 P0 | Migrate to Vite (#1) | High | Low |
| 🟠 P1 | Web Worker parsing (#6) | High | Medium |
| 🟠 P1 | TypeScript migration (#2) | High | Medium |
| 🟠 P1 | Debounce + memoisation (#7, #8) | High | Low |
| 🟡 P2 | Dark mode (#19) | Medium | Low |
| 🟡 P2 | Regex / query DSL search (#14) | High | Medium |
| 🟡 P2 | URL-encoded filter state (#12) | Medium | Low |
| 🟡 P2 | Multi-format parsers (#11) | High | Medium |
| 🟢 P3 | Trace waterfall (#13) | High | High |
| 🟢 P3 | Live tailing (#10) | High | High |
| 🟢 P3 | DuckDB-WASM queries (#32) | Very High | High |
| 🟢 P3 | Plugin system (#33) | Medium | High |

---

## 🗓️ Suggested Phases

### Phase 1 — Foundation (1–2 weeks)
Vite migration, TypeScript, ESLint/Prettier, virtualized list, debounce, `React.memo`.

### Phase 2 — Core Power Features (2–4 weeks)
Web Worker parsing, regex/query search, multi-format parsers, dark mode, URL state, export.

### Phase 3 — Observability Features (4–6 weeks)
Trace waterfall, live tailing, anomaly detection, log diffing, DuckDB-WASM.

### Phase 4 — Polish & Ecosystem (ongoing)
Plugin system, a11y audit, E2E tests, CI/CD, optional backend integrations, docs site.

---

*Generated for **log-reader-ui** · May 2026*

