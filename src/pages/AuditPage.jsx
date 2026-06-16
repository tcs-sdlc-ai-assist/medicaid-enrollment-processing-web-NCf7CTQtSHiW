import { useState, useCallback, useMemo } from 'react';
import { useAuditStore } from '../stores/auditStore';
import { useAuth } from '../contexts/AuthContext';
import { AuditLogViewer } from '../components/audit/AuditLogViewer';
import { ErrorLogViewer } from '../components/audit/ErrorLogViewer';
import { StatsCard } from '../components/common/StatsCard';

/**
 * Tab definitions for the audit page.
 * @type {Array<{ key: string, label: string, icon: string }>}
 */
const AUDIT_TABS = [
  {
    key: 'audit',
    label: 'Audit Trail',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    key: 'errors',
    label: 'Error Logs',
    icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

/**
 * AuditPage component.
 * Audit page with tabs for Audit Trail and Error Logs.
 * Combines AuditLogViewer and ErrorLogViewer components.
 * Shows log summary stats at top.
 *
 * @returns {import('react').ReactElement}
 */
export function AuditPage() {
  const { currentUser, hasPermission } = useAuth();
  const auditLogs = useAuditStore((state) => state.auditLogs);
  const errorLogs = useAuditStore((state) => state.errorLogs);
  const logAction = useAuditStore((state) => state.logAction);

  const [activeTab, setActiveTab] = useState('audit');

  /**
   * Audit log statistics summary.
   */
  const auditStats = useMemo(() => {
    const allAudit = Array.isArray(auditLogs) ? auditLogs : [];
    const allErrors = Array.isArray(errorLogs) ? errorLogs : [];

    const fileActions = allAudit.filter((log) => (log.action || '').includes('File')).length;
    const memberActions = allAudit.filter(
      (log) => (log.action || '').includes('Member') || (log.action || '').includes('Eligibility')
    ).length;
    const integrationActions = allAudit.filter(
      (log) =>
        (log.action || '').includes('Transmit') ||
        (log.action || '').includes('Integration') ||
        (log.action || '').includes('Transmission')
    ).length;
    const errorActions = allAudit.filter((log) => (log.action || '').startsWith('Error:')).length;

    const validationErrors = allErrors.filter((e) => e.errorType === 'ValidationError').length;
    const parsingErrors = allErrors.filter((e) => e.errorType === 'ParsingError').length;
    const eligibilityErrors = allErrors.filter((e) => e.errorType === 'EligibilityError').length;
    const integrationErrors = allErrors.filter((e) => e.errorType === 'IntegrationError').length;

    return {
      totalAudit: allAudit.length,
      totalErrors: allErrors.length,
      fileActions,
      memberActions,
      integrationActions,
      errorActions,
      validationErrors,
      parsingErrors,
      eligibilityErrors,
      integrationErrors,
    };
  }, [auditLogs, errorLogs]);

  /**
   * Handles tab change.
   * @param {string} tabKey - The tab key to switch to.
   */
  const handleTabChange = useCallback(
    (tabKey) => {
      setActiveTab(tabKey);

      const userId = currentUser ? currentUser.id : '';
      logAction('Tab Viewed', '', userId, {
        tab: tabKey,
        page: 'AuditPage',
      });
    },
    [currentUser, logAction]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-1">
            View audit trail entries, error logs, and system activity history.
          </p>
        </div>

        {/* Quick stat badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-primary-50 text-primary-700 rounded-full">
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
            {auditStats.totalAudit} audit log{auditStats.totalAudit !== 1 ? 's' : ''}
          </span>
          {auditStats.totalErrors > 0 && (
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
              {auditStats.totalErrors} error{auditStats.totalErrors !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatsCard
          label="Total Audit Logs"
          value={auditStats.totalAudit}
          icon="pending"
          trend="neutral"
        />
        <StatsCard
          label="File Actions"
          value={auditStats.fileActions}
          icon="files"
          trend={auditStats.fileActions > 0 ? 'up' : 'neutral'}
        />
        <StatsCard
          label="Member Actions"
          value={auditStats.memberActions}
          icon="members"
          trend={auditStats.memberActions > 0 ? 'up' : 'neutral'}
        />
        <StatsCard
          label="Integration Actions"
          value={auditStats.integrationActions}
          icon="integrations"
          trend={auditStats.integrationActions > 0 ? 'up' : 'neutral'}
        />
        <StatsCard
          label="Total Errors"
          value={auditStats.totalErrors}
          icon="errors"
          trend={auditStats.totalErrors > 0 ? 'down' : 'neutral'}
          trendValue={
            auditStats.totalErrors > 0 && auditStats.totalAudit > 0
              ? `${((auditStats.totalErrors / auditStats.totalAudit) * 100).toFixed(0)}% of logs`
              : ''
          }
        />
      </div>

      {/* Error Type Breakdown (only if errors exist) */}
      {auditStats.totalErrors > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-error-500"
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
            Error Breakdown
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-error-50 rounded-lg border border-error-100">
              <p className="text-xs text-error-600">Validation</p>
              <p className="text-lg font-semibold text-error-700">{auditStats.validationErrors}</p>
            </div>
            <div className="text-center p-3 bg-error-50 rounded-lg border border-error-100">
              <p className="text-xs text-error-600">Parsing</p>
              <p className="text-lg font-semibold text-error-700">{auditStats.parsingErrors}</p>
            </div>
            <div className="text-center p-3 bg-warning-50 rounded-lg border border-warning-100">
              <p className="text-xs text-warning-600">Eligibility</p>
              <p className="text-lg font-semibold text-warning-700">{auditStats.eligibilityErrors}</p>
            </div>
            <div className="text-center p-3 bg-error-50 rounded-lg border border-error-100">
              <p className="text-xs text-error-600">Integration</p>
              <p className="text-lg font-semibold text-error-700">{auditStats.integrationErrors}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          {AUDIT_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 sm:flex-none px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? tab.key === 'errors'
                    ? 'border-error-500 text-error-700 bg-error-50'
                    : 'border-primary-500 text-primary-700 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              aria-selected={activeTab === tab.key}
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
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                {tab.label}
                {tab.key === 'audit' && auditStats.totalAudit > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-gray-200 text-gray-600 rounded-full">
                    {auditStats.totalAudit}
                  </span>
                )}
                {tab.key === 'errors' && auditStats.totalErrors > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-error-100 text-error-700 rounded-full">
                    {auditStats.totalErrors}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {/* Audit Trail Tab */}
          {activeTab === 'audit' && (
            <AuditLogViewer />
          )}

          {/* Error Logs Tab */}
          {activeTab === 'errors' && (
            <ErrorLogViewer />
          )}
        </div>
      </div>
    </div>
  );
}

export default AuditPage;