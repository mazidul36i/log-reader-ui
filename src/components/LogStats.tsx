import { memo, useMemo } from 'react';
import type { LogEntry } from '../types';

interface LogStatsProps {
  totalLogs: number;
  filteredLogs: LogEntry[];
}

const LogStats = memo(({ totalLogs, filteredLogs }: LogStatsProps) => {
  const { levelCounts, serviceCounts } = useMemo(() => {
    const levels: Record<string, number> = { INFO: 0, ERROR: 0, WARN: 0, DEBUG: 0 };
    const services: Record<string, number> = {};
    for (const log of filteredLogs) {
      const level = log?.level || 'UNKNOWN';
      levels[level] = (levels[level] || 0) + 1;
      if (log?.service_name) {
        services[log.service_name] = (services[log.service_name] || 0) + 1;
      }
    }
    return { levelCounts: levels, serviceCounts: services };
  }, [filteredLogs]);

  if (totalLogs === 0) return null;

  const levelItems = [
    { label: 'Total', count: totalLogs, color: 'text-slate-600' },
    { label: 'Filtered', count: filteredLogs.length, color: 'text-slate-600' },
    { label: 'INFO', count: levelCounts.INFO, dot: 'bg-sky-500' },
    { label: 'ERROR', count: levelCounts.ERROR, dot: 'bg-red-500' },
    { label: 'WARN', count: levelCounts.WARN, dot: 'bg-amber-500' },
    { label: 'DEBUG', count: levelCounts.DEBUG, dot: 'bg-emerald-500' },
  ];

  const serviceEntries = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="px-5 py-2 bg-white border-b border-slate-100 flex-shrink-0">
      <div className="flex items-center gap-5 overflow-x-auto">
        {levelItems.map(({ label, count, color, dot }) => (
          <div key={label} className="flex items-center gap-1.5 whitespace-nowrap">
            {dot && <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
            <span className="text-[11px] text-slate-400">{label}</span>
            <span className={`text-[11px] font-semibold tabular-nums ${color || 'text-slate-600'}`}>
              {count.toLocaleString()}
            </span>
          </div>
        ))}
        {serviceEntries.length > 0 && (
          <>
            <div className="w-px h-3 bg-slate-200 flex-shrink-0" />
            {serviceEntries.map(([name, count]) => (
              <div key={name} className="flex items-center gap-1.5 whitespace-nowrap">
                <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                <span className="text-[11px] text-slate-400 max-w-[120px] truncate" title={name}>{name}</span>
                <span className="text-[11px] font-semibold tabular-nums text-slate-600">
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
});

LogStats.displayName = 'LogStats';

export default LogStats;
