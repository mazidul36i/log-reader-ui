import React from 'react';

const LogStats = ({ totalLogs, filteredLogs }) => {
  const getLogCounts = () => {
    const counts = { INFO: 0, ERROR: 0, WARN: 0, DEBUG: 0 };
    filteredLogs.forEach(log => {
      const level = log?.level || 'UNKNOWN';
      counts[level] = (counts[level] || 0) + 1;
    });
    return counts;
  };

  const counts = getLogCounts();

  const StatBadge = ({ label, count, bgColor = 'bg-gray-600' }) => (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700">{label}:</span>
      <span className={`${bgColor} text-white px-3 py-1 rounded-full text-xs font-semibold`}>
        {count}
      </span>
    </div>
  );

  return (
    <div className="px-6 py-4 bg-gray-100 border-b border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <StatBadge label="Total Logs" count={totalLogs} bgColor="bg-blue-600" />
          <StatBadge label="Filtered" count={filteredLogs.length} bgColor="bg-green-600" />
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <StatBadge label="INFO" count={counts.INFO} bgColor="bg-cyan-600" />
          <StatBadge label="ERROR" count={counts.ERROR} bgColor="bg-red-600" />
          <StatBadge label="WARN" count={counts.WARN} bgColor="bg-yellow-600" />
          <StatBadge label="DEBUG" count={counts.DEBUG} bgColor="bg-green-600" />
        </div>
      </div>
    </div>
  );
};

export default LogStats;
