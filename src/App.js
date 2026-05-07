import React, { useState, useEffect, useRef, useCallback } from 'react';
import LogEntry from './components/LogEntry';
import LogFilters from './components/LogFilters';
import LogStats from './components/LogStats';
import ThreadModal from './components/ThreadModal';

function App() {
  const [allLogs, setAllLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [displayedLogsCount, setDisplayedLogsCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [filters, setFilters] = useState({
    searchText: '',
    traceId: '',
    tenantId: '',
    loggerName: '',
    dateFrom: '',
    dateTo: '',
    levels: { info: true, error: true, warn: true, debug: true }
  });
  const [threadModal, setThreadModal] = useState({
    isOpen: false,
    threadName: '',
    logs: [],
    currentLogIndex: -1
  });

  const logsContainerRef = useRef(null);
  const LOGS_PER_PAGE = 100;

  // File upload handler
  const handleFileSelect = useCallback((files) => {
    if (files.length === 0) return;

    const newAllLogs = [];
    let filesProcessed = 0;
    const totalFiles = files.length;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const content = e.target.result;
        const lines = content.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          try {
            const logEntry = JSON.parse(line);
            if (logEntry?.['@timestamp']) {
              newAllLogs.push(logEntry);
            }
          } catch (e) {
            console.warn('Failed to parse log line:', line);
          }
        });

        filesProcessed++;
        
        if (filesProcessed === totalFiles) {
          // Sort logs by timestamp
          newAllLogs.sort((a, b) => new Date(a?.['@timestamp'] || 0) - new Date(b?.['@timestamp'] || 0));
          setAllLogs(newAllLogs);
        }
      };
      reader.readAsText(file);
    });
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  }, [handleFileSelect]);

  // Apply filters
  useEffect(() => {
    const { searchText, dateFrom, dateTo, levels, ...dynamicFilters } = filters;
    const enabledLevels = Object.keys(levels).filter(level => levels[level]).map(level => level.toUpperCase());

    const filtered = allLogs.filter(log => {
      if (!enabledLevels.includes(log?.level)) return false;

      if (searchText) {
        const logString = JSON.stringify(log).toLowerCase();
        if (!logString.includes(searchText.toLowerCase())) return false;
      }

      for (const [filterKey, filterValue] of Object.entries(dynamicFilters)) {
        if (filterValue && filterValue.trim()) {
          const logValue = log?.[filterKey];
          if (logValue === null || logValue === undefined) return false;
          const logValueString = logValue.toString().toLowerCase();
          const filterValueString = filterValue.toLowerCase();
          if (!logValueString.includes(filterValueString)) return false;
        }
      }

      const logDate = new Date(log?.['@timestamp']);
      if (dateFrom && logDate < new Date(dateFrom)) return false;
      if (dateTo && logDate > new Date(dateTo)) return false;

      return true;
    });

    setFilteredLogs(filtered);
    setDisplayedLogsCount(Math.min(LOGS_PER_PAGE, filtered.length));
  }, [allLogs, filters]);

  // Load more logs
  const loadMoreLogs = useCallback(() => {
    if (isLoadingMore || displayedLogsCount >= filteredLogs.length) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayedLogsCount(prev => Math.min(prev + LOGS_PER_PAGE, filteredLogs.length));
      setIsLoadingMore(false);
    }, 100);
  }, [isLoadingMore, displayedLogsCount, filteredLogs.length]);

  // Scroll handler
  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setShowScrollTop(scrollTop > 400);
    if (scrollTop + clientHeight >= scrollHeight - 200 && !isLoadingMore) {
      loadMoreLogs();
    }
  }, [loadMoreLogs, isLoadingMore]);

  const scrollToTop = () => {
    logsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Clear logs
  const clearLogs = () => {
    setAllLogs([]);
    setFilteredLogs([]);
    setDisplayedLogsCount(0);
  };

  // Show thread context
  const showThreadContext = (threadName, currentIndex) => {
    if (!threadName || threadName === 'N/A') {
      alert('No thread information available for this log entry.');
      return;
    }

    const currentLog = filteredLogs[currentIndex];
    const threadLogs = allLogs.filter(log => log?.thread_name === threadName);
    
    if (threadLogs.length === 0) {
      alert('No logs found for this thread.');
      return;
    }

    // Sort by timestamp
    threadLogs.sort((a, b) => new Date(a?.['@timestamp'] || 0) - new Date(b?.['@timestamp'] || 0));
    
    // Find the current log in the thread logs
    const currentLogIndex = threadLogs.findIndex(log => 
      log?.['@timestamp'] === currentLog?.['@timestamp'] && 
      log?.message === currentLog?.message
    );

    setThreadModal({ isOpen: true, threadName, logs: threadLogs, currentLogIndex });
  };

  const closeThreadModal = () => {
    setThreadModal({ isOpen: false, threadName: '', logs: [], currentLogIndex: -1 });
  };

  // Keyboard shortcut: toggle filters
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setIsFiltersOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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
            <div className="text-white/60 text-sm mt-1">.log, .txt, .json</div>
          </div>
        </div>
      )}

      {/* Header - slim & minimal */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <h1 className="text-base font-semibold text-slate-800 tracking-tight">Log Reader</h1>
          {allLogs.length > 0 && (
            <span className="text-xs text-slate-400 font-mono">{allLogs.length.toLocaleString()} entries</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFiltersOpen(prev => !prev)}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
              isFiltersOpen
                ? 'bg-slate-100 text-slate-700'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
            title="Toggle filters (Ctrl+K)"
          >
            ⚙ Filters
          </button>
          <kbd className="hidden md:inline-block text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">Ctrl+K</kbd>
        </div>
      </header>

      {/* Stats bar */}
      <LogStats totalLogs={allLogs.length} filteredLogs={filteredLogs} />

      {/* Filters panel */}
      {isFiltersOpen && (
        <div className="flex-shrink-0">
          <LogFilters
            filters={filters}
            setFilters={setFilters}
            onFileSelect={handleFileSelect}
            onClearLogs={clearLogs}
            allLogs={allLogs}
          />
        </div>
      )}

      {/* Logs Container */}
      <div
        ref={logsContainerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 select-none">
            {allLogs.length === 0 ? (
              <>
                <div className="text-6xl mb-4 opacity-30">📋</div>
                <h3 className="text-lg font-medium text-slate-500">No logs loaded</h3>
                <p className="text-sm mt-1">Drag & drop files here or use the file picker</p>
                <p className="text-xs mt-4 text-slate-300">Supported: .log, .txt, .json (JSON lines)</p>
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
          <div className="divide-y divide-slate-100">
            {filteredLogs.slice(0, displayedLogsCount).map((log, index) => (
              <LogEntry
                key={`${log['@timestamp']}-${index}`}
                log={log}
                index={index}
                onShowThreadContext={showThreadContext}
              />
            ))}

            {displayedLogsCount < filteredLogs.length && (
              <div className="px-5 py-4 text-center">
                <div className="text-xs text-slate-400">
                  {isLoadingMore ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></span>
                      Loading...
                    </span>
                  ) : (
                    <span>{displayedLogsCount.toLocaleString()} of {filteredLogs.length.toLocaleString()} · Scroll for more</span>
                  )}
                </div>
              </div>
            )}
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
