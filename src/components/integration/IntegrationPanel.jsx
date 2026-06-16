import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useIntegrationStore } from '../../stores/integrationStore';
import { useMemberStore } from '../../stores/memberStore';
import { useAuditStore } from '../../stores/auditStore';
import { useAuth } from '../../contexts/AuthContext';
import { MEMBER_STATUS } from '../../utils/constants';
import { formatTimestamp } from '../../utils/helpers';
import { DataTable } from '../common/DataTable';
import { SearchBar } from '../common/SearchBar';
import { StatusBadge } from '../common/StatusBadge';
import { StatsCard } from '../common/StatsCard';
import { AlertMessage } from '../common/AlertMessage';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';

/**
 * Status filter options for integration logs.
 * @type {Array<{ value: string, label: string }>}
 */
const STATUS_FILTER_OPTIONS = [
  { value: 'Success', label: 'Success' },
  { value: 'Failed', label: 'Failed' },
  { value: 'InProgress', label: 'In Progress' },
  { value: 'Pending', label: 'Pending' },
];

/**
 * Destination filter options for integration logs.
 * @type {Array<{ value: string, label: string }>}
 */
const DESTINATION_FILTER_OPTIONS = [
  { value: 'medicaid-state-system', label: 'State Medicaid System' },
  { value: 'cms-federal', label: 'CMS Federal Hub' },
  { value: 'ehr-system', label: 'EHR System' },
];

/**
 * Maps a transmission status to a health indicator color class.
 * @param {string} status - The transmission status.
 * @returns {string} Tailwind CSS color class.
 */
function getHealthColor(status) {
  switch (status) {
    case 'Success':
      return 'bg-success-500';
    case 'Failed':
      return 'bg-error-500';
    case 'InProgress':
      return 'bg-warning-500';
    case 'Pending':
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
}

/**
 * Computes health status for an endpoint based on recent transmission logs.
 * @param {string} endpointId - The endpoint ID.
 * @param {Array<object>} logs - All integration logs.
 * @returns {{ status: string, successRate: number, recentCount: number }}
 */
function computeEndpointHealth(endpointId, logs) {
  const endpointLogs = logs.filter((log) => log.destination === endpointId);
  const recentCount = endpointLogs.length;

  if (recentCount === 0) {
    return { status: 'No Data', successRate: 0, recentCount: 0 };
  }

  const successCount = endpointLogs.filter((log) => log.status === 'Success').length;
  const successRate = recentCount > 0 ? (successCount / recentCount) * 100 : 0;

  let status = 'Healthy';
  if (successRate < 50) {
    status = 'Degraded';
  } else if (successRate < 80) {
    status = 'Warning';
  }

  return { status, successRate, recentCount };
}

/**
 * IntegrationPanel component.
 * Integration management panel showing mock downstream endpoints configuration,
 * transmission logs table, retry button for failed transmissions, and integration
 * health status indicators. Includes button to trigger bulk transmission of
 * eligible enrollments.
 *
 * @param {{ className?: string }} props
 * @returns {import('react').ReactElement}
 */
export function IntegrationPanel({ className }) {
  const integrationLogs = useIntegrationStore((state) => state.integrationLogs);
  const integrationConfig = useIntegrationStore((state) => state.integrationConfig);
  const transmitEnrollmentData = useIntegrationStore((state) => state.transmitEnrollmentData);
  const retryTransmission = useIntegrationStore((state) => state.retryTransmission);
  const configureIntegration = useIntegrationStore((state) => state.configureIntegration);
  const clearIntegrationLogs = useIntegrationStore((state) => state.clearIntegrationLogs);
  const getIntegrationStats = useIntegrationStore((state) => state.getIntegrationStats);

  const members = useMemberStore((state) => state.members);
  const { currentUser, hasPermission } = useAuth();
  const logAction = useAuditStore((state) => state.logAction);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [alertMessage, setAlertMessage] = useState(null);
  const [retryingLogId, setRetryingLogId] = useState(null);
  const [isBulkTransmitting, setIsBulkTransmitting] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);

  const canViewSystem = hasPermission('view_system_status');
  const canManageSettings = hasPermission('manage_settings');

  /**
   * Integration statistics.
   */
  const integrationStats = useMemo(() => {
    return getIntegrationStats();
  }, [getIntegrationStats, integrationLogs]);

  /**
   * Eligible members available for bulk transmission.
   */
  const eligibleMembers = useMemo(() => {
    const allMembers = Array.isArray(members) ? members : [];
    return allMembers.filter(
      (m) =>
        m.eligibilityStatus === MEMBER_STATUS.ELIGIBLE ||
        m.status === MEMBER_STATUS.ELIGIBLE
    );
  }, [members]);

  /**
   * Endpoint health statuses.
   */
  const endpointHealthStatuses = useMemo(() => {
    const endpoints = (integrationConfig && Array.isArray(integrationConfig.endpoints))
      ? integrationConfig.endpoints
      : [];
    const allLogs = Array.isArray(integrationLogs) ? integrationLogs : [];

    return endpoints.map((ep) => ({
      ...ep,
      health: computeEndpointHealth(ep.id, allLogs),
    }));
  }, [integrationConfig, integrationLogs]);

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
   * Filters integration logs based on search term and active filters.
   */
  const filteredLogs = useMemo(() => {
    let result = Array.isArray(integrationLogs) ? [...integrationLogs] : [];

    if (searchTerm && searchTerm.trim().length > 0) {
      const lowerSearch = searchTerm.toLowerCase().trim();
      result = result.filter((log) => {
        const memberId = (log.memberId || '').toLowerCase();
        const destination = (log.destinationName || log.destination || '').toLowerCase();
        const status = (log.status || '').toLowerCase();
        const id = (log.id || '').toLowerCase();

        return (
          memberId.includes(lowerSearch) ||
          destination.includes(lowerSearch) ||
          status.includes(lowerSearch) ||
          id.includes(lowerSearch)
        );
      });
    }

    if (activeFilters.status) {
      result = result.filter((log) => log.status === activeFilters.status);
    }

    if (activeFilters.destination) {
      result = result.filter((log) => log.destination === activeFilters.destination);
    }

    return result;
  }, [integrationLogs, searchTerm, activeFilters]);

  /**
   * Handles retrying a failed transmission.
   * @param {object} log - The integration log entry to retry.
   */
  const handleRetry = useCallback(
    async (log) => {
      if (!log || !log.id || retryingLogId) return;

      if (log.status !== 'Failed') {
        setAlertMessage({
          type: 'warning',
          message: 'Only failed transmissions can be retried.',
          title: 'Cannot Retry',
        });
        return;
      }

      setRetryingLogId(log.id);
      setAlertMessage(null);

      try {
        const result = await retryTransmission(log.id);

        if (result) {
          const userId = currentUser ? currentUser.id : '';
          logAction('Integration Retry', log.id, userId, {
            memberId: log.memberId || '',
            destination: log.destination || '',
            newStatus: result.status || '',
          });

          if (result.status === 'Success') {
            setAlertMessage({
              type: 'success',
              message: `Transmission to ${log.destinationName || log.destination} retried successfully.`,
              title: 'Retry Successful',
            });
          } else {
            setAlertMessage({
              type: 'error',
              message: `Retry to ${log.destinationName || log.destination} failed. ${result.response ? result.response.message : ''}`,
              title: 'Retry Failed',
            });
          }
        } else {
          setAlertMessage({
            type: 'error',
            message: 'Unable to retry this transmission. It may have exceeded the maximum retry count.',
            title: 'Retry Not Available',
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during retry.';
        setAlertMessage({
          type: 'error',
          message: errorMessage,
          title: 'Retry Error',
        });
      } finally {
        setRetryingLogId(null);
      }
    },
    [retryingLogId, retryTransmission, currentUser, logAction]
  );

  /**
   * Handles bulk transmission of all eligible members.
   */
  const handleBulkTransmit = useCallback(async () => {
    if (isBulkTransmitting || eligibleMembers.length === 0) return;

    setIsBulkTransmitting(true);
    setAlertMessage(null);

    const userId = currentUser ? currentUser.id : '';
    const userName = currentUser ? currentUser.name : '';
    const user = { id: userId, name: userName };

    let totalSuccess = 0;
    let totalFailed = 0;
    let totalTransmissions = 0;

    try {
      for (const member of eligibleMembers) {
        try {
          const results = await transmitEnrollmentData(member, user);
          totalTransmissions += results.length;
          totalSuccess += results.filter((r) => r.status === 'Success').length;
          totalFailed += results.filter((r) => r.status === 'Failed').length;
        } catch (_err) {
          totalFailed++;
        }
      }

      logAction('Bulk Transmission Completed', '', userId, {
        eligibleCount: eligibleMembers.length,
        totalTransmissions,
        successCount: totalSuccess,
        failedCount: totalFailed,
      });

      if (totalFailed === 0 && totalSuccess > 0) {
        setAlertMessage({
          type: 'success',
          message: `Bulk transmission completed: ${totalSuccess} successful transmission(s) for ${eligibleMembers.length} eligible member(s).`,
          title: 'Bulk Transmission Complete',
        });
      } else if (totalSuccess > 0 && totalFailed > 0) {
        setAlertMessage({
          type: 'warning',
          message: `Bulk transmission completed with issues: ${totalSuccess} successful, ${totalFailed} failed out of ${totalTransmissions} total transmission(s).`,
          title: 'Partial Success',
        });
      } else {
        setAlertMessage({
          type: 'error',
          message: `Bulk transmission failed: ${totalFailed} failed transmission(s). Check integration logs for details.`,
          title: 'Bulk Transmission Failed',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during bulk transmission.';
      setAlertMessage({
        type: 'error',
        message: errorMessage,
        title: 'Bulk Transmission Error',
      });
    } finally {
      setIsBulkTransmitting(false);
    }
  }, [isBulkTransmitting, eligibleMembers, transmitEnrollmentData, currentUser, logAction]);

  /**
   * Handles toggling an endpoint's enabled status.
   * @param {string} endpointId - The endpoint ID to toggle.
   */
  const handleToggleEndpoint = useCallback(
    (endpointId) => {
      if (!canManageSettings) return;

      const endpoints = (integrationConfig && Array.isArray(integrationConfig.endpoints))
        ? integrationConfig.endpoints
        : [];

      const updatedEndpoints = endpoints.map((ep) => {
        if (ep.id === endpointId) {
          return { ...ep, enabled: !ep.enabled };
        }
        return ep;
      });

      configureIntegration({ endpoints: updatedEndpoints });

      const toggledEndpoint = updatedEndpoints.find((ep) => ep.id === endpointId);
      const userId = currentUser ? currentUser.id : '';
      logAction('Integration Endpoint Toggled', endpointId, userId, {
        endpointName: toggledEndpoint ? toggledEndpoint.name : '',
        enabled: toggledEndpoint ? toggledEndpoint.enabled : false,
      });

      setAlertMessage({
        type: 'success',
        message: `Endpoint "${toggledEndpoint ? toggledEndpoint.name : endpointId}" ${toggledEndpoint && toggledEndpoint.enabled ? 'enabled' : 'disabled'}.`,
        title: 'Endpoint Updated',
      });
    },
    [canManageSettings, integrationConfig, configureIntegration, currentUser, logAction]
  );

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
   * Confirms and executes clearing integration logs.
   */
  const handleConfirmClearLogs = useCallback(() => {
    clearIntegrationLogs();
    const userId = currentUser ? currentUser.id : '';
    logAction('Integration Logs Cleared', '', userId, {
      clearedAt: new Date().toISOString(),
    });
    setAlertMessage({
      type: 'success',
      message: 'All integration logs have been cleared.',
      title: 'Logs Cleared',
    });
    setClearModalOpen(false);
  }, [clearIntegrationLogs, currentUser, logAction]);

  /**
   * Cancels clearing logs.
   */
  const handleCancelClearLogs = useCallback(() => {
    setClearModalOpen(false);
  }, []);

  /**
   * DataTable column definitions for transmission logs.
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
        key: 'memberId',
        label: 'Member',
        sortable: true,
        render: (value) => (
          <span className="font-mono text-xs text-gray-800">
            {value || '—'}
          </span>
        ),
      },
      {
        key: 'destinationName',
        label: 'Destination',
        sortable: true,
        render: (value, row) => (
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
              row.status === 'Success'
                ? 'bg-success-500'
                : row.status === 'Failed'
                  ? 'bg-error-500'
                  : row.status === 'InProgress'
                    ? 'bg-warning-500'
                    : 'bg-gray-400'
            }`} />
            <span className="text-xs text-gray-700">
              {value || row.destination || '—'}
            </span>
          </div>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (value) => {
          const displayStatus = value === 'InProgress' ? 'In Progress' : value;
          return <StatusBadge status={displayStatus || 'Unknown'} size="sm" />;
        },
      },
      {
        key: 'response',
        label: 'Response',
        sortable: false,
        render: (value) => {
          if (!value) return <span className="text-xs text-gray-400">—</span>;
          return (
            <span className="text-xs text-gray-600 truncate max-w-[200px] block" title={value.message || ''}>
              {value.statusCode ? `${value.statusCode}: ` : ''}
              {value.message
                ? value.message.length > 40
                  ? value.message.slice(0, 40) + '...'
                  : value.message
                : '—'}
            </span>
          );
        },
      },
      {
        key: 'id',
        label: 'Actions',
        sortable: false,
        render: (_value, row) => (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {/* View Details */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleViewLog(row);
              }}
              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
              aria-label="View transmission details"
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

            {/* Retry (only for failed transmissions) */}
            {row.status === 'Failed' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRetry(row);
                }}
                disabled={retryingLogId === row.id}
                className="p-1.5 text-gray-400 hover:text-warning-600 hover:bg-warning-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Retry transmission"
                title="Retry"
              >
                {retryingLogId === row.id ? (
                  <svg
                    className="animate-spin h-4 w-4 text-warning-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                )}
              </button>
            )}
          </div>
        ),
      },
    ],
    [handleViewLog, handleRetry, retryingLogId]
  );

  /**
   * Search bar filter configuration.
   * @type {Array<object>}
   */
  const searchFilters = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        options: STATUS_FILTER_OPTIONS,
      },
      {
        key: 'destination',
        label: 'Destination',
        options: DESTINATION_FILTER_OPTIONS,
      },
    ],
    []
  );

  /**
   * Overall health status string.
   */
  const overallHealth = useMemo(() => {
    if (integrationStats.total === 0) return 'No Data';
    const rate = integrationStats.total > 0
      ? (integrationStats.success / integrationStats.total) * 100
      : 0;
    if (rate >= 80) return 'Healthy';
    if (rate >= 50) return 'Warning';
    return 'Degraded';
  }, [integrationStats]);

  /**
   * Overall health color.
   */
  const overallHealthColor = useMemo(() => {
    switch (overallHealth) {
      case 'Healthy':
        return 'text-success-600';
      case 'Warning':
        return 'text-warning-600';
      case 'Degraded':
        return 'text-error-600';
      default:
        return 'text-gray-500';
    }
  }, [overallHealth]);

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Integration Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {integrationStats.total} transmission{integrationStats.total !== 1 ? 's' : ''} total
            {integrationStats.failed > 0 && (
              <span className="text-error-600 ml-2">
                • {integrationStats.failed} failed
              </span>
            )}
            {integrationStats.inProgress > 0 && (
              <span className="text-warning-600 ml-2">
                • {integrationStats.inProgress} in progress
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Overall Health Indicator */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full ${
            overallHealth === 'Healthy'
              ? 'bg-success-50 text-success-700'
              : overallHealth === 'Warning'
                ? 'bg-warning-50 text-warning-700'
                : overallHealth === 'Degraded'
                  ? 'bg-error-50 text-error-700'
                  : 'bg-gray-100 text-gray-600'
          }`}>
            <div className={`h-2 w-2 rounded-full ${
              overallHealth === 'Healthy'
                ? 'bg-success-500'
                : overallHealth === 'Warning'
                  ? 'bg-warning-500'
                  : overallHealth === 'Degraded'
                    ? 'bg-error-500'
                    : 'bg-gray-400'
            }`} />
            {overallHealth}
          </span>

          {/* Bulk Transmit Button */}
          <button
            type="button"
            onClick={handleBulkTransmit}
            disabled={isBulkTransmitting || eligibleMembers.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBulkTransmitting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Transmitting...
              </>
            ) : (
              <>
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
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Transmit Eligible ({eligibleMembers.length})
              </>
            )}
          </button>

          {/* Clear Logs Button */}
          {canManageSettings && integrationStats.total > 0 && (
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

      {/* Bulk transmitting indicator */}
      {isBulkTransmitting && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 flex items-center gap-3">
          <LoadingSpinner size="sm" />
          <p className="text-sm text-primary-700">
            Transmitting enrollment data for {eligibleMembers.length} eligible member(s) to downstream systems...
          </p>
        </div>
      )}

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard
          label="Total Transmissions"
          value={integrationStats.total}
          icon="integrations"
          trend="neutral"
        />
        <StatsCard
          label="Successful"
          value={integrationStats.success}
          icon="eligible"
          trend={integrationStats.success > 0 ? 'up' : 'neutral'}
          trendValue={
            integrationStats.total > 0
              ? `${((integrationStats.success / integrationStats.total) * 100).toFixed(0)}%`
              : ''
          }
        />
        <StatsCard
          label="Failed"
          value={integrationStats.failed}
          icon="errors"
          trend={integrationStats.failed > 0 ? 'down' : 'neutral'}
          trendValue={
            integrationStats.total > 0
              ? `${((integrationStats.failed / integrationStats.total) * 100).toFixed(0)}%`
              : ''
          }
        />
        <StatsCard
          label="In Progress"
          value={integrationStats.inProgress}
          icon="pending"
          trend="neutral"
        />
      </div>

      {/* Endpoint Health & Configuration */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Downstream Endpoints</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {endpointHealthStatuses.filter((ep) => ep.enabled).length} of{' '}
              {endpointHealthStatuses.length} enabled
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {endpointHealthStatuses.map((endpoint) => (
            <div
              key={endpoint.id}
              className={`p-4 rounded-lg border transition-colors ${
                endpoint.enabled
                  ? 'border-gray-200 bg-white'
                  : 'border-gray-100 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                        !endpoint.enabled
                          ? 'bg-gray-300'
                          : endpoint.health.status === 'Healthy'
                            ? 'bg-success-500'
                            : endpoint.health.status === 'Warning'
                              ? 'bg-warning-500'
                              : endpoint.health.status === 'Degraded'
                                ? 'bg-error-500'
                                : 'bg-gray-400'
                      }`}
                    />
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {endpoint.name || endpoint.id}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate" title={endpoint.url}>
                    {endpoint.url || '—'}
                  </p>
                </div>

                {canManageSettings && (
                  <button
                    type="button"
                    onClick={() => handleToggleEndpoint(endpoint.id)}
                    className={`flex-shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                      endpoint.enabled ? 'bg-primary-500' : 'bg-gray-300'
                    }`}
                    role="switch"
                    aria-checked={endpoint.enabled}
                    aria-label={`Toggle ${endpoint.name}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        endpoint.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                      style={{ transform: endpoint.enabled ? 'translateX(18px)' : 'translateX(2px)' }}
                    />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <p className={`text-xs font-medium ${
                      !endpoint.enabled
                        ? 'text-gray-400'
                        : endpoint.health.status === 'Healthy'
                          ? 'text-success-600'
                          : endpoint.health.status === 'Warning'
                            ? 'text-warning-600'
                            : endpoint.health.status === 'Degraded'
                              ? 'text-error-600'
                              : 'text-gray-500'
                    }`}>
                      {endpoint.enabled ? endpoint.health.status : 'Disabled'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Success Rate</p>
                    <p className="text-xs font-medium text-gray-700">
                      {endpoint.enabled && endpoint.health.recentCount > 0
                        ? `${endpoint.health.successRate.toFixed(0)}%`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Transmissions</p>
                    <p className="text-xs font-medium text-gray-700">
                      {endpoint.health.recentCount}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Retry Policy Info */}
        {integrationConfig && integrationConfig.retryPolicy && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>
                Max Retries: <span className="font-medium text-gray-700">{integrationConfig.retryPolicy.maxRetries}</span>
              </span>
              <span>
                Base Delay: <span className="font-medium text-gray-700">{integrationConfig.retryPolicy.delayMs}ms</span>
              </span>
              <span>
                Backoff: <span className="font-medium text-gray-700">{integrationConfig.retryPolicy.backoffMultiplier}x</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <SearchBar
        placeholder="Search by member ID, destination, or status..."
        onSearch={handleSearch}
        filters={searchFilters}
        debounceMs={300}
      />

      {/* Retrying indicator */}
      {retryingLogId && (
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 flex items-center gap-3">
          <LoadingSpinner size="sm" />
          <p className="text-sm text-warning-700">
            Retrying transmission...
          </p>
        </div>
      )}

      {/* Transmission Logs Table */}
      <DataTable
        columns={columns}
        data={filteredLogs}
        onRowClick={handleViewLog}
        pageSize={10}
        sortable
        rowKey="id"
        emptyMessage="No integration transmissions found. Transmit eligible enrollments to see results."
      />

      {/* Transmission Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={handleCloseDetailModal}
        title="Transmission Details"
        size="md"
        actions={[
          ...(selectedLog && selectedLog.status === 'Failed'
            ? [
                {
                  label: 'Retry',
                  onClick: () => {
                    handleRetry(selectedLog);
                    handleCloseDetailModal();
                  },
                  variant: 'primary',
                  disabled: !!retryingLogId,
                },
              ]
            : []),
          {
            label: 'Close',
            onClick: handleCloseDetailModal,
            variant: 'secondary',
          },
        ]}
      >
        {selectedLog && (
          <div className="space-y-5">
            {/* Status Header */}
            <div
              className={`p-4 rounded-lg border ${
                selectedLog.status === 'Success'
                  ? 'bg-success-50 border-success-200'
                  : selectedLog.status === 'Failed'
                    ? 'bg-error-50 border-error-200'
                    : 'bg-warning-50 border-warning-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {selectedLog.status === 'Success' && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-success-500 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {selectedLog.status === 'Failed' && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-error-500 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {selectedLog.status !== 'Success' && selectedLog.status !== 'Failed' && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-warning-500 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      selectedLog.status === 'Success'
                        ? 'text-success-800'
                        : selectedLog.status === 'Failed'
                          ? 'text-error-800'
                          : 'text-warning-800'
                    }`}
                  >
                    Transmission {selectedLog.status === 'InProgress' ? 'In Progress' : selectedLog.status}
                  </p>
                  {selectedLog.response && selectedLog.response.message && (
                    <p
                      className={`text-xs mt-0.5 ${
                        selectedLog.status === 'Success'
                          ? 'text-success-600'
                          : selectedLog.status === 'Failed'
                            ? 'text-error-600'
                            : 'text-warning-600'
                      }`}
                    >
                      {selectedLog.response.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Transmission Info */}
            <div>
              <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                Transmission Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Log ID</p>
                  <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs break-all">
                    {selectedLog.id || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Member ID</p>
                  <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs">
                    {selectedLog.memberId || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Destination</p>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {selectedLog.destinationName || selectedLog.destination || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Destination URL</p>
                  <p className="text-sm text-gray-800 mt-0.5 text-xs break-all">
                    {selectedLog.destinationUrl || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Status</p>
                  <div className="mt-1">
                    <StatusBadge
                      status={selectedLog.status === 'InProgress' ? 'In Progress' : selectedLog.status || 'Unknown'}
                      size="md"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Retry Count</p>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {selectedLog.retryCount || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Timestamp</p>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {selectedLog.timestamp ? formatTimestamp(selectedLog.timestamp) : '—'}
                  </p>
                </div>
                {selectedLog.completedAt && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Completed At</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      {formatTimestamp(selectedLog.completedAt)}
                    </p>
                  </div>
                )}
                {selectedLog.userId && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">User</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      {selectedLog.userName || selectedLog.userId}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Response Details */}
            {selectedLog.response && (
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                  Response Details
                </h4>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedLog.response.statusCode !== undefined && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Status Code</p>
                        <p className="text-sm text-gray-800 mt-0.5 font-mono">
                          {selectedLog.response.statusCode}
                        </p>
                      </div>
                    )}
                    {selectedLog.response.message && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Message</p>
                        <p className="text-sm text-gray-800 mt-0.5">
                          {selectedLog.response.message}
                        </p>
                      </div>
                    )}
                    {selectedLog.response.algorithm && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Encryption</p>
                        <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs">
                          {selectedLog.response.algorithm}
                        </p>
                      </div>
                    )}
                    {selectedLog.response.respondedAt && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Response Time</p>
                        <p className="text-sm text-gray-800 mt-0.5">
                          {formatTimestamp(selectedLog.response.respondedAt)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Payload Preview */}
            {selectedLog.payload && (
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                  Payload Preview
                </h4>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedLog.payload.memberId && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Member ID</p>
                        <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs">
                          {selectedLog.payload.memberId}
                        </p>
                      </div>
                    )}
                    {(selectedLog.payload.firstName || selectedLog.payload.lastName) && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Name</p>
                        <p className="text-sm text-gray-800 mt-0.5">
                          {selectedLog.payload.firstName || ''} {selectedLog.payload.lastName || ''}
                        </p>
                      </div>
                    )}
                    {selectedLog.payload.status && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Eligibility</p>
                        <div className="mt-1">
                          <StatusBadge status={selectedLog.payload.status} size="sm" />
                        </div>
                      </div>
                    )}
                    {selectedLog.payload.coverage && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Coverage</p>
                        <p className="text-sm text-gray-800 mt-0.5">
                          {selectedLog.payload.coverage}
                        </p>
                      </div>
                    )}
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
        title="Clear Integration Logs"
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
            Are you sure you want to clear all integration logs? This action cannot be undone.
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
                This will remove {integrationStats.total} transmission log{integrationStats.total !== 1 ? 's' : ''}.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

IntegrationPanel.propTypes = {
  className: PropTypes.string,
};

IntegrationPanel.defaultProps = {
  className: '',
};

export default IntegrationPanel;