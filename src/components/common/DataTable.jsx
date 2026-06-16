import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * Sorts an array of data by the specified column key and direction.
 * @param {Array<object>} data - The data array to sort.
 * @param {string|null} sortKey - The column key to sort by.
 * @param {'asc'|'desc'} sortDirection - The sort direction.
 * @returns {Array<object>} The sorted data array.
 */
function sortData(data, sortKey, sortDirection) {
  if (!sortKey || !Array.isArray(data)) {
    return data;
  }

  return [...data].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];

    if (aVal === undefined || aVal === null) return sortDirection === 'asc' ? 1 : -1;
    if (bVal === undefined || bVal === null) return sortDirection === 'asc' ? -1 : 1;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();

    if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
    if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Paginates an array of data.
 * @param {Array<object>} data - The data array to paginate.
 * @param {number} currentPage - The current page (1-based).
 * @param {number} pageSize - The number of items per page.
 * @returns {Array<object>} The paginated slice of data.
 */
function paginateData(data, currentPage, pageSize) {
  if (!Array.isArray(data) || pageSize <= 0) {
    return data;
  }

  const startIndex = (currentPage - 1) * pageSize;
  return data.slice(startIndex, startIndex + pageSize);
}

/**
 * Sort indicator icon component.
 * @param {{ direction: 'asc'|'desc'|null }} props
 * @returns {import('react').ReactElement}
 */
function SortIcon({ direction }) {
  if (!direction) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-gray-400 ml-1 inline-block"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }

  if (direction === 'asc') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-primary-600 ml-1 inline-block"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 text-primary-600 ml-1 inline-block"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

SortIcon.propTypes = {
  direction: PropTypes.oneOf(['asc', 'desc', null]),
};

SortIcon.defaultProps = {
  direction: null,
};

/**
 * DataTable component.
 * Renders a data table with sortable columns, pagination, row selection, and empty state.
 *
 * @param {{
 *   columns: Array<{ key: string, label: string, sortable?: boolean, render?: (value: *, row: object) => import('react').ReactNode, className?: string, headerClassName?: string }>,
 *   data: Array<object>,
 *   onRowClick?: (row: object) => void,
 *   pageSize?: number,
 *   sortable?: boolean,
 *   selectable?: boolean,
 *   selectedRows?: Array<string>,
 *   onSelectionChange?: (selectedIds: Array<string>) => void,
 *   rowKey?: string,
 *   emptyMessage?: string,
 *   className?: string,
 *   loading?: boolean,
 * }} props
 * @returns {import('react').ReactElement}
 */
export function DataTable({
  columns,
  data,
  onRowClick,
  pageSize,
  sortable,
  selectable,
  selectedRows,
  onSelectionChange,
  rowKey,
  emptyMessage,
  className,
  loading,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const safeData = Array.isArray(data) ? data : [];
  const safeColumns = Array.isArray(columns) ? columns : [];
  const effectivePageSize = typeof pageSize === 'number' && pageSize > 0 ? pageSize : 10;
  const effectiveSelectedRows = Array.isArray(selectedRows) ? selectedRows : [];

  const handleSort = useCallback(
    (key) => {
      if (!sortable) return;

      if (sortKey === key) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDirection('asc');
      }
      setCurrentPage(1);
    },
    [sortable, sortKey]
  );

  const sortedData = useMemo(() => {
    return sortData(safeData, sortKey, sortDirection);
  }, [safeData, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / effectivePageSize));

  const paginatedData = useMemo(() => {
    return paginateData(sortedData, currentPage, effectivePageSize);
  }, [sortedData, currentPage, effectivePageSize]);

  const handlePageChange = useCallback(
    (page) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    },
    [totalPages]
  );

  const getRowId = useCallback(
    (row) => {
      if (rowKey && row[rowKey] !== undefined && row[rowKey] !== null) {
        return String(row[rowKey]);
      }
      if (row.id !== undefined && row.id !== null) {
        return String(row.id);
      }
      if (row.memberId !== undefined && row.memberId !== null) {
        return String(row.memberId);
      }
      return '';
    },
    [rowKey]
  );

  const handleSelectAll = useCallback(() => {
    if (!selectable || typeof onSelectionChange !== 'function') return;

    const currentPageIds = paginatedData.map((row) => getRowId(row)).filter(Boolean);
    const allSelected = currentPageIds.length > 0 && currentPageIds.every((id) => effectiveSelectedRows.includes(id));

    if (allSelected) {
      const newSelection = effectiveSelectedRows.filter((id) => !currentPageIds.includes(id));
      onSelectionChange(newSelection);
    } else {
      const newSelection = [...new Set([...effectiveSelectedRows, ...currentPageIds])];
      onSelectionChange(newSelection);
    }
  }, [selectable, onSelectionChange, paginatedData, getRowId, effectiveSelectedRows]);

  const handleSelectRow = useCallback(
    (row) => {
      if (!selectable || typeof onSelectionChange !== 'function') return;

      const id = getRowId(row);
      if (!id) return;

      if (effectiveSelectedRows.includes(id)) {
        onSelectionChange(effectiveSelectedRows.filter((selectedId) => selectedId !== id));
      } else {
        onSelectionChange([...effectiveSelectedRows, id]);
      }
    },
    [selectable, onSelectionChange, getRowId, effectiveSelectedRows]
  );

  const isAllSelected = useMemo(() => {
    const currentPageIds = paginatedData.map((row) => getRowId(row)).filter(Boolean);
    return currentPageIds.length > 0 && currentPageIds.every((id) => effectiveSelectedRows.includes(id));
  }, [paginatedData, getRowId, effectiveSelectedRows]);

  const isSomeSelected = useMemo(() => {
    const currentPageIds = paginatedData.map((row) => getRowId(row)).filter(Boolean);
    return currentPageIds.some((id) => effectiveSelectedRows.includes(id)) && !isAllSelected;
  }, [paginatedData, getRowId, effectiveSelectedRows, isAllSelected]);

  const startItem = safeData.length === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1;
  const endItem = Math.min(currentPage * effectivePageSize, sortedData.length);

  // Loading state
  if (loading) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden ${className || ''}`}>
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <svg
              className="animate-spin h-8 w-8 text-primary-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-sm text-gray-500">Loading data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (safeData.length === 0) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden ${className || ''}`}>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-gray-300 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-sm text-gray-500">{emptyMessage || 'No data available.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden ${className || ''}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selectable && (
                <th scope="col" className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = isSomeSelected;
                      }
                    }}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    aria-label="Select all rows on this page"
                  />
                </th>
              )}
              {safeColumns.map((column) => {
                const isColumnSortable = sortable && column.sortable !== false;
                const isSorted = sortKey === column.key;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                      isColumnSortable ? 'cursor-pointer select-none hover:text-gray-700 hover:bg-gray-100 transition-colors' : ''
                    } ${column.headerClassName || ''}`}
                    onClick={isColumnSortable ? () => handleSort(column.key) : undefined}
                    aria-sort={
                      isSorted
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center">
                      {column.label}
                      {isColumnSortable && (
                        <SortIcon direction={isSorted ? sortDirection : null} />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((row, rowIndex) => {
              const id = getRowId(row);
              const isSelected = selectable && id && effectiveSelectedRows.includes(id);

              return (
                <tr
                  key={id || `row-${rowIndex}`}
                  className={`${
                    onRowClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''
                  } ${isSelected ? 'bg-primary-50' : ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <td className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectRow(row);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        aria-label={`Select row ${id || rowIndex + 1}`}
                      />
                    </td>
                  )}
                  {safeColumns.map((column) => {
                    const cellValue = row[column.key];
                    const renderedValue =
                      typeof column.render === 'function'
                        ? column.render(cellValue, row)
                        : cellValue !== undefined && cellValue !== null
                          ? String(cellValue)
                          : '';

                    return (
                      <td
                        key={column.key}
                        className={`px-4 py-3 text-sm text-gray-700 whitespace-nowrap ${column.className || ''}`}
                      >
                        {renderedValue}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sortedData.length > effectivePageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium">{startItem}</span> to{' '}
            <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{sortedData.length}</span> results
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="First page"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {(() => {
              const pages = [];
              const maxVisiblePages = 5;
              let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
              let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

              if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
              }

              for (let i = startPage; i <= endPage; i++) {
                pages.push(
                  <button
                    key={i}
                    type="button"
                    onClick={() => handlePageChange(i)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      i === currentPage
                        ? 'bg-primary-500 text-white font-medium'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                    aria-label={`Page ${i}`}
                    aria-current={i === currentPage ? 'page' : undefined}
                  >
                    {i}
                  </button>
                );
              }

              return pages;
            })()}

            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Last page"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Summary bar when data fits on one page */}
      {sortedData.length > 0 && sortedData.length <= effectivePageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium">{sortedData.length}</span> result{sortedData.length !== 1 ? 's' : ''}
          </div>
          {selectable && effectiveSelectedRows.length > 0 && (
            <div className="text-sm text-primary-600 font-medium">
              {effectiveSelectedRows.length} selected
            </div>
          )}
        </div>
      )}

      {/* Selection count for paginated view */}
      {sortedData.length > effectivePageSize && selectable && effectiveSelectedRows.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 bg-primary-50">
          <p className="text-sm text-primary-700 font-medium">
            {effectiveSelectedRows.length} row{effectiveSelectedRows.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      )}
    </div>
  );
}

DataTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      sortable: PropTypes.bool,
      render: PropTypes.func,
      className: PropTypes.string,
      headerClassName: PropTypes.string,
    })
  ).isRequired,
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  onRowClick: PropTypes.func,
  pageSize: PropTypes.number,
  sortable: PropTypes.bool,
  selectable: PropTypes.bool,
  selectedRows: PropTypes.arrayOf(PropTypes.string),
  onSelectionChange: PropTypes.func,
  rowKey: PropTypes.string,
  emptyMessage: PropTypes.string,
  className: PropTypes.string,
  loading: PropTypes.bool,
};

DataTable.defaultProps = {
  onRowClick: undefined,
  pageSize: 10,
  sortable: false,
  selectable: false,
  selectedRows: [],
  onSelectionChange: undefined,
  rowKey: 'id',
  emptyMessage: 'No data available.',
  className: '',
  loading: false,
};

export default DataTable;