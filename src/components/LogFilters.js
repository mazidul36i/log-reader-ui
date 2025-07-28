import React, { useRef, useState, useEffect } from 'react';

const LogFilters = ({ filters, setFilters, onFileSelect, onClearLogs, allLogs = [] }) => {
  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const dateRangeRef = useRef(null);
  const addFilterRef = useRef(null);
  const [isLevelDropdownOpen, setIsLevelDropdownOpen] = useState(false);
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [isAddFilterOpen, setIsAddFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState(['searchText']); // Always show global search
  const [pendingFilter, setPendingFilter] = useState(null); // For temporary filter input
  const [pendingValue, setPendingValue] = useState('');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsLevelDropdownOpen(false);
      }
      if (dateRangeRef.current && !dateRangeRef.current.contains(event.target)) {
        setIsDateRangeOpen(false);
      }
      if (addFilterRef.current && !addFilterRef.current.contains(event.target)) {
        setIsAddFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleFileChange = (e) => {
    onFileSelect(e.target.files);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleLevelChange = (level, checked) => {
    setFilters(prev => ({
      ...prev,
      levels: {
        ...prev.levels,
        [level]: checked
      }
    }));
  };

  const getLevelDropdownText = () => {
    const selectedLevels = Object.keys(filters.levels).filter(level => filters.levels[level]);
    
    if (selectedLevels.length === 0) {
      return 'No Levels Selected';
    } else if (selectedLevels.length === 4) {
      return 'All Levels (4)';
    } else if (selectedLevels.length === 1) {
      return selectedLevels[0].toUpperCase();
    } else {
      return `${selectedLevels.length} Levels Selected`;
    }
  };

  const getDateRangeDisplayText = () => {
    if (filters.dateFrom && filters.dateTo) {
      const fromDate = new Date(filters.dateFrom).toLocaleDateString();
      const toDate = new Date(filters.dateTo).toLocaleDateString();
      return `${fromDate} - ${toDate}`;
    } else if (filters.dateFrom) {
      return `From ${new Date(filters.dateFrom).toLocaleDateString()}`;
    } else if (filters.dateTo) {
      return `Until ${new Date(filters.dateTo).toLocaleDateString()}`;
    }
    return 'Select Date Range';
  };

  const clearDateRange = () => {
    handleFilterChange('dateFrom', '');
    handleFilterChange('dateTo', '');
    setIsDateRangeOpen(false);
  };

  // Generate dynamic filter options based on log data
  const generateAvailableFilters = () => {
    // Always include default filters
    const defaultFilters = [
      { key: 'trace_id', label: 'Trace ID', placeholder: 'Filter by trace ID...' },
      { key: 'tenantId', label: 'Tenant ID', placeholder: 'Filter by tenant ID...' },
      { key: 'loggerName', label: 'Logger Name', placeholder: 'Filter by logger name...' },
      { key: 'mtxs', label: 'MTXS', placeholder: 'Filter by MTXS...' }
    ];

    if (!allLogs || allLogs.length === 0) {
      // Return only default filters when no logs are loaded
      return defaultFilters;
    }

    const fieldMap = new Set();
    const sampleSize = Math.min(100, allLogs.length); // Sample first 100 logs for performance
    
    // Get default filter keys to avoid duplicates
    const defaultKeys = new Set(defaultFilters.map(f => f.key));
    
    // Analyze log structure to find filterable fields
    for (let i = 0; i < sampleSize; i++) {
      const log = allLogs[i];
      if (log && typeof log === 'object') {
        Object.keys(log).forEach(key => {
          // Skip certain fields that aren't useful for filtering and default filters
          if (!['@timestamp', 'level', 'message', '@version'].includes(key) && !defaultKeys.has(key)) {
            const value = log[key];
            // Only include fields that have string or number values (not objects/arrays)
            if (value !== null && value !== undefined && 
                (typeof value === 'string' || typeof value === 'number') &&
                value !== '') {
              fieldMap.add(key);
            }
          }
        });
      }
    }

    // Convert to filter configuration objects
    const dynamicFilters = Array.from(fieldMap).map(key => {
      // Create human-readable labels
      const label = key
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
      
      return {
        key,
        label,
        placeholder: `Filter by ${label.toLowerCase()}...`
      };
    }).sort((a, b) => a.label.localeCompare(b.label));

    // Combine default filters with dynamic filters
    return [...defaultFilters, ...dynamicFilters];
  };

  // Get available filters (memoized for performance)
  const availableFilters = generateAvailableFilters();

  // Start adding a new filter (show pending input)
  const startAddingFilter = (filterKey) => {
    const filterConfig = availableFilters.find(f => f.key === filterKey);
    setPendingFilter(filterConfig);
    setPendingValue('');
    setIsAddFilterOpen(false);
  };

  // Apply the pending filter
  const applyPendingFilter = () => {
    if (pendingFilter && pendingValue.trim()) {
      // Add to active filters and set the value
      setActiveFilters(prev => [...prev, pendingFilter.key]);
      handleFilterChange(pendingFilter.key, pendingValue.trim());
      // Clear pending state
      setPendingFilter(null);
      setPendingValue('');
    }
  };

  // Cancel pending filter
  const cancelPendingFilter = () => {
    setPendingFilter(null);
    setPendingValue('');
  };

  // Handle Enter key press in pending filter input
  const handlePendingFilterKeyPress = (e) => {
    if (e.key === 'Enter') {
      applyPendingFilter();
    } else if (e.key === 'Escape') {
      cancelPendingFilter();
    }
  };

  // Remove a filter
  const removeFilter = (filterKey) => {
    setActiveFilters(prev => prev.filter(key => key !== filterKey));
    // Clear the filter value
    handleFilterChange(filterKey, '');
  };

  // Get available filters that aren't already active (excluding pending filter)
  const getAvailableFiltersToAdd = () => {
    return availableFilters.filter(filter => 
      !activeFilters.includes(filter.key) && 
      (!pendingFilter || pendingFilter.key !== filter.key)
    );
  };

  // Render a dynamic filter input
  const renderFilterInput = (filterConfig) => {
    return (
      <div key={filterConfig.key} className="relative">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor={filterConfig.key} className="block text-sm font-semibold text-gray-700">
            {filterConfig.label}:
          </label>
          <button
            onClick={() => removeFilter(filterConfig.key)}
            className="text-red-500 hover:text-red-700 text-xs font-medium"
            title="Remove filter"
          >
            ✕
          </button>
        </div>
        <input
          type="text"
          id={filterConfig.key}
          value={filters[filterConfig.key] || ''}
          onChange={(e) => handleFilterChange(filterConfig.key, e.target.value)}
          placeholder={filterConfig.placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 border-b border-gray-200">
      {/* File Input Section */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".log,.txt,.json"
              multiple
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2">
              📁 Select Log Files
            </button>
          </div>
          <button
            onClick={onClearLogs}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Filters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Log Levels Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Log Levels:</label>
          <div className="relative">
            <button
              onClick={() => setIsLevelDropdownOpen(!isLevelDropdownOpen)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left flex justify-between items-center hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <span className="text-sm">{getLevelDropdownText()}</span>
              <span className={`text-xs text-gray-500 transition-transform duration-200 ${isLevelDropdownOpen ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            
            {isLevelDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                {['info', 'error', 'warn', 'debug'].map(level => (
                  <div key={level} className="flex items-center px-3 py-2 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      id={`level-${level}`}
                      checked={filters.levels[level]}
                      onChange={(e) => handleLevelChange(level, e.target.checked)}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`level-${level}`} className="text-sm font-medium text-gray-700 cursor-pointer flex-1">
                      {level.toUpperCase()}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Global Search - Always visible */}
        <div>
          <label htmlFor="searchText" className="block text-sm font-semibold text-gray-700 mb-2">
            Global Search:
          </label>
          <input
            type="text"
            id="searchText"
            value={filters.searchText}
            onChange={(e) => handleFilterChange('searchText', e.target.value)}
            placeholder="Search across all log attributes..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Dynamic Filter Inputs */}
        {activeFilters
          .filter(filterKey => filterKey !== 'searchText') // Exclude global search as it's always shown
          .map(filterKey => {
            const filterConfig = availableFilters.find(f => f.key === filterKey);
            return filterConfig ? renderFilterInput(filterConfig) : null;
          })}

        {/* Pending Filter Input */}
        {pendingFilter && (
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="pendingFilter" className="block text-sm font-semibold text-gray-700">
                {pendingFilter.label}:
              </label>
              <button
                onClick={cancelPendingFilter}
                className="text-red-500 hover:text-red-700 text-xs font-medium"
                title="Cancel filter"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                id="pendingFilter"
                value={pendingValue}
                onChange={(e) => setPendingValue(e.target.value)}
                onKeyDown={handlePendingFilterKeyPress}
                placeholder={pendingFilter.placeholder}
                className="flex-1 px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-blue-50"
                autoFocus
              />
              <button
                onClick={applyPendingFilter}
                disabled={!pendingValue.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                title="Apply filter (or press Enter)"
              >
                Apply
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Press Enter to apply or Escape to cancel
            </div>
          </div>
        )}

        {/* Add Filter Button */}
        {getAvailableFiltersToAdd().length > 0 && !pendingFilter && (
          <div className="relative" ref={addFilterRef}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Add Filter:</label>
            <div className="relative">
              <button
                onClick={() => setIsAddFilterOpen(!isAddFilterOpen)}
                className="w-full px-3 py-2 border border-dashed border-gray-400 rounded-md bg-gray-50 text-left flex justify-between items-center hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <span className="text-sm text-gray-600">+ Add Filter</span>
                <span className={`text-xs text-gray-500 transition-transform duration-200 ${isAddFilterOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              
              {isAddFilterOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                  {getAvailableFiltersToAdd().map(filter => (
                    <button
                      key={filter.key}
                      onClick={() => startAddingFilter(filter.key)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm font-medium text-gray-700 border-b border-gray-100 last:border-b-0"
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Date Range */}
        <div className="relative" ref={dateRangeRef}>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Date Range:</label>
          <div className="relative">
            <button
              onClick={() => setIsDateRangeOpen(!isDateRangeOpen)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left flex justify-between items-center hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <span className="text-sm">{getDateRangeDisplayText()}</span>
              <span className={`text-xs text-gray-500 transition-transform duration-200 ${isDateRangeOpen ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            
            {isDateRangeOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 p-4 min-w-80">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">From Date:</label>
                    <input
                      type="datetime-local"
                      value={filters.dateFrom}
                      onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">To Date:</label>
                    <input
                      type="datetime-local"
                      value={filters.dateTo}
                      onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={clearDateRange}
                      className="flex-1 px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setIsDateRangeOpen(false)}
                      className="flex-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogFilters;
