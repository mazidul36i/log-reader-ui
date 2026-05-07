import React, { useState } from 'react';

const LogEntry = ({ log, index, onShowThreadContext }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const getLevelIndicator = (level) => {
    const l = (level || '').toLowerCase();
    switch (l) {
      case 'info': return 'bg-sky-500';
      case 'error': return 'bg-red-500';
      case 'warn': return 'bg-amber-500';
      case 'debug': return 'bg-emerald-500';
      default: return 'bg-slate-400';
    }
  };

  const getLevelTextColor = (level) => {
    const l = (level || '').toLowerCase();
    switch (l) {
      case 'info': return 'text-sky-600';
      case 'error': return 'text-red-600';
      case 'warn': return 'text-amber-600';
      case 'debug': return 'text-emerald-600';
      default: return 'text-slate-500';
    }
  };

  const copyToClipboard = (text, field) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  const CopyButton = ({ value, field }) => {
    if (!value) return null;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); copyToClipboard(value, field); }}
        className="ml-1.5 text-slate-300 hover:text-slate-600 transition-colors inline-flex items-center"
        title={`Copy ${field}`}
      >
        {copiedField === field ? (
          <span className="text-emerald-500 text-[10px] font-medium">✓</span>
        ) : (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    );
  };

  const timestamp = log?.['@timestamp'] ? new Date(log['@timestamp']).toLocaleString() : '';
  const level = log?.level || '';

  return (
    <div className="group">
      {/* Compact log row */}
      <div
        className={`px-5 py-2.5 cursor-pointer transition-colors duration-100 flex items-start gap-3 ${
          isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/50'
        } ${level.toLowerCase() === 'error' ? 'bg-red-50/30' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Level dot */}
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${getLevelIndicator(level)}`} />

        {/* Level label */}
        <span className={`text-[11px] font-semibold uppercase w-11 flex-shrink-0 mt-0.5 ${getLevelTextColor(level)}`}>
          {level.substring(0, 5)}
        </span>

        {/* Timestamp */}
        <span className="text-[11px] text-slate-400 font-mono flex-shrink-0 mt-0.5 w-40">
          {timestamp}
        </span>

        {/* Message */}
        <div className="flex-1 min-w-0 text-sm text-slate-700 truncate font-mono leading-relaxed">
          {log?.message || <span className="text-slate-300 italic">No message</span>}
        </div>

        {/* Quick info pills */}
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          {log?.trace_id && (
            <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
              {log.trace_id.substring(0, 8)}
            </span>
          )}
          {log?.tenantId && (
            <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
              {log.tenantId}
            </span>
          )}
        </div>

        {/* Expand indicator */}
        <span className={`text-[10px] text-slate-300 mt-1 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-5 pb-4 pt-1 bg-slate-50 border-b border-slate-100">
          <div className="ml-5 pl-3 border-l-2 border-slate-200">
            {/* Detail grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5 text-xs mb-3">
              <DetailRow label="Message" value={log?.message} mono wrap />
              <DetailRow label="Logger" value={log?.logger_name} mono />
              <DetailRow label="Thread" value={log?.thread_name}>
                <CopyButton value={log?.thread_name} field="thread" />
              </DetailRow>
              <DetailRow label="Trace ID" value={log?.trace_id} mono>
                <CopyButton value={log?.trace_id} field="trace" />
              </DetailRow>
              <DetailRow label="Span ID" value={log?.span_id} mono>
                <CopyButton value={log?.span_id} field="span" />
              </DetailRow>
              <DetailRow label="MTXS" value={log?.mtxs} mono>
                <CopyButton value={log?.mtxs} field="mtxs" />
              </DetailRow>
              <DetailRow label="Tenant" value={log?.tenantId}>
                <CopyButton value={log?.tenantId} field="tenant" />
              </DetailRow>
            </div>

            {/* Stack trace */}
            {log?.stack_trace && (
              <div className="mt-3">
                <div className="text-[11px] font-medium text-slate-500 mb-1">Stack Trace</div>
                <pre className="bg-slate-800 text-emerald-400 px-3 py-2 rounded text-[11px] leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto font-mono">
                  {log.stack_trace}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-200">
              <button
                onClick={(e) => { e.stopPropagation(); onShowThreadContext(log?.thread_name || '', index); }}
                className="text-[11px] px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 font-medium transition-colors"
              >
                Thread Context →
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); copyToClipboard(JSON.stringify(log, null, 2), 'json'); }}
                className="text-[11px] px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 font-medium transition-colors"
              >
                {copiedField === 'json' ? '✓ Copied' : 'Copy JSON'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailRow = ({ label, value, mono, wrap, children }) => (
  <div className={`flex items-start gap-2 py-1 ${wrap ? 'md:col-span-2' : ''}`}>
    <span className="text-slate-400 w-16 flex-shrink-0 text-right">{label}</span>
    <span className={`text-slate-700 ${mono ? 'font-mono' : ''} ${wrap ? 'break-all' : 'truncate'} flex-1 min-w-0`}>
      {value || <span className="text-slate-300">—</span>}
    </span>
    {children}
  </div>
);

export default LogEntry;
