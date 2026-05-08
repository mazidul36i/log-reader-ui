import { useEffect, useRef, useCallback, useMemo } from 'react';
import type { DragEvent, UIEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import LogEntry from './components/LogEntry';
import LogFilters from './components/LogFilters';
import LogStats from './components/LogStats';
import LogTimeline from './components/LogTimeline';
import ThreadModal from './components/ThreadModal';
import useLogStore from './stores/useLogStore';
import useFilterStore from './stores/useFilterStore';
import useUIStore from './stores/useUIStore';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { useUrlSync } from './hooks/useUrlSync';

function App() {
  // ── URL ↔ Filter sync ────────────────────────────────────────────────────────
  useUrlSync();

  // ── Stores ──────────────────────────────────────────────────────────────────
  const allLogs = useLogStore((s) => s.allLogs);
  const filteredLogs = useLogStore((s) => s.filteredLogs);
  const logsForTimeline = useLogStore((s) => s.logsForTimeline);
  const loadFiles = useLogStore((s) => s.loadFiles);
  const clearLogs = useLogStore((s) => s.clearLogs);
  const applyFilters = useLogStore((s) => s.applyFilters);

  const filters = useFilterStore((s) => s.filters);
  const setFilters = useFilterStore((s) => s.setFilters);

  // Debounce search text (200ms) so we don't re-filter on every keystroke.
  // Other filters (levels, date range, field filters) apply instantly.
  const debouncedSearchText = useDebouncedValue(filters.searchText, 200);
  const effectiveFilters = useMemo(
    () => ({ ...filters, searchText: debouncedSearchText }),
    [filters, debouncedSearchText],
  );

  const isDragging = useUIStore((s) => s.isDragging);
  const setIsDragging = useUIStore((s) => s.setIsDragging);
  const isFiltersOpen = useUIStore((s) => s.isFiltersOpen);
  const toggleFilters = useUIStore((s) => s.toggleFilters);
  const showScrollTop = useUIStore((s) => s.showScrollTop);
  const setShowScrollTop = useUIStore((s) => s.setShowScrollTop);
  const threadModal = useUIStore((s) => s.threadModal);
  const openThreadModal = useUIStore((s) => s.openThreadModal);
  const closeThreadModal = useUIStore((s) => s.closeThreadModal);

  const logsContainerRef = useRef<HTMLDivElement>(null);

  // ── Drag and drop handlers ─────────────────────────────────────────────────
  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    },
    [setIsDragging],
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.currentTarget === e.target) {
        setIsDragging(false);
      }
    },
    [setIsDragging],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        loadFiles(files);
      }
    },
    [setIsDragging, loadFiles],
  );

  // ── Apply filters whenever allLogs or filters change ───────────────────────
  useEffect(() => {
    applyFilters(effectiveFilters);
  }, [allLogs, effectiveFilters, applyFilters]);

  // ── Scroll handler (just for scroll-to-top button) ──────────────────────────
  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      setShowScrollTop(target.scrollTop > 400);
    },
    [setShowScrollTop],
  );

  const scrollToTop = () => {
    logsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Virtualizer ────────────────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => logsContainerRef.current,
    estimateSize: () => 44, // estimated collapsed row height
    overscan: 20,
  });

  // ── Thread context ─────────────────────────────────────────────────────────
  const showThreadContext = useCallback(
    (threadName: string, currentIndex: number) => {
      if (!threadName || threadName === 'N/A') {
        alert('No thread information available for this log entry.');
        return;
      }

      const currentLog = filteredLogs[currentIndex];
      const threadLogs = allLogs.filter((log) => log?.thread_name === threadName);

      if (threadLogs.length === 0) {
        alert('No logs found for this thread.');
        return;
      }

      threadLogs.sort(
        (a, b) =>
          new Date(a['@timestamp'] || 0).getTime() - new Date(b['@timestamp'] || 0).getTime(),
      );

      const currentLogIndex = threadLogs.findIndex(
        (log) =>
          log?.['@timestamp'] === currentLog?.['@timestamp'] &&
          log?.message === currentLog?.message,
      );

      openThreadModal({ threadName, logs: threadLogs, currentLogIndex });
    },
    [allLogs, filteredLogs, openThreadModal],
  );

  // ── Keyboard shortcut: toggle filters ──────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        toggleFilters();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleFilters]);

  return (
    <div
      className="h-screen bg-slate-50 flex flex-col relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-white/60 rounded-2xl p-16 text-center">
            <div className="text-5xl mb-4">📄</div>
            <div className="text-white text-xl font-medium">Drop log files here</div>
            <div className="text-white/60 text-sm mt-1">.log, .txt, .json, .csv, .tsv</div>
          </div>
        </div>
      )}

      {/* Header - slim & minimal */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <h1 className="text-base font-semibold text-slate-800 tracking-tight">Log Reader</h1>
          {allLogs.length > 0 && (
            <span className="text-xs text-slate-400 font-mono">
              {allLogs.length.toLocaleString()} entries
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFilters}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
              isFiltersOpen ? 'bg-slate-100 text-slate-700' : 'text-slate-500 hover:bg-slate-50'
            }`}
            title="Toggle filters (Ctrl+K)"
          >
            ⚙ Filters
          </button>
          <kbd className="hidden md:inline-block text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
            Ctrl+K
          </kbd>
        </div>
      </header>

      {/* Stats bar */}
      <LogStats totalLogs={allLogs.length} filteredLogs={filteredLogs} />

      {/* Timeline histogram */}
      <LogTimeline
        logs={logsForTimeline}
        allLogs={allLogs}
        filters={filters}
        setFilters={setFilters}
      />

      {/* Filters panel */}
      {isFiltersOpen && (
        <div className="flex-shrink-0">
          <LogFilters
            filters={filters}
            setFilters={setFilters}
            onFileSelect={loadFiles}
            onClearLogs={clearLogs}
            allLogs={allLogs}
          />
        </div>
      )}

      {/* Logs Container */}
      <div ref={logsContainerRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 select-none">
            {allLogs.length === 0 ? (
              <>
                <div className="text-6xl mb-4 opacity-30">📋</div>
                <h3 className="text-lg font-medium text-slate-500">No logs loaded</h3>
                <p className="text-sm mt-1">Drag & drop files here or use the file picker</p>
                <p className="text-xs mt-4 text-slate-300">
                  Supported: .log, .txt, .json, .csv, .tsv (auto-detected)
                </p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-4 opacity-30">🔍</div>
                <h3 className="text-lg font-medium text-slate-500">No matching logs</h3>
                <p className="text-sm mt-1">Try adjusting your filters</p>
              </>
            )}
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const log = filteredLogs[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="border-b border-slate-100"
                >
                  <LogEntry
                    log={log}
                    index={virtualRow.index}
                    onShowThreadContext={showThreadContext}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 w-10 h-10 bg-white border border-slate-200 rounded-full shadow-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:shadow-xl transition-all"
          title="Scroll to top"
        >
          ↑
        </button>
      )}

      {/* Thread Modal */}
      <ThreadModal
        isOpen={threadModal.isOpen}
        threadName={threadModal.threadName}
        logs={threadModal.logs}
        currentLogIndex={threadModal.currentLogIndex}
        onClose={closeThreadModal}
      />
    </div>
  );
}

export default App;
