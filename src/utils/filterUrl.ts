/**
 * Bidirectional serialization between Filters state and URL search params.
 *
 * URL format (human-readable):
 *   ?search=timeout&level=error,warn&dateFrom=2026-05-07T06:30:00&trace_id=abc123
 *
 * Empty/default values are omitted to keep URLs clean.
 */

import type { Filters } from '../types';

/** Default filter state — matches useFilterStore defaults. */
export const DEFAULT_FILTERS: Filters = {
  searchText: '',
  traceId: '',
  tenantId: '',
  loggerName: '',
  dateFrom: '',
  dateTo: '',
  levels: { info: true, error: true, warn: true, debug: true },
  fieldExcludes: {},
};

const ALL_LEVELS = ['info', 'error', 'warn', 'debug'];

/** Known filter keys that get special URL param names. */
const KEY_MAP: Record<string, string> = {
  searchText: 'search',
};
const REVERSE_KEY_MAP: Record<string, string> = {
  search: 'searchText',
};

/** Keys to skip when serializing (handled specially or internal). */
const SKIP_KEYS = new Set(['levels', 'fieldExcludes']);

// ── Filters → URL ────────────────────────────────────────────────────────────

export function filtersToSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();

  // Levels — only include if not all are enabled
  const enabledLevels = ALL_LEVELS.filter((l) => filters.levels[l]);
  if (enabledLevels.length < ALL_LEVELS.length) {
    params.set('level', enabledLevels.join(','));
  }

  // String fields
  for (const [key, value] of Object.entries(filters)) {
    if (SKIP_KEYS.has(key)) continue;
    if (typeof value !== 'string') continue;
    if (!value.trim()) continue; // skip empty

    const paramName = KEY_MAP[key] || key;
    params.set(paramName, value);
  }

  // Exclude filters — serialized as "ex_<key>=<value>"
  const excludes = filters.fieldExcludes as Record<string, string>;
  for (const [key, value] of Object.entries(excludes)) {
    if (value.trim()) params.set(`ex_${key}`, value);
  }

  return params;
}

export function filtersToUrl(filters: Filters): string {
  const params = filtersToSearchParams(filters);
  const str = params.toString();
  return str ? `?${str}` : '';
}

// ── URL → Filters ────────────────────────────────────────────────────────────

export function searchParamsToFilters(params: URLSearchParams): Filters | null {
  // If no params, return null (no URL state to restore)
  if ([...params.keys()].length === 0) return null;

  const filters: Filters = { ...DEFAULT_FILTERS };

  // Levels
  const levelParam = params.get('level');
  if (levelParam) {
    const requestedLevels = levelParam.split(',').map((l) => l.trim().toLowerCase());
    const validLevels = requestedLevels.filter((l) => ALL_LEVELS.includes(l));
    if (validLevels.length > 0) {
      filters.levels = {
        info: validLevels.includes('info'),
        error: validLevels.includes('error'),
        warn: validLevels.includes('warn'),
        debug: validLevels.includes('debug'),
      };
    }
  }

  // String fields + exclude fields
  for (const [paramName, value] of params.entries()) {
    if (paramName === 'level') continue; // already handled

    // Exclude filters — "ex_<key>=<value>"
    if (paramName.startsWith('ex_')) {
      const fieldKey = paramName.slice(3);
      (filters.fieldExcludes as Record<string, string>)[fieldKey] = value;
      continue;
    }

    const filterKey = REVERSE_KEY_MAP[paramName] || paramName;

    // Validate date fields
    if (filterKey === 'dateFrom' || filterKey === 'dateTo') {
      if (isNaN(Date.parse(value))) continue; // skip invalid dates
    }

    filters[filterKey] = value;
  }

  return filters;
}

/** Check if filters are all at their default values. */
export function isDefaultFilters(filters: Filters): boolean {
  if (filters.searchText) return false;
  if (filters.dateFrom) return false;
  if (filters.dateTo) return false;

  // Check levels
  for (const level of ALL_LEVELS) {
    if (!filters.levels[level]) return false;
  }

  // Check dynamic fields
  for (const [key, value] of Object.entries(filters)) {
    if (SKIP_KEYS.has(key)) continue;
    if (key === 'searchText' || key === 'dateFrom' || key === 'dateTo') continue;
    if (typeof value === 'string' && value.trim()) return false;
  }

  // Check exclude filters
  const excludes = filters.fieldExcludes as Record<string, string>;
  for (const value of Object.values(excludes)) {
    if (value.trim()) return false;
  }

  return true;
}

