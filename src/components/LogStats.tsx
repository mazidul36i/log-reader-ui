import { memo } from 'react';

interface LogStatsProps {
  totalLogs: number;
  filteredCount: number;
  levelCounts: Record<string, number>;
  serviceCounts: Record<string, number>;
}

const LogStats = memo(({ totalLogs, filteredCount, levelCounts, serviceCounts }: LogStatsProps) => {
  if (totalLogs === 0) return null;

  const levelItems = [
    { label: 'Total', count: totalLogs, color: 'text-slate-600' },
    { label: 'Filtered', count: filteredCount, color: 'text-slate-600' },
    { label: 'INFO', count: levelCounts.INFO ?? 0, dot: 'bg-sky-500' },
    { label: 'ERROR', count: levelCounts.ERROR ?? 0, dot: 'bg-red-500' },
    { label: 'WARN', count: levelCounts.WARN ?? 0, dot: 'bg-amber-500' },
    { label: 'DEBUG', count: levelCounts.DEBUG ?? 0, dot: 'bg-emerald-500' },
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
