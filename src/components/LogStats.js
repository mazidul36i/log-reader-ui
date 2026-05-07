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

  if (totalLogs === 0) return null;

  const items = [
    { label: 'Total', count: totalLogs, color: 'text-slate-600' },
    { label: 'Filtered', count: filteredLogs.length, color: 'text-slate-600' },
    { label: 'INFO', count: counts.INFO, dot: 'bg-sky-500' },
    { label: 'ERROR', count: counts.ERROR, dot: 'bg-red-500' },
    { label: 'WARN', count: counts.WARN, dot: 'bg-amber-500' },
    { label: 'DEBUG', count: counts.DEBUG, dot: 'bg-emerald-500' },
  ];

  return (
    <div className="px-5 py-2 bg-white border-b border-slate-100 flex-shrink-0">
      <div className="flex items-center gap-5 overflow-x-auto">
        {items.map(({ label, count, color, dot }) => (
          <div key={label} className="flex items-center gap-1.5 whitespace-nowrap">
            {dot && <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
            <span className="text-[11px] text-slate-400">{label}</span>
            <span className={`text-[11px] font-semibold tabular-nums ${color || 'text-slate-600'}`}>
              {count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogStats;
