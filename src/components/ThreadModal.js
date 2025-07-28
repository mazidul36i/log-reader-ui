import React, { useState, useEffect, useRef } from 'react';

const ThreadModal = ({ isOpen, threadName, logs, currentLogIndex, onClose }) => {
  const [displayStartIndex, setDisplayStartIndex] = useState(0);
  const [displayEndIndex, setDisplayEndIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMatches, setSearchMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  
  const modalContentRef = useRef(null);
  const contextRange = 5;

  useEffect(() => {
    if (isOpen && logs.length > 0) {
      const startIndex = Math.max(0, currentLogIndex - contextRange);
      const endIndex = Math.min(logs.length - 1, currentLogIndex + contextRange);
      setDisplayStartIndex(startIndex);
      setDisplayEndIndex(endIndex);
      setSearchTerm('');
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      setIsSearchVisible(false);
    }
  }, [isOpen, logs, currentLogIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        if (isSearchVisible) {
          setIsSearchVisible(false);
          setSearchTerm('');
          setSearchMatches([]);
          setCurrentMatchIndex(-1);
        } else {
          onClose();
        }
      }
      
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setIsSearchVisible(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSearchVisible, onClose]);

  const updateSearchMatches = (term) => {
    if (!term) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const displayedLogs = logs.slice(displayStartIndex, displayEndIndex + 1);
    const matches = [];
    
    displayedLogs.forEach((log, relativeIndex) => {
      if ((log?.message || '').toLowerCase().includes(term.toLowerCase())) {
        const actualIndex = displayStartIndex + relativeIndex;
        matches.push({ index: actualIndex, log, relativeIndex });
      }
    });

    setSearchMatches(matches);
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
  };

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    updateSearchMatches(term);
  };

  const navigateSearchMatch = (direction) => {
    if (searchMatches.length === 0) return;

    let newIndex = currentMatchIndex;
    if (direction === 'next' && currentMatchIndex < searchMatches.length - 1) {
      newIndex = currentMatchIndex + 1;
    } else if (direction === 'prev' && currentMatchIndex > 0) {
      newIndex = currentMatchIndex - 1;
    }

    setCurrentMatchIndex(newIndex);
    
    // Scroll to the match
    const match = searchMatches[newIndex];
    if (match) {
      const element = document.getElementById(`thread-log-${match.index}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const loadMoreLogs = (direction) => {
    const loadAmount = 10;
    
    if (direction === 'top') {
      setDisplayStartIndex(Math.max(0, displayStartIndex - loadAmount));
    } else if (direction === 'bottom') {
      setDisplayEndIndex(Math.min(logs.length - 1, displayEndIndex + loadAmount));
    }
  };

  const formatEmptyValue = (value) => {
    return value || <span className="text-gray-400 italic">-</span>;
  };

  const highlightSearchTerm = (text, term) => {
    if (!term || !text) return text;
    
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  if (!isOpen) return null;

  const displayedLogs = logs.slice(displayStartIndex, displayEndIndex + 1);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[80vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Thread Context: {threadName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Search Widget */}
        {isSearchVisible && (
          <div className="absolute top-20 right-6 bg-white border border-gray-300 rounded-lg shadow-lg z-10 min-w-80">
            <div className="flex justify-between items-center p-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                🔍 Search in Thread
              </span>
              <button
                onClick={() => setIsSearchVisible(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-3">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search messages..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                autoFocus
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">
                  {searchMatches.length > 0 
                    ? `${currentMatchIndex + 1} of ${searchMatches.length}` 
                    : searchTerm ? '0 matches' : '0 matches'
                  }
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => navigateSearchMatch('prev')}
                    disabled={searchMatches.length === 0 || currentMatchIndex <= 0}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ⬆️
                  </button>
                  <button
                    onClick={() => navigateSearchMatch('next')}
                    disabled={searchMatches.length === 0 || currentMatchIndex >= searchMatches.length - 1}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ⬇️
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Content */}
        <div ref={modalContentRef} className="flex-1 overflow-y-auto p-6">
          {/* Thread Info */}
          <div className="mb-4 p-4 bg-gray-100 rounded-lg">
            <div className="text-sm">
              <div><strong>Thread:</strong> {formatEmptyValue(threadName)}</div>
              <div><strong>Total logs in thread:</strong> {logs.length}</div>
              <div><strong>Showing:</strong> {displayedLogs.length} logs ({displayStartIndex + 1} to {displayEndIndex + 1} of {logs.length})</div>
              {searchTerm && <div><strong>Search matches:</strong> {searchMatches.length} found</div>}
            </div>
          </div>

          {/* Load More Top Button */}
          {displayStartIndex > 0 && (
            <button
              onClick={() => loadMoreLogs('top')}
              className="w-full mb-4 bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
            >
              ⬆️ Load {Math.min(10, displayStartIndex)} Earlier Logs
            </button>
          )}

          {/* Thread Logs */}
          <div className="space-y-3">
            {displayedLogs.map((log, relativeIndex) => {
              const actualIndex = displayStartIndex + relativeIndex;
              const isCurrentLog = actualIndex === currentLogIndex;
              const isSearchMatch = searchTerm && searchMatches.some(match => match.index === actualIndex);
              const isCurrentMatch = searchTerm && searchMatches.findIndex(match => match.index === actualIndex) === currentMatchIndex;
              
              return (
                <div
                  key={actualIndex}
                  id={`thread-log-${actualIndex}`}
                  className={`border rounded-lg overflow-hidden ${
                    isCurrentLog 
                      ? 'border-blue-500 bg-blue-50' 
                      : isCurrentMatch
                      ? 'border-blue-400 bg-blue-50 shadow-md'
                      : isSearchMatch
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Thread Log Header */}
                  <div className={`p-3 ${
                    isCurrentLog 
                      ? 'bg-blue-100' 
                      : isCurrentMatch
                      ? 'bg-blue-100'
                      : isSearchMatch
                      ? 'bg-green-100'
                      : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        (log?.level || '').toLowerCase() === 'info' ? 'bg-cyan-100 text-cyan-800' :
                        (log?.level || '').toLowerCase() === 'error' ? 'bg-red-100 text-red-800' :
                        (log?.level || '').toLowerCase() === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                        (log?.level || '').toLowerCase() === 'debug' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log?.level || ''}
                      </span>
                      <span className="text-gray-500 font-mono text-xs">
                        {log?.['@timestamp'] ? new Date(log['@timestamp']).toLocaleString() : ''}
                      </span>
                      {isCurrentLog && (
                        <span className="text-blue-600 font-semibold text-xs">← Current Log</span>
                      )}
                      {isSearchMatch && (
                        <span className="text-green-600 font-semibold text-xs">
                          🔍 Match {searchMatches.findIndex(match => match.index === actualIndex) + 1}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Thread Log Content */}
                  <div className="p-3 bg-white font-mono text-xs space-y-2">
                    <div>
                      <strong>Message:</strong> {
                        searchTerm 
                          ? highlightSearchTerm(log?.message || '', searchTerm)
                          : formatEmptyValue(log?.message)
                      }
                    </div>
                    <div><strong>Logger:</strong> {formatEmptyValue(log?.logger_name)}</div>
                    <div><strong>Trace ID:</strong> {formatEmptyValue(log?.trace_id)}</div>
                    <div><strong>Span ID:</strong> {formatEmptyValue(log?.span_id)}</div>
                    {log?.stack_trace && (
                      <div>
                        <strong>Stack Trace:</strong>
                        <pre className="whitespace-pre-wrap text-xs mt-1 bg-gray-800 text-green-400 p-2 rounded max-h-32 overflow-y-auto">
                          {log.stack_trace}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Bottom Button */}
          {displayEndIndex < logs.length - 1 && (
            <button
              onClick={() => loadMoreLogs('bottom')}
              className="w-full mt-4 bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
            >
              ⬇️ Load {Math.min(10, logs.length - 1 - displayEndIndex)} Later Logs
            </button>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>Press Ctrl+F to search, Escape to close</div>
            <button
              onClick={() => setIsSearchVisible(!isSearchVisible)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors duration-200"
            >
              {isSearchVisible ? 'Hide Search' : 'Show Search'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreadModal;
