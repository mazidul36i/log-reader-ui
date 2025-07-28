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

  // Apply filters
  useEffect(() => {
    const { searchText, dateFrom, dateTo, levels, ...dynamicFilters } = filters;
    
    const enabledLevels = Object.keys(levels).filter(level => levels[level]).map(level => level.toUpperCase());

    const filtered = allLogs.filter(log => {
      // Level filter
      if (!enabledLevels.includes(log?.level)) return false;

      // Search text filter - search in entire log JSON
      if (searchText) {
        const logString = JSON.stringify(log).toLowerCase();
        if (!logString.includes(searchText.toLowerCase())) return false;
      }

      // Dynamic filters - handle any field dynamically
      for (const [filterKey, filterValue] of Object.entries(dynamicFilters)) {
        if (filterValue && filterValue.trim()) {
          const logValue = log?.[filterKey];
          if (logValue === null || logValue === undefined) return false;
          
          const logValueString = logValue.toString().toLowerCase();
          const filterValueString = filterValue.toLowerCase();
          
          if (!logValueString.includes(filterValueString)) return false;
        }
      }

      // Date range filter
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

  // Scroll handler for infinite loading
  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 200 && !isLoadingMore) {
      loadMoreLogs();
    }
  }, [loadMoreLogs, isLoadingMore]);

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

    setThreadModal({
      isOpen: true,
      threadName,
      logs: threadLogs,
      currentLogIndex
    });
  };

  const closeThreadModal = () => {
    setThreadModal({
      isOpen: false,
      threadName: '',
      logs: [],
      currentLogIndex: -1
    });
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="w-full bg-white shadow-lg overflow-hidden flex flex-col h-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 text-center flex-shrink-0">
          <h1 className="text-3xl font-bold">Microservice Log Reader</h1>
          <p className="mt-2 text-indigo-100">Upload and analyze your JSON log files with advanced filtering</p>
        </div>

        {/* Controls */}
        <div className="flex-shrink-0">
          <LogFilters 
            filters={filters}
            setFilters={setFilters}
            onFileSelect={handleFileSelect}
            onClearLogs={clearLogs}
            allLogs={allLogs}
          />
        </div>

        {/* Stats */}
        <div className="flex-shrink-0">
          <LogStats 
            totalLogs={allLogs.length}
            filteredLogs={filteredLogs}
          />
        </div>

        {/* Logs Container */}
        <div 
          ref={logsContainerRef}
          className="flex-1 overflow-y-auto p-6"
          onScroll={handleScroll}
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <h3 className="text-lg font-semibold">
                {allLogs.length === 0 ? 'No logs loaded' : 'No logs match the current filters'}
              </h3>
              <p className="mt-2">
                {allLogs.length === 0 
                  ? 'Please select a log file to begin analysis'
                  : 'Try adjusting your filter criteria'
                }
              </p>
            </div>
          ) : (
            <>
              {filteredLogs.slice(0, displayedLogsCount).map((log, index) => (
                <LogEntry
                  key={`${log['@timestamp']}-${index}`}
                  log={log}
                  index={index}
                  onShowThreadContext={showThreadContext}
                />
              ))}
              
              {displayedLogsCount < filteredLogs.length && (
                <div className="text-center py-6 text-gray-500">
                  <div className="bg-gray-100 border border-gray-200 rounded-lg p-4">
                    <div className="font-semibold">
                      Showing {displayedLogsCount} of {filteredLogs.length} logs
                    </div>
                    <div className="text-sm mt-1">
                      {isLoadingMore ? 'Loading more logs...' : 'Scroll down to load more...'}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

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
