import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { debounce } from '../../utils/helpers';

/**
 * SearchBar component.
 * Renders a search input with debounced onChange, a clear button, and optional filter dropdowns.
 *
 * @param {{
 *   placeholder?: string,
 *   onSearch?: (searchTerm: string, activeFilters: Object<string, string>) => void,
 *   filters?: Array<{ key: string, label: string, options: Array<{ value: string, label: string }> }>,
 *   debounceMs?: number,
 *   defaultValue?: string,
 *   className?: string,
 * }} props
 * @returns {import('react').ReactElement}
 */
export function SearchBar({
  placeholder,
  onSearch,
  filters,
  debounceMs,
  defaultValue,
  className,
}) {
  const [searchTerm, setSearchTerm] = useState(defaultValue || '');
  const [activeFilters, setActiveFilters] = useState({});
  const inputRef = useRef(null);

  const safeFilters = Array.isArray(filters) ? filters : [];
  const effectiveDebounceMs = typeof debounceMs === 'number' && debounceMs >= 0 ? debounceMs : 300;

  const debouncedSearch = useMemo(() => {
    return debounce((term, currentFilters) => {
      if (typeof onSearch === 'function') {
        onSearch(term, currentFilters);
      }
    }, effectiveDebounceMs);
  }, [onSearch, effectiveDebounceMs]);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleInputChange = useCallback(
    (e) => {
      const value = e.target.value;
      setSearchTerm(value);
      debouncedSearch(value, activeFilters);
    },
    [debouncedSearch, activeFilters]
  );

  const handleClear = useCallback(() => {
    setSearchTerm('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
    debouncedSearch.cancel();
    if (typeof onSearch === 'function') {
      onSearch('', activeFilters);
    }
  }, [onSearch, activeFilters, debouncedSearch]);

  const handleFilterChange = useCallback(
    (filterKey, value) => {
      setActiveFilters((prev) => {
        const updated = { ...prev };
        if (value === '' || value === undefined || value === null) {
          delete updated[filterKey];
        } else {
          updated[filterKey] = value;
        }

        debouncedSearch.cancel();
        if (typeof onSearch === 'function') {
          onSearch(searchTerm, updated);
        }

        return updated;
      });
    },
    [onSearch, searchTerm, debouncedSearch]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        handleClear();
      } else if (e.key === 'Enter') {
        debouncedSearch.cancel();
        if (typeof onSearch === 'function') {
          onSearch(searchTerm, activeFilters);
        }
      }
    },
    [handleClear, debouncedSearch, onSearch, searchTerm, activeFilters]
  );

  const hasActiveFilters = Object.keys(activeFilters).length > 0;
  const hasSearchTerm = searchTerm.length > 0;

  const handleClearAll = useCallback(() => {
    setSearchTerm('');
    setActiveFilters({});
    debouncedSearch.cancel();
    if (typeof onSearch === 'function') {
      onSearch('', {});
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onSearch, debouncedSearch]);

  return (
    <div className={`flex flex-col gap-3 ${className || ''}`}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Search...'}
            className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            aria-label={placeholder || 'Search'}
          />
          {hasSearchTerm && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Clear search"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        {safeFilters.map((filter) => (
          <div key={filter.key} className="relative">
            <select
              value={activeFilters[filter.key] || ''}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
              className="w-full sm:w-auto appearance-none pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors cursor-pointer"
              aria-label={filter.label || filter.key}
            >
              <option value="">{filter.label || filter.key}</option>
              {Array.isArray(filter.options) &&
                filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        ))}
      </div>

      {/* Active filters summary */}
      {(hasActiveFilters || hasSearchTerm) && (
        <div className="flex flex-wrap items-center gap-2">
          {hasSearchTerm && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded-full">
              Search: {searchTerm.length > 20 ? searchTerm.slice(0, 20) + '...' : searchTerm}
              <button
                type="button"
                onClick={handleClear}
                className="ml-0.5 text-primary-500 hover:text-primary-700 transition-colors"
                aria-label="Remove search term"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </span>
          )}
          {Object.entries(activeFilters).map(([key, value]) => {
            const filterConfig = safeFilters.find((f) => f.key === key);
            const filterLabel = filterConfig ? filterConfig.label : key;
            const optionConfig = filterConfig && Array.isArray(filterConfig.options)
              ? filterConfig.options.find((o) => o.value === value)
              : null;
            const valueLabel = optionConfig ? optionConfig.label : value;

            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full"
              >
                {filterLabel}: {valueLabel}
                <button
                  type="button"
                  onClick={() => handleFilterChange(key, '')}
                  className="ml-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={`Remove ${filterLabel} filter`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            );
          })}
          {(hasActiveFilters || hasSearchTerm) && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
              aria-label="Clear all filters"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

SearchBar.propTypes = {
  placeholder: PropTypes.string,
  onSearch: PropTypes.func,
  filters: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      options: PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.string.isRequired,
          label: PropTypes.string.isRequired,
        })
      ).isRequired,
    })
  ),
  debounceMs: PropTypes.number,
  defaultValue: PropTypes.string,
  className: PropTypes.string,
};

SearchBar.defaultProps = {
  placeholder: 'Search...',
  onSearch: undefined,
  filters: [],
  debounceMs: 300,
  defaultValue: '',
  className: '',
};

export default SearchBar;