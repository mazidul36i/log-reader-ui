import React, { useMemo, useRef, useState, useCallback } from 'react';
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

// ─── Constants ────────────────────────────────────────────────────────────────
const BUCKET_COUNT = 80;
const LEVEL_ORDER = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
const LEVEL_COLORS = {
  INFO:  '#0ea5e9',
  ERROR: '#ef4444',
  WARN:  '#f59e0b',
  DEBUG: '#10b981',
};

// ─── Custom overlay plugin ────────────────────────────────────────────────────
// Draws the drag-selection rect, the persistent filter selection, and the
// hover crosshair directly on the Chart.js canvas – no extra DOM needed.
const overlayPlugin = {
  id: 'overlayPlugin',
  afterDatasetsDraw(chart, _args, opts) {
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
        // Dim outside selection
        ctx.fillStyle = 'rgba(241,245,249,0.7)';   // slate-100 tint
        if (x1 > ca.left)  ctx.fillRect(ca.left, ca.top, x1 - ca.left, ca.height);
        if (x2 < ca.right) ctx.fillRect(x2,      ca.top, ca.right - x2, ca.height);
        // Selection fill
        ctx.fillStyle = 'rgba(14,165,233,0.10)';   // sky-500 tint
        ctx.fillRect(x1, ca.top, x2 - x1, ca.height);
        // Boundary lines
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

    // Hover crosshair
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Full-precision ISO string so sub-second drag selections work correctly.
function formatLocalDateTime(ts) {
  return new Date(ts).toISOString();
}

// ─── Component ────────────────────────────────────────────────────────────────
const LogTimeline = ({ logs, allLogs, filters, setFilters }) => {
  const chartRef  = useRef(null);
  const wrapperRef = useRef(null);
  const [drag,   setDrag]   = useState({ active: false, startX: null, endX: null });
  const [hoverX, setHoverX] = useState(null);

  // Time bounds come from ALL logs so the x-axis stays stable while filtering
  const { minTime, maxTime } = useMemo(() => {
    if (!allLogs?.length) return { minTime: 0, maxTime: 0 };
    let min = Infinity, max = -Infinity;
    for (const log of allLogs) {
      const t = new Date(log['@timestamp']).getTime();
      if (!isNaN(t)) { if (t < min) min = t; if (t > max) max = t; }
    }
    return { minTime: min, maxTime: max };
  }, [allLogs]);

  // View range: zoom into the active date filter, otherwise show full span
  const viewMin = useMemo(
    () => (filters.dateFrom ? new Date(filters.dateFrom).getTime() : minTime),
    [filters.dateFrom, minTime],
  );
  const viewMax = useMemo(
    () => (filters.dateTo ? new Date(filters.dateTo).getTime() : maxTime),
    [filters.dateTo, maxTime],
  );
  const viewRangeMs = viewMax - viewMin;

  // Bucket logs within the current view range (finer resolution when zoomed in)
  const buckets = useMemo(() => {
    if (!logs?.length || viewRangeMs <= 0) return [];
    const size = viewRangeMs / BUCKET_COUNT;
    const bkts = Array.from({ length: BUCKET_COUNT }, (_, i) => ({
      t:     viewMin + (i + 0.5) * size,
      INFO:  0, ERROR: 0, WARN: 0, DEBUG: 0,
      total: 0,
    }));
    for (const log of logs) {
      const t = new Date(log['@timestamp']).getTime();
      if (isNaN(t) || t < viewMin || t > viewMax) continue;
      const idx   = Math.min(Math.floor((t - viewMin) / size), BUCKET_COUNT - 1);
      const level = (log.level || 'INFO').toUpperCase();
      if (level in bkts[idx]) { bkts[idx][level]++; bkts[idx].total++; }
    }
    return bkts;
  }, [logs, viewMin, viewMax, viewRangeMs]);

  // Count of logs currently visible in the zoomed view
  const logsInView = useMemo(
    () => buckets.reduce((s, b) => s + b.total, 0),
    [buckets],
  );

  // Chart.js dataset structure
  const chartData = useMemo(() => ({
    labels: buckets.map((b) => b.t),
    datasets: LEVEL_ORDER.map((level) => ({
      label: level,
      data:  buckets.map((b) => b[level]),
      backgroundColor: LEVEL_COLORS[level] + 'CC',
      borderColor:     'transparent',
      borderWidth:     0,
      barPercentage:      1.0,
      categoryPercentage: 1.0,
    })),
  }), [buckets]);

  // Chart.js options – rebuilt whenever selection/hover state changes so the
  // overlayPlugin receives fresh coordinates on every React render.
  const chartOptions = useMemo(() => ({
    responsive:          true,
    maintainAspectRatio: false,
    animation:           false,
    plugins: {
      legend:  { display: false },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor:      '#334155',
        bodyColor:       '#475569',
        borderColor:     '#e2e8f0',
        borderWidth:     1,
        padding:         8,
        callbacks: {
          title: ([item]) =>
            new Date(item.parsed.x).toLocaleString([], {
              month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            }),
          label: (item) => ` ${item.dataset.label}: ${item.parsed.y}`,
        },
      },
      // Only pass drag/hover state – no filter overlay needed because the
      // chart axis already zooms into the selected range.
      overlayPlugin: {
        dragX1: drag.active ? Math.min(drag.startX ?? 0, drag.endX ?? 0) : null,
        dragX2: drag.active ? Math.max(drag.startX ?? 0, drag.endX ?? 0) : null,
        hoverX,
      },
    },
    scales: {
      x: {
        type:    'time',
        stacked: true,
        // Zoom the x-axis to the active date-filter range (or full span)
        min:     viewMin || undefined,
        max:     viewMax || undefined,
        grid:    { color: '#f1f5f9' },
        border:  { display: false },
        ticks:   {
          color:         '#94a3b8',
          font:          { size: 9 },
          maxRotation:   0,
          autoSkip:      true,
          maxTicksLimit: 8,
        },
        time: {
          displayFormats: {
            millisecond: 'HH:mm:ss.SSS',
            second:      'HH:mm:ss',
            minute:      'HH:mm',
            hour:        'HH:mm',
            day:         'MMM d',
            month:       'MMM yyyy',
          },
        },
      },
      y: {
        stacked: true,
        grid:    { color: '#f1f5f9' },
        border:  { display: false },
        ticks:   {
          color:         '#94a3b8',
          font:          { size: 9, family: 'monospace' },
          maxTicksLimit: 4,
        },
      },
    },
    interaction: { mode: 'index', intersect: false },
  }), [viewMin, viewMax, drag, hoverX]);

  // ── Mouse handlers ──────────────────────────────────────────────────────────
  const clampToChart = useCallback((clientX) => {
    const chart = chartRef.current;
    const rect  = wrapperRef.current?.getBoundingClientRect();
    if (!chart || !rect) return null;
    const ca = chart.chartArea;
    if (!ca) return null;
    return Math.max(ca.left, Math.min(clientX - rect.left, ca.right));
  }, []);

  const handleMouseDown = useCallback((e) => {
    const x = clampToChart(e.clientX);
    if (x === null) return;
    // Only start drag if click is inside chart plot area
    const ca = chartRef.current?.chartArea;
    if (!ca || e.clientX - wrapperRef.current.getBoundingClientRect().left < ca.left) return;
    setDrag({ active: true, startX: x, endX: x });
  }, [clampToChart]);

  const handleMouseMove = useCallback((e) => {
    const x = clampToChart(e.clientX);
    if (x === null) return;
    setHoverX(x);
    if (drag.active) setDrag((prev) => ({ ...prev, endX: x }));
  }, [clampToChart, drag.active]);

  const handleMouseUp = useCallback(() => {
    if (!drag.active) return;
    const { startX, endX } = drag;
    setDrag({ active: false, startX: null, endX: null });
    if (Math.abs((endX ?? 0) - (startX ?? 0)) < 5) return; // tiny click → ignore

    const chart = chartRef.current;
    if (!chart) return;
    const fromTime = chart.scales.x.getValueForPixel(Math.min(startX, endX));
    const toTime   = chart.scales.x.getValueForPixel(Math.max(startX, endX));
    setFilters((prev) => ({
      ...prev,
      dateFrom: formatLocalDateTime(fromTime),
      dateTo:   formatLocalDateTime(toTime),
    }));
  }, [drag, setFilters]);

  const handleMouseLeave = useCallback(() => {
    setHoverX(null);
    if (drag.active) setDrag({ active: false, startX: null, endX: null });
  }, [drag.active]);

  const clearTimeRange = useCallback(
    () => setFilters((prev) => ({ ...prev, dateFrom: '', dateTo: '' })),
    [setFilters],
  );

  const hasDateFilter = !!(filters.dateFrom || filters.dateTo);

  // Human-readable label for the current view range
  const viewRangeLabel = useMemo(() => {
    if (!hasDateFilter) return null;
    const fmt = (ts) => new Date(ts).toLocaleString([], {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    return `${fmt(viewMin)} → ${fmt(viewMax)}`;
  }, [hasDateFilter, viewMin, viewMax]);

  if (!allLogs?.length) return null;

  return (
    <div className="bg-white border-b border-slate-200 flex-shrink-0 select-none">

      {/* ── Header bar ──────────────────────────────────────────────────────── */}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear time range
            </button>
          )}

          {/* Level colour legend */}
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

      {/* ── Chart ────────────────────────────────────────────────────────────── */}
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
};

export default LogTimeline;

