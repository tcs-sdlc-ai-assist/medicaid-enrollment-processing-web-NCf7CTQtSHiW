import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAuditStore } from '../../stores/auditStore';
import { useAuth } from '../../contexts/AuthContext';
import { formatTimestamp } from '../../utils/helpers';
import { DataTable } from '../common/DataTable';
import { SearchBar } from '../common/SearchBar';
import { StatusBadge } from '../common/StatusBadge';
import { AlertMessage } from '../common/AlertMessage';
import { Modal } from '../common/Modal';

/**
 * Error type filter options for error logs.
 * @type {Array<{ value: string, label: string }>}
 */
const ERROR_TYPE_FILTER_OPTIONS = [
  { value: 'ValidationError', label: 'Validation Error' },
  { value: 'ParsingError', label: 'Parsing Error' },
  { value: 'EligibilityError', label: 'Eligibility Error' },
  { value: 'CategorizationError', label: 'Categorization Error' },
  { value: 'EnrollmentError', label: 'Enrollment Error' },
  { value: 'IntegrationError', label: 'Integration Error' },
  { value: 'DuplicateFileError', label: 'Duplicate File Error' },
];

/**
 * Maps an error type to a severity level string.
 * @param {string} errorType - The error type.
 * @returns {string} The severity level ('critical', 'high', 'medium', 'low').
 */
function getErrorSeverity(errorType) {
  if (!errorType || typeof errorType !== 'string') return 'medium';

  switch (errorType) {
    case 'IntegrationError':
      return 'critical';
    case 'ParsingError':
    case 'ValidationError':
      return 'high';
    case 'EligibilityError':
    case 'EnrollmentError':
    case 'CategorizationError':
      return 'medium';
    case 'DuplicateFileError':
      return 'low';
    default:
      return 'medium';
  }
}

/**
 * Maps a severity level to Tailwind CSS color classes.
 * @param {string} severity - The severity level.
 * @returns {{ bg: string, text: string, dot: string }} Tailwind CSS classes.
 */
function getSeverityClasses(severity) {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-error-100',
        text: 'text-error-800',
        dot: 'bg-error-600',
      };
    case 'high':
      return {
        bg: 'bg-error-50',
        text: 'text-error-700',
        dot: 'bg-error-500',
      };
    case 'medium':
      return {
        bg: 'bg-warning-50',
        text: 'text-warning-700',
        dot: 'bg-warning-500',
      };
    case 'low':
      return {
        bg: 'bg-primary-50',
        text: 'text-primary-700',
        dot: 'bg-primary-500',
      };
    default:
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        dot: 'bg-gray-500',
      };
  }
}

/**
 * Returns a human-readable severity label.
 * @param {string} severity - The severity level.
 * @returns {string} The severity label.
 */
function getSeverityLabel(severity) {
  switch (severity) {
    case 'critical':
      return 'Critical';
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    default:
      return 'Unknown';
  }
}

/**
 * Maps an error type to a StatusBadge-compatible status string.
 * @param {string} errorType - The error type.
 * @returns {string} A status string for StatusBadge.
 */
function getErrorTypeBadgeStatus(errorType) {
  if (!errorType || typeof errorType !== 'string') return 'Failed';

  switch (errorType) {
    case 'ValidationError':
    case 'ParsingError':
      return 'Failed';
    case 'EligibilityError':
    case 'EnrollmentError':
      return 'Denied';
    case 'IntegrationError':
      return 'Error';
    case 'CategorizationError':
      return 'Failed';
    case 'DuplicateFileError':
      return 'Pending';
    default:
      return 'Failed';
  }
}

/**
 * Converts error logs to CSV string format.
 * @param {Array<object>} logs - The error log entries.
 * @returns {string} The CSV string.
 */
function convertErrorLogsToCSV(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return '';
  }

  const headers = ['Timestamp', 'Error Type', 'Severity', 'Message', 'File ID', 'Member ID'];
  const rows = logs.map((log) => {
    const severity = getErrorSeverity(log.errorType);
    return [
      log.timestamp || '',
      (log.errorType || '').replace(/"/g, '""'),
      severity,
      `"${(log.message || '').replace(/"/g, '""')}"`,
      (log.fileId || '').replace(/"/g, '""'),
      (log.memberId || '').replace(/"/g, '""'),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Triggers a file download in the browser.
 * @param {string} content - The file content string.
 * @param {string} filename - The filename for the download.
 * @param {string} mimeType - The MIME type of the file.
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * ErrorLogViewer component.
 * Displays all error log entries in a searchable, filterable DataTable.
 * Columns: timestamp, error type, message, file ID, member ID.
 * Supports filtering by error type and date range.
 * Shows error severity indicators.
 *
 * @param {{ className?: string }} props
 * @returns {import('react').ReactElement}
 */
export function ErrorLogViewer({ className }) {
  const errorLogs = useAuditStore((state) => state.errorLogs);
  const clearLogs = useAuditStore((state) => state.clearLogs);
  const { hasPermission } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [alertMessage, setAlertMessage] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedError, setSelectedError] = useState(null);
  const [clearModalOpen, setClearModalOpen] = useState(false);

  const canClearLogs = hasPermission('clear_audit_logs');
  const canExport = hasPermission('export_data');

  /**
   * Handles search and filter changes from the SearchBar.
   * @param {string} term - The search term.
   * @param {Object<string, string>} filters - The active filters.
   */
  const handleSearch = useCallback((term, filters) => {
    setSearchTerm(term || '');
    setActiveFilters(filters || {});
  }, []);

  /**
   * Filters error logs based on search term and active filters.
   */
  const filteredLogs = useMemo(() => {
    let result = Array.isArray(errorLogs) ? [...errorLogs] : [];

    // Apply search term filter
    if (searchTerm && searchTerm.trim().length > 0) {
      const lowerSearch = searchTerm.toLowerCase().trim();
      result = result.filter((log) => {
        const errorType = (log.errorType || '').toLowerCase();
        const message = (log.message || '').toLowerCase();
        const fileId = (log.fileId || '').toLowerCase();
        const memberId = (log.memberId || '').toLowerCase();

        return (
          errorType.includes(lowerSearch) ||
          message.includes(lowerSearch) ||
          fileId.includes(lowerSearch) ||
          memberId.includes(lowerSearch)
        );
      });
    }

    // Apply error type filter
    if (activeFilters.errorType) {
      result = result.filter((log) => log.errorType === activeFilters.errorType);
    }

    return result;
  }, [errorLogs, searchTerm, activeFilters]);

  /**
   * Error statistics summary.
   */
  const errorStats = useMemo(() => {
    const allErrors = Array.isArray(errorLogs) ? errorLogs : [];

    const validationErrors = allErrors.filter((log) => log.errorType === 'ValidationError').length;
    const parsingErrors = allErrors.filter((log) => log.errorType === 'ParsingError').length;
    const eligibilityErrors = allErrors.filter((log) => log.errorType === 'EligibilityError').length;
    const integrationErrors = allErrors.filter((log) => log.errorType === 'IntegrationError').length;
    const otherErrors = allErrors.length - validationErrors - parsingErrors - eligibilityErrors - integrationErrors;

    const criticalCount = allErrors.filter((log) => getErrorSeverity(log.errorType) === 'critical').length;
    const highCount = allErrors.filter((log) => getErrorSeverity(log.errorType) === 'high').length;
    const mediumCount = allErrors.filter((log) => getErrorSeverity(log.errorType) === 'medium').length;
    const lowCount = allErrors.filter((log) => getErrorSeverity(log.errorType) === 'low').length;

    return {
      total: allErrors.length,
      validationErrors,
      parsingErrors,
      eligibilityErrors,
      integrationErrors,
      otherErrors,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
    };
  }, [errorLogs]);

  /**
   * Handles viewing an error log entry's details.
   * @param {object} log - The error log entry to view.
   */
  const handleViewError = useCallback((log) => {
    if (!log) return;
    setSelectedError(log);
    setDetailModalOpen(true);
  }, []);

  /**
   * Handles closing the detail modal.
   */
  const handleCloseDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedError(null);
  }, []);

  /**
   * Handles opening the clear logs confirmation modal.
   */
  const handleClearLogsClick = useCallback(() => {
    setClearModalOpen(true);
  }, []);

  /**
   * Confirms and executes clearing all logs.
   */
  const handleConfirmClearLogs = useCallback(() => {
    clearLogs();
    setAlertMessage({
      type: 'success',
      message: 'All error logs have been cleared.',
      title: 'Logs Cleared',
    });
    setClearModalOpen(false);
  }, [clearLogs]);

  /**
   * Cancels clearing logs.
   */
  const handleCancelClearLogs = useCallback(() => {
    setClearModalOpen(false);
  }, []);

  /**
   * Exports filtered error logs as CSV.
   */
  const handleExportCSV = useCallback(() => {
    const csvContent = convertErrorLogsToCSV(filteredLogs);
    if (!csvContent) {
      setAlertMessage({
        type: 'warning',
        message: 'No error logs to export.',
        title: 'Export Empty',
      });
      return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(csvContent, `error-logs-${timestamp}.csv`, 'text/csv');
    setAlertMessage({
      type: 'success',
      message: `${filteredLogs.length} error log(s) exported as CSV successfully.`,
      title: 'Export Complete',
    });
  }, [filteredLogs]);

  /**
   * DataTable column definitions for error logs.
   * @type {Array<object>}
   */
  const columns = useMemo(
    () => [
      {
        key: 'timestamp',
        label: 'Timestamp',
        sortable: true,
        render: (value) => (
          <span className="text-xs text-gray-600">
            {value ? formatTimestamp(value) : '—'}
          </span>
        ),
      },
      {
        key: 'errorType',
        label: 'Error Type',
        sortable: true,
        render: (value) => {
          const severity = getErrorSeverity(value);
          const severityClasses = getSeverityClasses(severity);
          return (
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full flex-shrink-0 ${severityClasses.dot}`} />
              <span className="text-sm font-medium text-gray-800">
                {value || 'Unknown'}
              </span>
            </div>
          );
        },
      },
      {
        key: 'severity',
        label: 'Severity',
        sortable: false,
        render: (_value, row) => {
          const severity = getErrorSeverity(row.errorType);
          const severityClasses = getSeverityClasses(severity);
          return (
            <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${severityClasses.bg} ${severityClasses.text}`}>
              {getSeverityLabel(severity)}
            </span>
          );
        },
      },
      {
        key: 'message',
        label: 'Message',
        sortable: false,
        render: (value) => {
          if (!value) return <span className="text-xs text-gray-400">—</span>;
          return (
            <span className="text-xs text-gray-600 truncate max-w-[250px] block" title={value}>
              {value.length > 60 ? value.slice(0, 60) + '...' : value}
            </span>
          );
        },
      },
      {
        key: 'fileId',
        label: 'File ID',
        sortable: true,
        render: (value) => (
          <span className="font-mono text-xs text-gray-700" title={value || ''}>
            {value ? (value.length > 12 ? value.substring(0, 12) + '...' : value) : '—'}
          </span>
        ),
      },
      {
        key: 'memberId',
        label: 'Member ID',
        sortable: true,
        render: (value) => (
          <span className="font-mono text-xs text-gray-700" title={value || ''}>
            {value || '—'}
          </span>
        ),
      },
      {
        key: 'logId',
        label: '',
        sortable: false,
        render: (_value, row) => (
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleViewError(row);
              }}
              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
              aria-label="View error details"
              title="View Details"
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
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </button>
          </div>
        ),
      },
    ],
    [handleViewError]
  );

  /**
   * Search bar filter configuration.
   * @type {Array<object>}
   */
  const searchFilters = useMemo(
    () => [
      {
        key: 'errorType',
        label: 'Error Type',
        options: ERROR_TYPE_FILTER_OPTIONS,
      },
    ],
    []
  );

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Error Logs</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {errorStats.total} error{errorStats.total !== 1 ? 's' : ''} total
            {filteredLogs.length !== errorStats.total && (
              <span className="text-primary-600 ml-2">
                • {filteredLogs.length} matching
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Severity badges */}
          {errorStats.criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-error-100 text-error-800 rounded-full">
              <div className="h-1.5 w-1.5 rounded-full bg-error-600" />
              {errorStats.criticalCount} critical
            </span>
          )}
          {errorStats.highCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-error-50 text-error-700 rounded-full">
              <div className="h-1.5 w-1.5 rounded-full bg-error-500" />
              {errorStats.highCount} high
            </span>
          )}
          {errorStats.mediumCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-warning-50 text-warning-700 rounded-full">
              <div className="h-1.5 w-1.5 rounded-full bg-warning-500" />
              {errorStats.mediumCount} medium
            </span>
          )}
          {errorStats.lowCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded-full">
              <div className="h-1.5 w-1.5 rounded-full bg-primary-500" />
              {errorStats.lowCount} low
            </span>
          )}

          {/* Export Button */}
          {canExport && errorStats.total > 0 && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export CSV
            </button>
          )}

          {/* Clear Logs Button */}
          {canClearLogs && errorStats.total > 0 && (
            <button
              type="button"
              onClick={handleClearLogsClick}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Clear Logs
            </button>
          )}
        </div>
      </div>

      {/* Alert Message */}
      {alertMessage && (
        <AlertMessage
          type={alertMessage.type}
          message={alertMessage.message}
          title={alertMessage.title}
          dismissible
          onDismiss={() => setAlertMessage(null)}
          autoDismissMs={5000}
        />
      )}

      {/* Error Type Breakdown */}
      {errorStats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="text-center p-3 bg-error-50 rounded-lg border border-error-100">
            <p className="text-xs text-error-600">Validation</p>
            <p className="text-lg font-semibold text-error-700">{errorStats.validationErrors}</p>
          </div>
          <div className="text-center p-3 bg-error-50 rounded-lg border border-error-100">
            <p className="text-xs text-error-600">Parsing</p>
            <p className="text-lg font-semibold text-error-700">{errorStats.parsingErrors}</p>
          </div>
          <div className="text-center p-3 bg-warning-50 rounded-lg border border-warning-100">
            <p className="text-xs text-warning-600">Eligibility</p>
            <p className="text-lg font-semibold text-warning-700">{errorStats.eligibilityErrors}</p>
          </div>
          <div className="text-center p-3 bg-error-50 rounded-lg border border-error-100">
            <p className="text-xs text-error-600">Integration</p>
            <p className="text-lg font-semibold text-error-700">{errorStats.integrationErrors}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-600">Other</p>
            <p className="text-lg font-semibold text-gray-700">{errorStats.otherErrors}</p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <SearchBar
        placeholder="Search by error type, message, file ID, or member ID..."
        onSearch={handleSearch}
        filters={searchFilters}
        debounceMs={300}
      />

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredLogs}
        onRowClick={handleViewError}
        pageSize={15}
        sortable
        rowKey="logId"
        emptyMessage="No error logs found. Errors will be logged as they occur during file processing."
      />

      {/* Error Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={handleCloseDetailModal}
        title="Error Log Details"
        size="md"
        actions={[
          {
            label: 'Close',
            onClick: handleCloseDetailModal,
            variant: 'secondary',
          },
        ]}
      >
        {selectedError && (
          <div className="space-y-5">
            {/* Error Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-error-100 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-error-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-800">
                  {selectedError.errorType || 'Unknown Error'}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {(() => {
                    const severity = getErrorSeverity(selectedError.errorType);
                    const severityClasses = getSeverityClasses(severity);
                    return (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${severityClasses.bg} ${severityClasses.text}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${severityClasses.dot}`} />
                        {getSeverityLabel(severity)}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-gray-500">
                    {selectedError.timestamp ? formatTimestamp(selectedError.timestamp) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            <div>
              <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
                Error Message
              </h4>
              <div className="p-3 bg-error-50 border border-error-200 rounded-lg">
                <p className="text-sm text-error-700 break-words">
                  {selectedError.message || 'No message available.'}
                </p>
              </div>
            </div>

            {/* Error Information */}
            <div>
              <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                Error Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Log ID</p>
                  <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs break-all">
                    {selectedError.logId || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Error Type</p>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {selectedError.errorType || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Severity</p>
                  <div className="mt-1">
                    {(() => {
                      const severity = getErrorSeverity(selectedError.errorType);
                      const severityClasses = getSeverityClasses(severity);
                      return (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${severityClasses.bg} ${severityClasses.text}`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${severityClasses.dot}`} />
                          {getSeverityLabel(severity)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Timestamp</p>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {selectedError.timestamp ? formatTimestamp(selectedError.timestamp) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">File ID</p>
                  <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs break-all">
                    {selectedError.fileId || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Member ID</p>
                  <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs break-all">
                    {selectedError.memberId || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Troubleshooting Hints */}
            <div>
              <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
                Troubleshooting
              </h4>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                {selectedError.errorType === 'ValidationError' && (
                  <p className="text-xs text-gray-600">
                    Validation errors typically occur when the uploaded file does not conform to the EDI 834 format.
                    Verify the file structure includes required ISA, GS, ST, SE, GE, and IEA segments.
                  </p>
                )}
                {selectedError.errorType === 'ParsingError' && (
                  <p className="text-xs text-gray-600">
                    Parsing errors occur when the EDI 834 content cannot be properly interpreted.
                    Check that segment terminators and element separators are consistent throughout the file.
                  </p>
                )}
                {selectedError.errorType === 'EligibilityError' && (
                  <p className="text-xs text-gray-600">
                    Eligibility errors occur during the eligibility determination process.
                    Review the eligibility rules configuration and ensure member data contains required fields.
                  </p>
                )}
                {selectedError.errorType === 'IntegrationError' && (
                  <p className="text-xs text-gray-600">
                    Integration errors occur when transmitting data to downstream systems.
                    Check endpoint configuration and retry the transmission from the Integration panel.
                  </p>
                )}
                {selectedError.errorType === 'EnrollmentError' && (
                  <p className="text-xs text-gray-600">
                    Enrollment errors occur when creating enrollment records.
                    Verify that member data is complete and valid before enrollment creation.
                  </p>
                )}
                {selectedError.errorType === 'CategorizationError' && (
                  <p className="text-xs text-gray-600">
                    Categorization errors occur when storing or updating member records.
                    Check for data conflicts or missing required fields.
                  </p>
                )}
                {selectedError.errorType === 'DuplicateFileError' && (
                  <p className="text-xs text-gray-600">
                    A duplicate file was detected. The same file content has already been uploaded and processed.
                    If you need to reprocess, delete the original file first.
                  </p>
                )}
                {!selectedError.errorType && (
                  <p className="text-xs text-gray-600">
                    Review the error message for details. If the issue persists, check the audit logs for additional context.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Clear Logs Confirmation Modal */}
      <Modal
        isOpen={clearModalOpen}
        onClose={handleCancelClearLogs}
        title="Clear Error Logs"
        size="sm"
        actions={[
          {
            label: 'Cancel',
            onClick: handleCancelClearLogs,
            variant: 'secondary',
          },
          {
            label: 'Clear All Logs',
            onClick: handleConfirmClearLogs,
            variant: 'danger',
          },
        ]}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Are you sure you want to clear all error logs? This will also clear audit logs. This action cannot be undone.
          </p>
          <div className="p-3 bg-warning-50 border border-warning-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-warning-500 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-xs text-warning-700">
                This will remove {errorStats.total} error log{errorStats.total !== 1 ? 's' : ''}.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

ErrorLogViewer.propTypes = {
  className: PropTypes.string,
};

ErrorLogViewer.defaultProps = {
  className: '',
};

export default ErrorLogViewer;