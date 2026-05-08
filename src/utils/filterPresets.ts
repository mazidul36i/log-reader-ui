/**
 * Saved filter presets persisted to localStorage.
 */

import type { Filters } from '../types';

export interface FilterPreset {
  name: string;
  filters: Filters;
  createdAt: string; // ISO timestamp
}

const STORAGE_KEY = 'log-reader-presets';

/** Load all saved presets from localStorage. */
export function loadPresets(): FilterPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/** Save a new preset (or overwrite by name). */
export function savePreset(name: string, filters: Filters): FilterPreset[] {
  const presets = loadPresets().filter((p) => p.name !== name);
  const newPreset: FilterPreset = {
    name,
    filters: { ...filters },
    createdAt: new Date().toISOString(),
  };
  presets.unshift(newPreset); // newest first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  return presets;
}

/** Delete a preset by name. */
export function deletePreset(name: string): FilterPreset[] {
  const presets = loadPresets().filter((p) => p.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  return presets;
}

