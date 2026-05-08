import { useState, useRef, useEffect } from 'react';
import type { Filters } from '../types';
import {
  loadPresets,
  savePreset,
  deletePreset,
  type FilterPreset,
} from '../utils/filterPresets';

interface SavedPresetsProps {
  filters: Filters;
  setFilters: (updater: Filters | ((prev: Filters) => Filters)) => void;
}

const SavedPresets = ({ filters, setFilters }: SavedPresetsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load presets on open
  useEffect(() => {
    if (isOpen) setPresets(loadPresets());
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsSaving(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when saving
  useEffect(() => {
    if (isSaving) inputRef.current?.focus();
  }, [isSaving]);

  const handleSave = () => {
    const name = presetName.trim();
    if (!name) return;
    const updated = savePreset(name, filters);
    setPresets(updated);
    setPresetName('');
    setIsSaving(false);
  };

  const handleLoad = (preset: FilterPreset) => {
    setFilters(preset.filters);
    setIsOpen(false);
  };

  const handleDelete = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    const updated = deletePreset(name);
    setPresets(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSave();
    else if (e.key === 'Escape') {
      setIsSaving(false);
      setPresetName('');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:border-slate-300 text-slate-500 hover:text-slate-600 font-medium transition-colors flex items-center gap-1.5"
        title="Saved filter presets"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        Presets
        <span
          className={`text-[10px] text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-20 min-w-[220px]">
          {/* Save current */}
          {isSaving ? (
            <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100">
              <input
                ref={inputRef}
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Preset name..."
                className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder-slate-300"
              />
              <button
                onClick={handleSave}
                disabled={!presetName.trim()}
                className="text-xs px-2 py-1 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-30 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsSaving(false);
                  setPresetName('');
                }}
                className="text-slate-400 hover:text-slate-600 text-xs px-1"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSaving(true)}
              className="w-full px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 font-medium"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Save current filters
            </button>
          )}

          {/* Preset list */}
          {presets.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-400 text-center">
              No saved presets
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {presets.map((preset) => (
                <div
                  key={preset.name}
                  onClick={() => handleLoad(preset)}
                  className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0 group"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-slate-700 font-medium truncate">
                      {preset.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(preset.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, preset.name)}
                    className="text-slate-300 hover:text-red-500 text-xs p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete preset"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Copy URL button */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50 border-t border-slate-100 flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Copy shareable URL
          </button>
        </div>
      )}
    </div>
  );
};

export default SavedPresets;

