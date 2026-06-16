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
 * Action type filter options for audit logs.
 * @type {Array<{ value: string, label: string }>}
 */
const ACTION_FILTER_OPTIONS = [
  { value: 'File Uploaded', label: 'File Uploaded' },
  { value: 'File Validated', label: 'File Validated' },
  { value: 'File Parsed', label: 'File Parsed' },
  { value: 'File Processing Completed', label: 'File Processing Completed' },
  { value: 'File Upload Failed', label: 'File Upload Failed' },
  { value: 'File Validation Failed', label: 'File Validation Failed' },
  { value: 'File Deleted', label: 'File Deleted' },
  { value: 'File Retry Initiated', label: 'File Retry Initiated' },
  { value: 'Eligibility Determined', label: 'Eligibility Determined' },
  { value: 'Eligibility Rule Added', label: 'Eligibility Rule Added' },
  { value: 'Eligibility Rule Updated', label: 'Eligibility Rule Updated' },
  { value: 'Eligibility Rule Deleted', label: 'Eligibility Rule Deleted' },
  { value: 'Member Added', label: 'Member Added' },
  { value: 'Member Updated', label: 'Member Updated' },
  { value: 'Member Viewed', label: 'Member Viewed' },
  { value: 'Enrollment Created', label: 'Enrollment Created' },
  { value: 'Enrollment Viewed', label: 'Enrollment Viewed' },
  { value: 'Member Data Transmitted', label: 'Member Data Transmitted' },
  { value: 'Integration Retry', label: 'Integration Retry' },
  { value: 'Bulk Transmission Completed', label: 'Bulk Transmission Completed' },
  { value: 'Demo Data Seeded', label: 'Demo Data Seeded' },
  { value: 'Pipeline Data Cleared', label: 'Pipeline Data Cleared' },
];

/**
 * Log type filter options (audit vs error).
 * @type {Array<{ value: string, label: string }>}
 */
const LOG_TYPE_FILTER_OPTIONS = [
  { value: 'audit', label: 'Audit Logs' },
  { value: 'error', label: 'Error Logs' },
];

/**
 * Resolves the entity type from an audit log entry based on the action string.
 * @param {object} log - The audit log entry.
 * @returns {string} The entity type label.
 */
function resolveEntityType(log) {
  if (!log || !log.action) return 'Unknown';

  const action = log.action || '';

  if (action.startsWith('File') || action.includes('File')) return 'File';
  if (action.startsWith('Member') || action.includes('Member')) return 'Member';
  if (action.startsWith('Eligibility') || action.includes('Eligibility')) return 'Eligibility Rule';
  if (action.startsWith('Enrollment') || action.includes('Enrollment')) return 'Enrollment';
  if (action.startsWith('Integration') || action.includes('Integration') || action.includes('Transmission') || action.includes('Transmit')) return 'Integration';
  if (action.startsWith('Error:')) return 'Error';
  if (action.includes('Pipeline')) return 'Pipeline';
  if (action.includes('Demo Data')) return 'System';
  if (action.includes('Endpoint')) return 'Integration';
  if (action.includes('Rules Reset')) return 'Eligibility Rule';
  if (action.includes('Logs Cleared')) return 'System';
  if (action.includes('Tab Viewed')) return 'UI';

  return 'System';
}

/**
 * Maps an entity type to a StatusBadge-compatible status string.
 * @param {string} entityType - The entity type.
 * @returns {string} A status string for StatusBadge.
 */
function getEntityTypeBadgeStatus(entityType) {
  switch (entityType) {
    case 'File':
      return 'Uploaded';
    case 'Member':
      return 'Active';
    case 'Eligibility Rule':
      return 'Eligible';
    case 'Enrollment':
      return 'Processing';
    case 'Integration':
      return 'Validating';
    case 'Error':
      return 'Failed';
    case 'Pipeline':
      return 'Processing';
    case 'System':
      return 'Completed';
    case 'UI':
      return 'Pending';
    default:
      return 'Pending';
  }
}

/**
 * Converts audit logs to CSV string format.
 * @param {Array<object>} logs - The audit log entries.
 * @returns {string} The CSV string.
 */
function convertToCSV(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return '';
  }

  const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'User ID', 'Details'];
  const rows = logs.map((log) => {
    const entityType = resolveEntityType(log);
    const details = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '';
    return [
      log.timestamp || '',
      (log.action || '').replace(/"/g, '""'),
      entityType,
      (log.entityId || '').replace(/"/g, '""'),
      (log.userId || '').replace(/"/g, '""'),
      `"${details}"`,
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
 * AuditLogViewer component.
 * Displays all audit trail entries in a searchable, filterable DataTable.
 * Columns: timestamp, action, entity type, user, details.
 * Supports filtering by action type, date range, and user.
 * Includes export button to download logs as JSON/CSV.
 *
 * @param {{ className?: string }} props
 * @returns {import('react').ReactElement}
 */
export function AuditLogViewer({ className }) {
  const auditLogs = useAuditStore((state) => state.auditLogs);
  const errorLogs = useAuditStore((state) => state.errorLogs);
  const clearLogs = useAuditStore((state) => state.clearLogs);
  const exportLogs = useAuditStore((state) => state.exportLogs);
  const { currentUser, hasPermission } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [alertMessage, setAlertMessage] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [activeLogType, setActiveLogType] = useState('audit');

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
   * Combined and enriched logs based on active log type.
   */
  const currentLogs = useMemo(() => {
    if (activeLogType === 'error') {
      return (Array.isArray(errorLogs) ? errorLogs : []).map((log) => ({
        logId: log.logId,
        action: `Error: ${log.errorType || 'Unknown'}`,
        entityId: log.fileId || log.memberId || '',
        userId: '',
        timestamp: log.timestamp,
        details: {
          errorType: log.errorType,
          message: log.message,
          fileId: log.fileId,
          memberId: log.memberId,
        },
      }));
    }
    return Array.isArray(auditLogs) ? auditLogs : [];
  }, [auditLogs, errorLogs, activeLogType]);

  /**
   * Filters logs based on search term and active filters.
   */
  const filteredLogs = useMemo(() => {
    let result = [...currentLogs];

    // Apply search term filter
    if (searchTerm && searchTerm.trim().length > 0) {
      const lowerSearch = searchTerm.toLowerCase().trim();
      result = result.filter((log) => {
        const action = (log.action || '').toLowerCase();
        const entityId = (log.entityId || '').toLowerCase();
        const userId = (log.userId || '').toLowerCase();
        const entityType = resolveEntityType(log).toLowerCase();
        const detailsStr = log.details ? JSON.stringify(log.details).toLowerCase() : '';

        return (
          action.includes(lowerSearch) ||
          entityId.includes(lowerSearch) ||
          userId.includes(lowerSearch) ||
          entityType.includes(lowerSearch) ||
          detailsStr.includes(lowerSearch)
        );
      });
    }

    // Apply action filter
    if (activeFilters.action) {
      result = result.filter((log) => log.action === activeFilters.action);
    }

    // Apply log type filter
    if (activeFilters.logType) {
      if (activeFilters.logType !== activeLogType) {
        setActiveLogType(activeFilters.logType);
      }
    }

    return result;
  }, [currentLogs, searchTerm, activeFilters, activeLogType]);

  /**
   * Log statistics summary.
   */
  const logStats = useMemo(() => {
    const allAudit = Array.isArray(auditLogs) ? auditLogs : [];
    const allErrors = Array.isArray(errorLogs) ? errorLogs : [];

    const errorActions = allAudit.filter((log) => (log.action || '').startsWith('Error:'));
    const fileActions = allAudit.filter((log) => (log.action || '').includes('File'));
    const memberActions = allAudit.filter((log) => (log.action || '').includes('Member') || (log.action || '').includes('Eligibility'));
    const integrationActions = allAudit.filter((log) => (log.action || '').includes('Transmit') || (log.action || '').includes('Integration') || (log.action || '').includes('Transmission'));

    return {
      totalAudit: allAudit.length,
      totalErrors: allErrors.length,
      errorActions: errorActions.length,
      fileActions: fileActions.length,
      memberActions: memberActions.length,
      integrationActions: integrationActions.length,
    };
  }, [auditLogs, errorLogs]);

  /**
   * Handles viewing a log entry's details.
   * @param {object} log - The log entry to view.
   */
  const handleViewLog = useCallback((log) => {
    if (!log) return;
    setSelectedLog(log);
    setDetailModalOpen(true);
  }, []);

  /**
   * Handles closing the detail modal.
   */
  const handleCloseDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedLog(null);
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
      message: 'All audit and error logs have been cleared.',
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
   * Handles opening the export modal.
   */
  const handleExportClick = useCallback(() => {
    setExportModalOpen(true);
  }, []);

  /**
   * Handles closing the export modal.
   */
  const handleCloseExportModal = useCallback(() => {
    setExportModalOpen(false);
  }, []);

  /**
   * Exports logs as JSON.
   */
  const handleExportJSON = useCallback(() => {
    const jsonContent = exportLogs();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(jsonContent, `audit-logs-${timestamp}.json`, 'application/json');
    setAlertMessage({
      type: 'success',
      message: 'Audit logs exported as JSON successfully.',
      title: 'Export Complete',
    });
    setExportModalOpen(false);
  }, [exportLogs]);

  /**
   * Exports filtered logs as CSV.
   */
  const handleExportCSV = useCallback(() => {
    const csvContent = convertToCSV(filteredLogs);
    if (!csvContent) {
      setAlertMessage({
        type: 'warning',
        message: 'No logs to export.',
        title: 'Export Empty',
      });
      setExportModalOpen(false);
      return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(csvContent, `audit-logs-${timestamp}.csv`, 'text/csv');
    setAlertMessage({
      type: 'success',
      message: `${filteredLogs.length} log(s) exported as CSV successfully.`,
      title: 'Export Complete',
    });
    setExportModalOpen(false);
  }, [filteredLogs]);

  /**
   * Handles switching between audit and error log views.
   * @param {string} logType - The log type to switch to.
   */
  const handleLogTypeSwitch = useCallback((logType) => {
    setActiveLogType(logType);
  }, []);

  /**
   * DataTable column definitions for audit logs.
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
        key: 'action',
        label: 'Action',
        sortable: true,
        render: (value) => {
          const isError = (value || '').startsWith('Error:');
          return (
            <span className={`text-sm font-medium ${isError ? 'text-error-700' : 'text-gray-800'}`}>
              {value || '—'}
            </span>
          );
        },
      },
      {
        key: 'entityType',
        label: 'Entity Type',
        sortable: false,
        render: (_value, row) => {
          const entityType = resolveEntityType(row);
          const badgeStatus = getEntityTypeBadgeStatus(entityType);
          return <StatusBadge status={entityType} size="sm" />;
        },
      },
      {
        key: 'entityId',
        label: 'Entity ID',
        sortable: true,
        render: (value) => (
          <span className="font-mono text-xs text-gray-700" title={value || ''}>
            {value ? (value.length > 12 ? value.substring(0, 12) + '...' : value) : '—'}
          </span>
        ),
      },
      {
        key: 'userId',
        label: 'User',
        sortable: true,
        render: (value) => (
          <span className="text-xs text-gray-600">
            {value || 'system'}
          </span>
        ),
      },
      {
        key: 'details',
        label: 'Details',
        sortable: false,
        render: (value) => {
          if (!value) return <span className="text-xs text-gray-400">—</span>;

          let summary = '';
          if (typeof value === 'object') {
            const keys = Object.keys(value);
            if (keys.length === 0) return <span className="text-xs text-gray-400">—</span>;

            const parts = [];
            for (const key of keys.slice(0, 2)) {
              const val = value[key];
              if (val !== null && val !== undefined && val !== '') {
                const displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                parts.push(`${key}: ${displayVal.length > 20 ? displayVal.slice(0, 20) + '...' : displayVal}`);
              }
            }
            if (keys.length > 2) {
              parts.push(`+${keys.length - 2} more`);
            }
            summary = parts.join(', ');
          } else {
            summary = String(value);
          }

          return (
            <span className="text-xs text-gray-600 truncate max-w-[200px] block" title={summary}>
              {summary.length > 50 ? summary.slice(0, 50) + '...' : summary}
            </span>
          );
        },
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
                handleViewLog(row);
              }}
              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
              aria-label="View log details"
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
    [handleViewLog]
  );

  /**
   * Search bar filter configuration.
   * @type {Array<object>}
   */
  const searchFilters = useMemo(
    () => [
      {
        key: 'action',
        label: 'Action',
        options: ACTION_FILTER_OPTIONS,
      },
    ],
    []
  );

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Audit Logs</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {logStats.totalAudit} audit log{logStats.totalAudit !== 1 ? 's' : ''}
            {logStats.totalErrors > 0 && (
              <span className="text-error-600 ml-2">
                • {logStats.totalErrors} error{logStats.totalErrors !== 1 ? 's' : ''}
              </span>
            )}
            {filteredLogs.length !== currentLogs.length && (
              <span className="text-primary-600 ml-2">
                • {filteredLogs.length} matching
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick stat badges */}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded-full">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {logStats.fileActions} file
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-success-50 text-success-700 rounded-full">
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {logStats.memberActions} member
          </span>
          {logStats.errorActions > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-error-50 text-error-700 rounded-full">
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
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {logStats.errorActions} error
            </span>
          )}

          {/* Export Button */}
          {canExport && (
            <button
              type="button"
              onClick={handleExportClick}
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
              Export
            </button>
          )}

          {/* Clear Logs Button */}
          {canClearLogs && logStats.totalAudit > 0 && (
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

      {/* Log Type Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => handleLogTypeSwitch('audit')}
            className={`flex-1 sm:flex-none px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeLogType === 'audit'
                ? 'border-primary-500 text-primary-700 bg-primary-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            aria-selected={activeLogType === 'audit'}
            role="tab"
          >
            <span className="flex items-center gap-1.5">
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Audit Logs ({logStats.totalAudit})
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleLogTypeSwitch('error')}
            className={`flex-1 sm:flex-none px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeLogType === 'error'
                ? 'border-error-500 text-error-700 bg-error-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            aria-selected={activeLogType === 'error'}
            role="tab"
          >
            <span className="flex items-center gap-1.5">
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
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Error Logs ({logStats.totalErrors})
            </span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Search and Filters */}
          <SearchBar
            placeholder="Search by action, entity ID, user, or details..."
            onSearch={handleSearch}
            filters={activeLogType === 'audit' ? searchFilters : []}
            debounceMs={300}
          />

          {/* Data Table */}
          <DataTable
            columns={columns}
            data={filteredLogs}
            onRowClick={handleViewLog}
            pageSize={15}
            sortable
            rowKey="logId"
            emptyMessage={
              activeLogType === 'error'
                ? 'No error logs found.'
                : 'No audit logs found. Actions will be logged as they occur.'
            }
          />
        </div>
      </div>

      {/* Log Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={handleCloseDetailModal}
        title="Log Entry Details"
        size="md"
        actions={[
          {
            label: 'Close',
            onClick: handleCloseDetailModal,
            variant: 'secondary',
          },
        ]}
      >
        {selectedLog && (
          <div className="space-y-5">
            {/* Log Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
              <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                (selectedLog.action || '').startsWith('Error:')
                  ? 'bg-error-100'
                  : 'bg-primary-100'
              }`}>
                {(selectedLog.action || '').startsWith('Error:') ? (
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
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-primary-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-800">
                  {selectedLog.action || 'Unknown Action'}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusBadge status={resolveEntityType(selectedLog)} size="sm" />
                  <span className="text-xs text-gray-500">
                    {selectedLog.timestamp ? formatTimestamp(selectedLog.timestamp) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Log Information */}
            <div>
              <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                Log Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Log ID</p>
                  <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs break-all">
                    {selectedLog.logId || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Action</p>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {selectedLog.action || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Entity Type</p>
                  <div className="mt-1">
                    <StatusBadge status={resolveEntityType(selectedLog)} size="md" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Entity ID</p>
                  <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs break-all">
                    {selectedLog.entityId || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">User</p>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {selectedLog.userId || 'system'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Timestamp</p>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {selectedLog.timestamp ? formatTimestamp(selectedLog.timestamp) : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Details */}
            {selectedLog.details && typeof selectedLog.details === 'object' && Object.keys(selectedLog.details).length > 0 && (
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                  Details
                </h4>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(selectedLog.details).map(([key, value]) => {
                      if (value === null || value === undefined) return null;

                      let displayValue;
                      if (typeof value === 'object') {
                        displayValue = JSON.stringify(value, null, 2);
                      } else {
                        displayValue = String(value);
                      }

                      return (
                        <div key={key} className={typeof value === 'object' ? 'sm:col-span-2' : ''}>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                            {key}
                          </p>
                          {typeof value === 'object' ? (
                            <pre className="text-xs text-gray-800 mt-0.5 font-mono whitespace-pre-wrap break-all bg-white p-2 rounded border border-gray-100 max-h-32 overflow-y-auto">
                              {displayValue}
                            </pre>
                          ) : (
                            <p className="text-sm text-gray-800 mt-0.5 break-all">
                              {displayValue}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Clear Logs Confirmation Modal */}
      <Modal
        isOpen={clearModalOpen}
        onClose={handleCancelClearLogs}
        title="Clear All Logs"
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
            Are you sure you want to clear all audit and error logs? This action cannot be undone.
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
                This will remove {logStats.totalAudit} audit log{logStats.totalAudit !== 1 ? 's' : ''} and{' '}
                {logStats.totalErrors} error log{logStats.totalErrors !== 1 ? 's' : ''}.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Export Modal */}
      <Modal
        isOpen={exportModalOpen}
        onClose={handleCloseExportModal}
        title="Export Audit Logs"
        size="sm"
        actions={[
          {
            label: 'Cancel',
            onClick: handleCloseExportModal,
            variant: 'secondary',
          },
        ]}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Choose an export format for the audit logs.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* JSON Export */}
            <button
              type="button"
              onClick={handleExportJSON}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50 transition-colors cursor-pointer text-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-primary-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="text-sm font-medium text-gray-800">JSON</span>
              <span className="text-xs text-gray-500">
                All logs ({logStats.totalAudit + logStats.totalErrors})
              </span>
            </button>

            {/* CSV Export */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50 transition-colors cursor-pointer text-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-primary-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm font-medium text-gray-800">CSV</span>
              <span className="text-xs text-gray-500">
                Filtered ({filteredLogs.length})
              </span>
            </button>
          </div>

          <p className="text-xs text-gray-500">
            JSON exports all audit and error logs. CSV exports only the currently filtered view.
          </p>
        </div>
      </Modal>
    </div>
  );
}

AuditLogViewer.propTypes = {
  className: PropTypes.string,
};

AuditLogViewer.defaultProps = {
  className: '',
};

export default AuditLogViewer;