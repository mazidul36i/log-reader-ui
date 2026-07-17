import { memo, useMemo, useRef, useState, useCallback, type MouseEvent } from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import type { Filters, TimelineBucket } from '../types';

const LEVEL_ORDER = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
const LEVEL_COLORS: Record<string, string> = {
  INFO: '#0ea5e9',
  ERROR: '#ef4444',
  WARN: '#f59e0b',
  DEBUG: '#10b981',
};

const overlayPlugin = {
  id: 'overlayPlugin',
  afterDatasetsDraw(chart: any, _args: any, opts: any) {
    if (!opts) return;
    const { ctx, chartArea: ca } = chart;
    if (!ca) return;

    const { dragX1, dragX2, hoverX } = opts;
    const isDragging = dragX1 !== null && dragX2 !== null;

    if (isDragging) {
      const x1 = Math.min(dragX1, dragX2);
      const x2 = Math.max(dragX1, dragX2);
      if (x2 - x1 >= 1) {
        ctx.save();
        ctx.fillStyle = 'rgba(241,245,249,0.7)';
        if (x1 > ca.left) ctx.fillRect(ca.left, ca.top, x1 - ca.left, ca.height);
        if (x2 < ca.right) ctx.fillRect(x2, ca.top, ca.right - x2, ca.height);
        ctx.fillStyle = 'rgba(14,165,233,0.10)';
        ctx.fillRect(x1, ca.top, x2 - x1, ca.height);
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 1.5;
        [x1, x2].forEach((x) => {
          ctx.beginPath();
          ctx.moveTo(x, ca.top);
          ctx.lineTo(x, ca.bottom);
          ctx.stroke();
        });
        ctx.restore();
      }
    }

    if (hoverX !== null && !isDragging) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148,163,184,0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(hoverX, ca.top);
      ctx.lineTo(hoverX, ca.bottom);
      ctx.stroke();
      ctx.restore();
    }
  },
};

ChartJS.register(LinearScale, BarElement, Tooltip, Legend, TimeScale, overlayPlugin);

function formatLocalDateTime(ts: number): string {
  return new Date(ts).toISOString();
}

interface LogTimelineProps {
  buckets: TimelineBucket[];
  allLogsRange: { minTime: number; maxTime: number };
  hasLogs: boolean;
  filters: Filters;
  setFilters: (updater: Filters | ((prev: Filters) => Filters)) => void;
}

interface DragState {
  active: boolean;
  startX: number | null;
  endX: number | null;
}

const LogTimeline = memo(({ buckets, allLogsRange, hasLogs, filters, setFilters }: LogTimelineProps) => {
  const chartRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>({ active: false, startX: null, endX: null });
  const [hoverX, setHoverX] = useState<number | null>(null);

  const viewMin = useMemo(
    () => (filters.dateFrom ? new Date(filters.dateFrom).getTime() : allLogsRange.minTime),
    [filters.dateFrom, allLogsRange.minTime],
  );
  const viewMax = useMemo(
    () => (filters.dateTo ? new Date(filters.dateTo).getTime() : allLogsRange.maxTime),
    [filters.dateTo, allLogsRange.maxTime],
  );

  const logsInView = useMemo(() => buckets.reduce((s, b) => s + b.total, 0), [buckets]);

  const chartData = useMemo(
    () => ({
      labels: buckets.map((b) => b.t),
      datasets: LEVEL_ORDER.map((level) => ({
        label: level,
        data: buckets.map((b) => b[level]),
        backgroundColor: LEVEL_COLORS[level] + 'CC',
        borderColor: 'transparent',
        borderWidth: 0,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
      })),
    }),
    [buckets],
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#ffffff',
          titleColor: '#334155',
          bodyColor: '#475569',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 8,
          callbacks: {
            title: ([item]: any[]) =>
              new Date(item.parsed.x).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
            label: (item: any) => ` ${item.dataset.label}: ${item.parsed.y}`,
          },
        },
        overlayPlugin: {
          dragX1: drag.active ? Math.min(drag.startX ?? 0, drag.endX ?? 0) : null,
          dragX2: drag.active ? Math.max(drag.startX ?? 0, drag.endX ?? 0) : null,
          hoverX,
        },
      },
      scales: {
        x: {
          type: 'time' as const,
          stacked: true,
          min: viewMin || undefined,
          max: viewMax || undefined,
          grid: { color: '#f1f5f9' },
          border: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { size: 9 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
          time: {
            displayFormats: {
              millisecond: 'HH:mm:ss.SSS',
              second: 'HH:mm:ss',
              minute: 'HH:mm',
              hour: 'HH:mm',
              day: 'MMM d',
              month: 'MMM yyyy',
            },
          },
        },
        y: {
          stacked: true,
          grid: { color: '#f1f5f9' },
          border: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { size: 9, family: 'monospace' },
            maxTicksLimit: 4,
          },
        },
      },
      interaction: { mode: 'index' as const, intersect: false },
    }),
    [viewMin, viewMax, drag, hoverX],
  );

  const clampToChart = useCallback((clientX: number): number | null => {
    const chart = chartRef.current;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!chart || !rect) return null;
    const ca = chart.chartArea;
    if (!ca) return null;
    return Math.max(ca.left, Math.min(clientX - rect.left, ca.right));
  }, []);

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const x = clampToChart(e.clientX);
      if (x === null) return;
      const ca = chartRef.current?.chartArea;
      if (!ca || e.clientX - (wrapperRef.current?.getBoundingClientRect().left ?? 0) < ca.left)
        return;
      setDrag({ active: true, startX: x, endX: x });
    },
    [clampToChart],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const x = clampToChart(e.clientX);
      if (x === null) return;
      setHoverX(x);
      if (drag.active) setDrag((prev) => ({ ...prev, endX: x }));
    },
    [clampToChart, drag.active],
  );

  const handleMouseUp = useCallback(() => {
    if (!drag.active) return;
    const { startX, endX } = drag;
    setDrag({ active: false, startX: null, endX: null });
    if (Math.abs((endX ?? 0) - (startX ?? 0)) < 5) return;

    const chart = chartRef.current;
    if (!chart) return;
    const fromTime = chart.scales.x.getValueForPixel(Math.min(startX!, endX!));
    const toTime = chart.scales.x.getValueForPixel(Math.max(startX!, endX!));
    setFilters((prev: Filters) => ({
      ...prev,
      dateFrom: formatLocalDateTime(fromTime),
      dateTo: formatLocalDateTime(toTime),
    }));
  }, [drag, setFilters]);

  const handleMouseLeave = useCallback(() => {
    setHoverX(null);
    if (drag.active) setDrag({ active: false, startX: null, endX: null });
  }, [drag.active]);

  const clearTimeRange = useCallback(
    () => setFilters((prev: Filters) => ({ ...prev, dateFrom: '', dateTo: '' })),
    [setFilters],
  );

  const hasDateFilter = !!(filters.dateFrom || filters.dateTo);

  const viewRangeLabel = useMemo(() => {
    if (!hasDateFilter) return null;
    const fmt = (ts: number) =>
      new Date(ts).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    return `${fmt(viewMin)} → ${fmt(viewMax)}`;
  }, [hasDateFilter, viewMin, viewMax]);

  if (!hasLogs) return null;

  return (
    <div className="bg-white border-b border-slate-200 flex-shrink-0 select-none">
      <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-800 font-semibold text-sm flex-shrink-0">
            {logsInView.toLocaleString()} logs found
          </span>
          {viewRangeLabel && (
            <span className="text-slate-400 text-xs truncate hidden sm:block">
              {viewRangeLabel}
            </span>
          )}
          {hasDateFilter && (
            <span className="text-[10px] text-sky-600 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded flex-shrink-0">
              zoomed · drag to narrow further
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {hasDateFilter && (
            <button
              onClick={clearTimeRange}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-sky-500 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Clear time range
            </button>
          )}

          <div className="flex items-center gap-2.5">
            {LEVEL_ORDER.map((level) => (
              <div key={level} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ background: LEVEL_COLORS[level] }} />
                <span className="text-[10px] text-slate-400">{level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={wrapperRef}
        style={{ height: 130, cursor: drag.active ? 'col-resize' : 'crosshair' }}
        className="px-2 pb-2"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <Bar ref={chartRef} data={chartData} options={chartOptions} />
      </div>
    </div>
  );
});

LogTimeline.displayName = 'LogTimeline';

export default LogTimeline;
