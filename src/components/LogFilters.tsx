import { useRef, useState, useEffect } from 'react';
import type { LogEntry, Filters } from '../types';
import SavedPresets from './SavedPresets';

// Convert any parseable date string (ISO, datetime-local, etc.) to
// the "YYYY-MM-DDTHH:mm:ss" format that <input type="datetime-local"> needs.
const toDateTimeLocalValue = (v: string): string => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

interface FilterConfig {
  key: string;
  label: string;
  placeholder: string;
}

interface LogFiltersProps {
  filters: Filters;
  setFilters: (updater: Filters | ((prev: Filters) => Filters)) => void;
  onFileSelect: (files: FileList | File[]) => void;
  onClearLogs: () => void;
  allLogs?: LogEntry[];
}

const LogFilters = ({ filters, setFilters, onFileSelect, onClearLogs, allLogs = [] }: LogFiltersProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dateRangeRef = useRef<HTMLDivElement>(null);
  const addFilterRef = useRef<HTMLDivElement>(null);
  const [isLevelDropdownOpen, setIsLevelDropdownOpen] = useState(false);
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [isAddFilterOpen, setIsAddFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>(['searchText']);
  const [pendingFilter, setPendingFilter] = useState<FilterConfig | null>(null);
  const [pendingValue, setPendingValue] = useState('');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLevelDropdownOpen(false);
      }
      if (dateRangeRef.current && !dateRangeRef.current.contains(event.target as Node)) {
        setIsDateRangeOpen(false);
      }
      if (addFilterRef.current && !addFilterRef.current.contains(event.target as Node)) {
        setIsAddFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) onFileSelect(e.target.files);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev: Filters) => ({ ...prev, [key]: value }));
  };

  const handleLevelChange = (level: string, checked: boolean) => {
    setFilters((prev: Filters) => ({
      ...prev,
      levels: { ...prev.levels, [level]: checked },
    }));
  };

  const getLevelDropdownText = () => {
    const selectedLevels = Object.keys(filters.levels).filter((level) => filters.levels[level]);
    if (selectedLevels.length === 0) return 'None';
    if (selectedLevels.length === 4) return 'All';
    if (selectedLevels.length === 1) return selectedLevels[0].toUpperCase();
    return `${selectedLevels.length} selected`;
  };

  const getDateRangeDisplayText = () => {
    const fmt = (v: string) =>
      new Date(v).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    if (filters.dateFrom && filters.dateTo) {
      return `${fmt(filters.dateFrom)} – ${fmt(filters.dateTo)}`;
    } else if (filters.dateFrom) {
      return `From ${fmt(filters.dateFrom)}`;
    } else if (filters.dateTo) {
      return `Until ${fmt(filters.dateTo)}`;
    }
    return 'Any time';
  };

  const clearDateRange = () => {
    handleFilterChange('dateFrom', '');
    handleFilterChange('dateTo', '');
    setIsDateRangeOpen(false);
  };

  const generateAvailableFilters = (): FilterConfig[] => {
    const defaultFilters: FilterConfig[] = [
      { key: 'trace_id', label: 'Trace ID', placeholder: 'Filter by trace ID...' },
      { key: 'tenantId', label: 'Tenant ID', placeholder: 'Filter by tenant ID...' },
      { key: 'loggerName', label: 'Logger Name', placeholder: 'Filter by logger name...' },
      { key: 'mtxs', label: 'MTXS', placeholder: 'Filter by MTXS...' },
    ];

    if (!allLogs || allLogs.length === 0) return defaultFilters;

    const fieldMap = new Set<string>();
    const sampleSize = Math.min(100, allLogs.length);
    const defaultKeys = new Set(defaultFilters.map((f) => f.key));

    for (let i = 0; i < sampleSize; i++) {
      const log = allLogs[i];
      if (log && typeof log === 'object') {
        Object.keys(log).forEach((key) => {
          if (
            !['@timestamp', 'level', 'message', '@version'].includes(key) &&
            !defaultKeys.has(key)
          ) {
            const value = log[key];
            if (
              value !== null &&
              value !== undefined &&
              (typeof value === 'string' || typeof value === 'number') &&
              value !== ''
            ) {
              fieldMap.add(key);
            }
          }
        });
      }
    }

    const dynamicFilters = Array.from(fieldMap)
      .map((key) => {
        const label = key
          .replace(/_/g, ' ')
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase())
          .trim();
        return { key, label, placeholder: `Filter by ${label.toLowerCase()}...` };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    return [...defaultFilters, ...dynamicFilters];
  };

  const availableFilters = generateAvailableFilters();

  const startAddingFilter = (filterKey: string) => {
    const filterConfig = availableFilters.find((f) => f.key === filterKey);
    setPendingFilter(filterConfig || null);
    setPendingValue('');
    setIsAddFilterOpen(false);
  };

  const applyPendingFilter = () => {
    if (pendingFilter && pendingValue.trim()) {
      setActiveFilters((prev) => [...prev, pendingFilter.key]);
      handleFilterChange(pendingFilter.key, pendingValue.trim());
      setPendingFilter(null);
      setPendingValue('');
    }
  };

  const cancelPendingFilter = () => {
    setPendingFilter(null);
    setPendingValue('');
  };

  const handlePendingFilterKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') applyPendingFilter();
    else if (e.key === 'Escape') cancelPendingFilter();
  };

  const removeFilter = (filterKey: string) => {
    setActiveFilters((prev) => prev.filter((key) => key !== filterKey));
    handleFilterChange(filterKey, '');
  };

  const getAvailableFiltersToAdd = () => {
    return availableFilters.filter(
      (filter) =>
        !activeFilters.includes(filter.key) && (!pendingFilter || pendingFilter.key !== filter.key),
    );
  };

  const levelColors: Record<string, string> = {
    info: 'bg-sky-500',
    error: 'bg-red-500',
    warn: 'bg-amber-500',
    debug: 'bg-emerald-500',
  };

  return (
    <div className="px-5 py-3 bg-white border-b border-slate-100">
      {/* Row 1: File input + search */}
      <div className="flex items-center gap-3 mb-3">
        {/* File picker */}
        <div className="relative flex-shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".log,.txt,.json,.csv,.tsv"
            multiple
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <button className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Open Files
          </button>
        </div>

        {allLogs.length > 0 && (
          <button
            onClick={onClearLogs}
            className="text-xs px-3 py-1.5 rounded-md text-red-500 hover:bg-red-50 font-medium transition-colors flex-shrink-0"
          >
            Clear
          </button>
        )}

        {/* Global search */}
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={filters.searchText}
            onChange={(e) => handleFilterChange('searchText', e.target.value)}
            placeholder="Search all log fields..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 bg-slate-50 placeholder-slate-300"
          />
        </div>
      </div>

      {/* Row 2: Filters inline */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Level dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsLevelDropdownOpen(!isLevelDropdownOpen)}
            className="text-xs px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:border-slate-300 font-medium text-slate-600 flex items-center gap-1.5 transition-colors"
          >
            <span className="flex gap-0.5">
              {Object.entries(filters.levels)
                .filter(([, v]) => v)
                .map(([level]) => (
                  <span key={level} className={`w-1.5 h-1.5 rounded-full ${levelColors[level]}`} />
                ))}
            </span>
            {getLevelDropdownText()}
            <span
              className={`text-[10px] text-slate-400 transition-transform ${isLevelDropdownOpen ? 'rotate-180' : ''}`}
            >
              ▼
            </span>
          </button>

          {isLevelDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-20 min-w-[140px]">
              {['info', 'error', 'warn', 'debug'].map((level) => (
                <label
                  key={level}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-xs"
                >
                  <input
                    type="checkbox"
                    checked={filters.levels[level]}
                    onChange={(e) => handleLevelChange(level, e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-slate-800 focus:ring-slate-400"
                  />
                  <span className={`w-1.5 h-1.5 rounded-full ${levelColors[level]}`} />
                  <span className="font-medium text-slate-700">{level.toUpperCase()}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Date range */}
        <div className="relative" ref={dateRangeRef}>
          <button
            onClick={() => setIsDateRangeOpen(!isDateRangeOpen)}
            className={`text-xs px-3 py-1.5 rounded-md border font-medium flex items-center gap-1.5 transition-colors ${
              filters.dateFrom || filters.dateTo
                ? 'border-slate-400 bg-slate-50 text-slate-700'
                : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
            }`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {getDateRangeDisplayText()}
            <span
              className={`text-[10px] text-slate-400 transition-transform ${isDateRangeOpen ? 'rotate-180' : ''}`}
            >
              ▼
            </span>
          </button>

          {isDateRangeOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-20 p-3 min-w-[280px]">
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">From</label>
                  <input
                    type="datetime-local"
                    step="1"
                    value={toDateTimeLocalValue(filters.dateFrom)}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">To</label>
                  <input
                    type="datetime-local"
                    step="1"
                    value={toDateTimeLocalValue(filters.dateTo)}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={clearDateRange}
                    className="flex-1 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50 rounded transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setIsDateRangeOpen(false)}
                    className="flex-1 px-2 py-1 text-[11px] bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic filter chips */}
        {activeFilters
          .filter((key) => key !== 'searchText')
          .map((filterKey) => {
            const filterConfig = availableFilters.find((f) => f.key === filterKey);
            if (!filterConfig) return null;
            return (
              <div
                key={filterKey}
                className="flex items-center gap-1 bg-slate-100 rounded-md pl-3 pr-1 py-1"
              >
                <span className="text-[11px] text-slate-500 font-medium">
                  {filterConfig.label}:
                </span>
                <input
                  type="text"
                  value={(filters[filterKey] as string) || ''}
                  onChange={(e) => handleFilterChange(filterKey, e.target.value)}
                  placeholder={filterConfig.placeholder}
                  className="text-xs bg-transparent border-none focus:outline-none text-slate-700 w-28 placeholder-slate-300"
                />
                <button
                  onClick={() => removeFilter(filterKey)}
                  className="text-slate-400 hover:text-red-500 text-xs p-0.5 rounded transition-colors"
                  title="Remove filter"
                >
                  ×
                </button>
              </div>
            );
          })}

        {/* Pending filter */}
        {pendingFilter && (
          <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-md pl-3 pr-1 py-1">
            <span className="text-[11px] text-blue-600 font-medium">{pendingFilter.label}:</span>
            <input
              type="text"
              value={pendingValue}
              onChange={(e) => setPendingValue(e.target.value)}
              onKeyDown={handlePendingFilterKeyPress}
              placeholder={pendingFilter.placeholder}
              className="text-xs bg-transparent border-none focus:outline-none text-slate-700 w-28 placeholder-blue-300"
              autoFocus
            />
            <button
              onClick={applyPendingFilter}
              disabled={!pendingValue.trim()}
              className="text-blue-600 hover:text-blue-800 text-xs p-0.5 font-medium disabled:opacity-30"
            >
              ↵
            </button>
            <button
              onClick={cancelPendingFilter}
              className="text-slate-400 hover:text-red-500 text-xs p-0.5"
            >
              ×
            </button>
          </div>
        )}

        {/* Add filter */}
        {getAvailableFiltersToAdd().length > 0 && !pendingFilter && (
          <div className="relative" ref={addFilterRef}>
            <button
              onClick={() => setIsAddFilterOpen(!isAddFilterOpen)}
              className="text-xs px-2.5 py-1.5 rounded-md border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 font-medium transition-colors"
            >
              + Filter
            </button>

            {isAddFilterOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-20 min-w-[160px] max-h-48 overflow-y-auto">
                {getAvailableFiltersToAdd().map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => startAddingFilter(filter.key)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 text-xs text-slate-600 border-b border-slate-50 last:border-b-0"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Saved presets */}
        <SavedPresets filters={filters} setFilters={setFilters} />
      </div>
    </div>
  );
};

export default LogFilters;
