import React, { useState } from 'react';

const LogEntry = ({ log, index, onShowThreadContext }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatEmptyValue = (value) => {
    return value || <span className="text-gray-400 italic">-</span>;
  };

  const getLevelStyles = (level) => {
    const levelLower = (level || '').toLowerCase();
    switch (levelLower) {
      case 'info':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warn':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'debug':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const timestamp = log?.['@timestamp'] ? new Date(log['@timestamp']).toLocaleString() : '';
  const level = log?.level || '';
  const shortMessage = log?.message?.length > 50 ? log.message.substring(0, 50) + '...' : (log?.message || '');

  return (
    <div className="border border-gray-200 rounded-lg mb-4 overflow-hidden transition-shadow duration-200 hover:shadow-md">
      {/* Log Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-semibold border ${getLevelStyles(level)} flex-shrink-0`}>
            {level}
          </span>
          <span className="text-xs text-gray-500 font-mono flex-shrink-0">
            {timestamp}
          </span>
          <div className="font-medium text-gray-900 text-sm flex-1 min-w-0 truncate">
            {log?.message || <span className="text-gray-400 italic">No message</span>}
          </div>
          <div className="text-xs text-gray-500 flex gap-4 flex-shrink-0">
            <div>Trace: {log?.trace_id?.substring(0, 8) || 'N/A'}...</div>
            <div>Tenant: {log?.tenantId || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Log Details */}
      {isExpanded && (
        <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200">
          <div className="space-y-3">
            {/* Message */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-1">Message:</div>
              <div className="bg-white p-3 rounded border border-gray-200 font-mono text-sm break-all">
                {formatEmptyValue(log?.message)}
              </div>
            </div>

            {/* Logger Name */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-1">Logger Name:</div>
              <div className="bg-white p-3 rounded border border-gray-200 font-mono text-sm break-all">
                {formatEmptyValue(log?.logger_name)}
              </div>
            </div>

            {/* Thread */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-1">Thread:</div>
              <div className="bg-white p-3 rounded border border-gray-200 font-mono text-sm break-all">
                {formatEmptyValue(log?.thread_name)}
              </div>
            </div>

            {/* Trace ID */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-1">Trace ID:</div>
              <div className="bg-white p-3 rounded border border-gray-200 font-mono text-sm break-all">
                {formatEmptyValue(log?.trace_id)}
              </div>
            </div>

            {/* Span ID */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-1">Span ID:</div>
              <div className="bg-white p-3 rounded border border-gray-200 font-mono text-sm break-all">
                {formatEmptyValue(log?.span_id)}
              </div>
            </div>

            {/* MTXS */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-1">MTXS:</div>
              <div className="bg-white p-3 rounded border border-gray-200 font-mono text-sm break-all">
                {formatEmptyValue(log?.mtxs)}
              </div>
            </div>

            {/* Tenant ID */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-1">Tenant ID:</div>
              <div className="bg-white p-3 rounded border border-gray-200 font-mono text-sm break-all">
                {formatEmptyValue(log?.tenantId)}
              </div>
            </div>

            {/* Stack Trace */}
            {log?.stack_trace && (
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-1">Stack Trace:</div>
                <div className="bg-gray-800 text-green-400 p-3 rounded border border-gray-200 font-mono text-xs whitespace-pre-wrap max-h-72 overflow-y-auto">
                  {log.stack_trace}
                </div>
              </div>
            )}

            {/* Thread Context Button */}
            <div className="pt-3 border-t border-gray-200">
              <button
                onClick={() => onShowThreadContext(log?.thread_name || '', index)}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors duration-200 flex items-center gap-1"
                title="Show nearby logs from same thread"
              >
                📋 View Thread Context
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogEntry;
