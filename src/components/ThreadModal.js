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
      setDisplayStartIndex(Math.max(0, currentLogIndex - contextRange));
      setDisplayEndIndex(Math.min(logs.length - 1, currentLogIndex + contextRange));
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
        matches.push({ index: displayStartIndex + relativeIndex, log, relativeIndex });
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
    if (direction === 'next' && currentMatchIndex < searchMatches.length - 1) newIndex++;
    else if (direction === 'prev' && currentMatchIndex > 0) newIndex--;
    setCurrentMatchIndex(newIndex);
    const match = searchMatches[newIndex];
    if (match) {
      document.getElementById(`thread-log-${match.index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const loadMoreLogs = (direction) => {
    const amount = 10;
    if (direction === 'top') setDisplayStartIndex(Math.max(0, displayStartIndex - amount));
    else setDisplayEndIndex(Math.min(logs.length - 1, displayEndIndex + amount));
  };

  const highlightSearchTerm = (text, term) => {
    if (!term || !text) return text;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark> : part);
  };

  const getLevelColor = (level) => {
    const l = (level || '').toLowerCase();
    switch (l) {
      case 'info': return 'bg-sky-500';
      case 'error': return 'bg-red-500';
      case 'warn': return 'bg-amber-500';
      case 'debug': return 'bg-emerald-500';
      default: return 'bg-slate-400';
    }
  };

  if (!isOpen) return null;

  const displayedLogs = logs.slice(displayStartIndex, displayEndIndex + 1);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-800">Thread Context</h2>
            <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{threadName}</span>
            <span className="text-[11px] text-slate-400">{logs.length} logs</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchVisible(!isSearchVisible)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${isSearchVisible ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              Search
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors">
              ×
            </button>
          </div>
        </div>

        {/* Search bar */}
        {isSearchVisible && (
          <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
            <div className="flex-1 relative">
              <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search in thread messages..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 bg-slate-50 placeholder-slate-300"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 min-w-[60px] text-right tabular-nums">
                {searchMatches.length > 0 ? `${currentMatchIndex + 1}/${searchMatches.length}` : searchTerm ? 'No match' : ''}
              </span>
              <button onClick={() => navigateSearchMatch('prev')} disabled={searchMatches.length === 0 || currentMatchIndex <= 0}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30 text-xs">↑</button>
              <button onClick={() => navigateSearchMatch('next')} disabled={searchMatches.length === 0 || currentMatchIndex >= searchMatches.length - 1}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30 text-xs">↓</button>
            </div>
          </div>
        )}

        {/* Content */}
        <div ref={modalContentRef} className="flex-1 overflow-y-auto">
          {/* Info bar */}
          <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 text-[11px] text-slate-400 flex items-center gap-4 flex-shrink-0">
            <span>Showing {displayStartIndex + 1}–{displayEndIndex + 1} of {logs.length}</span>
            {searchTerm && <span>{searchMatches.length} matches</span>}
          </div>

          {/* Load earlier */}
          {displayStartIndex > 0 && (
            <button onClick={() => loadMoreLogs('top')} className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors border-b border-slate-100">
              ↑ Load {Math.min(10, displayStartIndex)} earlier
            </button>
          )}

          {/* Thread logs */}
          <div className="divide-y divide-slate-50">
            {displayedLogs.map((log, relativeIndex) => {
              const actualIndex = displayStartIndex + relativeIndex;
              const isCurrentLog = actualIndex === currentLogIndex;
              const isSearchMatch = searchTerm && searchMatches.some(m => m.index === actualIndex);
              const isCurrentMatch = searchTerm && searchMatches.findIndex(m => m.index === actualIndex) === currentMatchIndex;

              return (
                <div
                  key={actualIndex}
                  id={`thread-log-${actualIndex}`}
                  className={`px-5 py-3 transition-colors ${
                    isCurrentLog ? 'bg-blue-50/50 border-l-2 border-l-blue-400' :
                    isCurrentMatch ? 'bg-amber-50/50 border-l-2 border-l-amber-400' :
                    isSearchMatch ? 'bg-emerald-50/30 border-l-2 border-l-emerald-300' :
                    'border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${getLevelColor(log?.level)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {log?.['@timestamp'] ? new Date(log['@timestamp']).toLocaleString() : ''}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">{log?.level}</span>
                        {isCurrentLog && <span className="text-[10px] font-medium text-blue-500">← current</span>}
                        {isSearchMatch && <span className="text-[10px] font-medium text-emerald-500">match</span>}
                      </div>
                      <div className="text-xs text-slate-700 font-mono leading-relaxed break-all">
                        {searchTerm ? highlightSearchTerm(log?.message || '', searchTerm) : (log?.message || <span className="text-slate-300">—</span>)}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-[10px] text-slate-400 font-mono">
                        {log?.logger_name && <span title="Logger">{log.logger_name}</span>}
                        {log?.trace_id && <span title="Trace ID">trace:{log.trace_id.substring(0, 8)}</span>}
                        {log?.span_id && <span title="Span ID">span:{log.span_id.substring(0, 8)}</span>}
                      </div>
                      {log?.stack_trace && (
                        <pre className="mt-2 bg-slate-800 text-emerald-400 px-3 py-2 rounded text-[10px] leading-relaxed whitespace-pre-wrap max-h-28 overflow-y-auto font-mono">
                          {log.stack_trace}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load later */}
          {displayEndIndex < logs.length - 1 && (
            <button onClick={() => loadMoreLogs('bottom')} className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors border-t border-slate-100">
              ↓ Load {Math.min(10, logs.length - 1 - displayEndIndex)} later
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><kbd className="bg-slate-100 px-1 rounded text-[10px] border border-slate-200 font-mono">Ctrl+F</kbd> Search</span>
            <span className="flex items-center gap-1"><kbd className="bg-slate-100 px-1 rounded text-[10px] border border-slate-200 font-mono">Esc</kbd> Close</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreadModal;
