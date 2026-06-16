import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFileStore } from '../stores/fileStore';
import { useMemberStore } from '../stores/memberStore';
import { useEnrollmentStore } from '../stores/enrollmentStore';
import { useIntegrationStore } from '../stores/integrationStore';
import { useAuditStore } from '../stores/auditStore';
import { useAuth } from '../contexts/AuthContext';
import { FILE_STATUS, MEMBER_STATUS } from '../utils/constants';
import { formatTimestamp } from '../utils/helpers';
import { seedInitialData } from '../services/sampleData';
import { StatsCard } from '../components/common/StatsCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { AlertMessage } from '../components/common/AlertMessage';
import { DataTable } from '../components/common/DataTable';

/**
 * DashboardPage component.
 * Main dashboard page showing summary stats cards, recent files list,
 * processing status overview, error summary, and quick action buttons.
 * Aggregates data from all stores.
 *
 * @returns {import('react').ReactElement}
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAuth();

  const files = useFileStore((state) => state.files);
  const members = useMemberStore((state) => state.members);
  const enrollments = useEnrollmentStore((state) => state.enrollments);
  const integrationLogs = useIntegrationStore((state) => state.integrationLogs);
  const auditLogs = useAuditStore((state) => state.auditLogs);
  const errorLogs = useAuditStore((state) => state.errorLogs);

  const [alertMessage, setAlertMessage] = useState(null);
  const [seeded, setSeeded] = useState(false);

  /**
   * Seed demo data on first load if stores are empty.
   */
  useEffect(() => {
    if (!seeded) {
      const result = seedInitialData({ memberCount: 10, force: false });
      if (result.seeded) {
        setSeeded(true);
      }
    }
  }, [seeded]);

  /**
   * File statistics.
   */
  const fileStats = useMemo(() => {
    const allFiles = Array.isArray(files) ? files : [];
    return {
      total: allFiles.length,
      completed: allFiles.filter((f) => f.status === FILE_STATUS.COMPLETED).length,
      failed: allFiles.filter((f) => f.status === FILE_STATUS.FAILED).length,
      processing: allFiles.filter(
        (f) =>
          f.status === FILE_STATUS.VALIDATING ||
          f.status === FILE_STATUS.PARSING ||
          f.status === FILE_STATUS.PROCESSING
      ).length,
      uploaded: allFiles.filter((f) => f.status === FILE_STATUS.UPLOADED).length,
    };
  }, [files]);

  /**
   * Member statistics.
   */
  const memberStats = useMemo(() => {
    const allMembers = Array.isArray(members) ? members : [];
    return {
      total: allMembers.length,
      eligible: allMembers.filter(
        (m) => m.eligibilityStatus === MEMBER_STATUS.ELIGIBLE || m.status === MEMBER_STATUS.ELIGIBLE
      ).length,
      ineligible: allMembers.filter(
        (m) => m.eligibilityStatus === MEMBER_STATUS.INELIGIBLE || m.status === MEMBER_STATUS.INELIGIBLE
      ).length,
      pending: allMembers.filter(
        (m) => m.eligibilityStatus === MEMBER_STATUS.PENDING || m.status === MEMBER_STATUS.PENDING
      ).length,
    };
  }, [members]);

  /**
   * Enrollment statistics.
   */
  const enrollmentStats = useMemo(() => {
    const allEnrollments = Array.isArray(enrollments) ? enrollments : [];
    return {
      total: allEnrollments.length,
      eligible: allEnrollments.filter((e) => e.status === MEMBER_STATUS.ELIGIBLE).length,
      ineligible: allEnrollments.filter((e) => e.status === MEMBER_STATUS.INELIGIBLE).length,
      pending: allEnrollments.filter((e) => e.status === MEMBER_STATUS.PENDING).length,
    };
  }, [enrollments]);

  /**
   * Integration statistics.
   */
  const integrationStats = useMemo(() => {
    const allLogs = Array.isArray(integrationLogs) ? integrationLogs : [];
    return {
      total: allLogs.length,
      success: allLogs.filter((l) => l.status === 'Success').length,
      failed: allLogs.filter((l) => l.status === 'Failed').length,
      inProgress: allLogs.filter((l) => l.status === 'InProgress').length,
    };
  }, [integrationLogs]);

  /**
   * Error statistics.
   */
  const errorStats = useMemo(() => {
    const allErrors = Array.isArray(errorLogs) ? errorLogs : [];
    return {
      total: allErrors.length,
      validation: allErrors.filter((e) => e.errorType === 'ValidationError').length,
      parsing: allErrors.filter((e) => e.errorType === 'ParsingError').length,
      eligibility: allErrors.filter((e) => e.errorType === 'EligibilityError').length,
      integration: allErrors.filter((e) => e.errorType === 'IntegrationError').length,
    };
  }, [errorLogs]);

  /**
   * Recent files (last 5).
   */
  const recentFiles = useMemo(() => {
    const allFiles = Array.isArray(files) ? files : [];
    return allFiles.slice(0, 5);
  }, [files]);

  /**
   * Recent errors (last 5).
   */
  const recentErrors = useMemo(() => {
    const allErrors = Array.isArray(errorLogs) ? errorLogs : [];
    return allErrors.slice(0, 5);
  }, [errorLogs]);

  /**
   * Eligibility rate.
   */
  const eligibilityRate = useMemo(() => {
    if (memberStats.total === 0) return '0';
    const determined = memberStats.eligible + memberStats.ineligible;
    if (determined === 0) return '0';
    return ((memberStats.eligible / determined) * 100).toFixed(1);
  }, [memberStats]);

  /**
   * Processing status breakdown for the chart area.
   */
  const processingBreakdown = useMemo(() => {
    const total = fileStats.total;
    if (total === 0) {
      return { completedPct: 0, failedPct: 0, processingPct: 0, uploadedPct: 0 };
    }
    return {
      completedPct: Math.round((fileStats.completed / total) * 100),
      failedPct: Math.round((fileStats.failed / total) * 100),
      processingPct: Math.round((fileStats.processing / total) * 100),
      uploadedPct: Math.round((fileStats.uploaded / total) * 100),
    };
  }, [fileStats]);

  /**
   * Navigation handlers.
   */
  const handleNavigateUpload = useCallback(() => {
    navigate('/upload');
  }, [navigate]);

  const handleNavigateMembers = useCallback(() => {
    navigate('/members');
  }, [navigate]);

  const handleNavigateLogs = useCallback(() => {
    navigate('/audit');
  }, [navigate]);

  const handleNavigateFiles = useCallback(() => {
    navigate('/files');
  }, [navigate]);

  const handleNavigateEnrollments = useCallback(() => {
    navigate('/enrollments');
  }, [navigate]);

  const handleNavigateIntegration = useCallback(() => {
    navigate('/integration');
  }, [navigate]);

  const handleNavigateEligibility = useCallback(() => {
    navigate('/eligibility');
  }, [navigate]);

  /**
   * Recent files table columns.
   */
  const recentFileColumns = useMemo(
    () => [
      {
        key: 'name',
        label: 'File Name',
        sortable: false,
        render: (value) => (
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-primary-500 flex-shrink-0"
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
            <span className="text-sm font-medium text-gray-800 truncate max-w-[180px]" title={value}>
              {value || 'Unnamed File'}
            </span>
          </div>
        ),
      },
      {
        key: 'uploadSource',
        label: 'Source',
        sortable: false,
        render: (value) => {
          const sourceLabels = { web: 'Web', api: 'API', sftp: 'SFTP' };
          return (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
              {sourceLabels[value] || value || 'Unknown'}
            </span>
          );
        },
      },
      {
        key: 'status',
        label: 'Status',
        sortable: false,
        render: (value) => <StatusBadge status={value || 'Unknown'} size="sm" />,
      },
      {
        key: 'timestamp',
        label: 'Uploaded',
        sortable: false,
        render: (value) => (
          <span className="text-xs text-gray-500">{value ? formatTimestamp(value) : '—'}</span>
        ),
      },
      {
        key: 'members',
        label: 'Members',
        sortable: false,
        render: (value) => (
          <span className="text-sm text-gray-700 font-medium">
            {Array.isArray(value) ? value.length : 0}
          </span>
        ),
      },
    ],
    []
  );

  /**
   * Handle file row click.
   */
  const handleFileRowClick = useCallback(
    (file) => {
      navigate('/files');
    },
    [navigate]
  );

  const canUpload = hasPermission('upload_files');
  const canViewMembers = hasPermission('view_members');
  const canViewAudit = hasPermission('view_audit_logs');
  const canViewFiles = hasPermission('view_files');
  const canViewIntegration = hasPermission('view_system_status');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back{currentUser ? `, ${currentUser.name}` : ''}. Here&apos;s an overview of the enrollment pipeline.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {canUpload && (
            <button
              type="button"
              onClick={handleNavigateUpload}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
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
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Upload File
            </button>
          )}
          {canViewMembers && (
            <button
              type="button"
              onClick={handleNavigateMembers}
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              View Members
            </button>
          )}
          {canViewAudit && (
            <button
              type="button"
              onClick={handleNavigateLogs}
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              View Logs
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

      {/* File Stats Cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">File Processing</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatsCard
            label="Total Files"
            value={fileStats.total}
            icon="files"
            trend="neutral"
            onClick={canViewFiles ? handleNavigateFiles : undefined}
          />
          <StatsCard
            label="Completed"
            value={fileStats.completed}
            icon="eligible"
            trend={fileStats.completed > 0 ? 'up' : 'neutral'}
            trendValue={
              fileStats.total > 0
                ? `${Math.round((fileStats.completed / fileStats.total) * 100)}%`
                : ''
            }
            onClick={canViewFiles ? handleNavigateFiles : undefined}
          />
          <StatsCard
            label="Failed"
            value={fileStats.failed}
            icon="errors"
            trend={fileStats.failed > 0 ? 'down' : 'neutral'}
            trendValue={
              fileStats.total > 0
                ? `${Math.round((fileStats.failed / fileStats.total) * 100)}%`
                : ''
            }
            onClick={canViewFiles ? handleNavigateFiles : undefined}
          />
          <StatsCard
            label="Processing"
            value={fileStats.processing}
            icon="pending"
            trend="neutral"
            onClick={canViewFiles ? handleNavigateFiles : undefined}
          />
        </div>
      </div>

      {/* Member Stats Cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Member Eligibility</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatsCard
            label="Total Members"
            value={memberStats.total}
            icon="members"
            trend="neutral"
            onClick={canViewMembers ? handleNavigateMembers : undefined}
          />
          <StatsCard
            label="Eligible"
            value={memberStats.eligible}
            icon="eligible"
            trend={memberStats.eligible > 0 ? 'up' : 'neutral'}
            trendValue={
              memberStats.total > 0
                ? `${Math.round((memberStats.eligible / memberStats.total) * 100)}%`
                : ''
            }
            onClick={canViewMembers ? handleNavigateMembers : undefined}
          />
          <StatsCard
            label="Ineligible"
            value={memberStats.ineligible}
            icon="ineligible"
            trend={memberStats.ineligible > 0 ? 'down' : 'neutral'}
            trendValue={
              memberStats.total > 0
                ? `${Math.round((memberStats.ineligible / memberStats.total) * 100)}%`
                : ''
            }
            onClick={canViewMembers ? handleNavigateMembers : undefined}
          />
          <StatsCard
            label="Pending"
            value={memberStats.pending}
            icon="pending"
            trend="neutral"
            trendValue={
              memberStats.total > 0
                ? `${Math.round((memberStats.pending / memberStats.total) * 100)}%`
                : ''
            }
            onClick={canViewMembers ? handleNavigateMembers : undefined}
          />
        </div>
      </div>

      {/* Processing Status & Eligibility Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processing Status Chart Area */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Processing Status</h3>
            <span className="text-xs text-gray-500">{fileStats.total} total files</span>
          </div>

          {fileStats.total > 0 ? (
            <div className="space-y-4">
              {/* Progress bars */}
              <div className="space-y-3">
                {/* Completed */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-success-700">Completed</span>
                    <span className="text-xs text-gray-500">
                      {fileStats.completed} ({processingBreakdown.completedPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="bg-success-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${processingBreakdown.completedPct}%` }}
                    />
                  </div>
                </div>

                {/* Failed */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-error-700">Failed</span>
                    <span className="text-xs text-gray-500">
                      {fileStats.failed} ({processingBreakdown.failedPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="bg-error-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${processingBreakdown.failedPct}%` }}
                    />
                  </div>
                </div>

                {/* Processing */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-warning-700">Processing</span>
                    <span className="text-xs text-gray-500">
                      {fileStats.processing} ({processingBreakdown.processingPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="bg-warning-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${processingBreakdown.processingPct}%` }}
                    />
                  </div>
                </div>

                {/* Uploaded */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-primary-700">Uploaded</span>
                    <span className="text-xs text-gray-500">
                      {fileStats.uploaded} ({processingBreakdown.uploadedPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="bg-primary-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${processingBreakdown.uploadedPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-gray-300 mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              <p className="text-sm text-gray-500">No files uploaded yet.</p>
              {canUpload && (
                <button
                  type="button"
                  onClick={handleNavigateUpload}
                  className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium underline transition-colors"
                >
                  Upload your first file
                </button>
              )}
            </div>
          )}
        </div>

        {/* Eligibility & Enrollment Overview */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Eligibility Overview</h3>
            {memberStats.total > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                {eligibilityRate}% Rate
              </span>
            )}
          </div>

          {memberStats.total > 0 ? (
            <div className="space-y-4">
              {/* Eligibility distribution */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-success-50 rounded-lg border border-success-100">
                  <p className="text-xs text-success-600">Eligible</p>
                  <p className="text-xl font-bold text-success-700">{memberStats.eligible}</p>
                </div>
                <div className="text-center p-3 bg-error-50 rounded-lg border border-error-100">
                  <p className="text-xs text-error-600">Ineligible</p>
                  <p className="text-xl font-bold text-error-700">{memberStats.ineligible}</p>
                </div>
                <div className="text-center p-3 bg-warning-50 rounded-lg border border-warning-100">
                  <p className="text-xs text-warning-600">Pending</p>
                  <p className="text-xl font-bold text-warning-700">{memberStats.pending}</p>
                </div>
              </div>

              {/* Enrollment & Integration summary */}
              <div className="pt-3 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Enrollments</p>
                    <p className="text-lg font-semibold text-gray-800 mt-0.5">{enrollmentStats.total}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Integrations</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-lg font-semibold text-gray-800">{integrationStats.total}</p>
                      {integrationStats.failed > 0 && (
                        <span className="text-xs text-error-600 font-medium">
                          ({integrationStats.failed} failed)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick links */}
              <div className="flex items-center gap-2 pt-2">
                {canViewMembers && (
                  <button
                    type="button"
                    onClick={handleNavigateEligibility}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium underline transition-colors"
                  >
                    View Eligibility Rules
                  </button>
                )}
                {hasPermission('process_enrollment') && (
                  <button
                    type="button"
                    onClick={handleNavigateEnrollments}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium underline transition-colors"
                  >
                    View Enrollments
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-gray-300 mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <p className="text-sm text-gray-500">No members processed yet.</p>
              <p className="text-xs text-gray-400 mt-1">Upload an EDI 834 file to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Files & Error Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Files */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700">Recent Files</h3>
              {canViewFiles && fileStats.total > 0 && (
                <button
                  type="button"
                  onClick={handleNavigateFiles}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
                >
                  View All →
                </button>
              )}
            </div>
            <div className="p-0">
              <DataTable
                columns={recentFileColumns}
                data={recentFiles}
                onRowClick={canViewFiles ? handleFileRowClick : undefined}
                pageSize={5}
                rowKey="id"
                emptyMessage="No files uploaded yet. Upload an EDI 834 file to get started."
              />
            </div>
          </div>
        </div>

        {/* Error Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
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
                Error Summary
              </h3>
              {errorStats.total > 0 && (
                <span className="text-xs font-medium text-error-600 bg-error-50 px-2 py-0.5 rounded-full">
                  {errorStats.total}
                </span>
              )}
            </div>

            <div className="p-5">
              {errorStats.total > 0 ? (
                <div className="space-y-4">
                  {/* Error type breakdown */}
                  <div className="grid grid-cols-2 gap-3">
                    {errorStats.validation > 0 && (
                      <div className="text-center p-2 bg-error-50 rounded-lg border border-error-100">
                        <p className="text-[10px] text-error-600 uppercase tracking-wider">Validation</p>
                        <p className="text-lg font-semibold text-error-700">{errorStats.validation}</p>
                      </div>
                    )}
                    {errorStats.parsing > 0 && (
                      <div className="text-center p-2 bg-error-50 rounded-lg border border-error-100">
                        <p className="text-[10px] text-error-600 uppercase tracking-wider">Parsing</p>
                        <p className="text-lg font-semibold text-error-700">{errorStats.parsing}</p>
                      </div>
                    )}
                    {errorStats.eligibility > 0 && (
                      <div className="text-center p-2 bg-warning-50 rounded-lg border border-warning-100">
                        <p className="text-[10px] text-warning-600 uppercase tracking-wider">Eligibility</p>
                        <p className="text-lg font-semibold text-warning-700">{errorStats.eligibility}</p>
                      </div>
                    )}
                    {errorStats.integration > 0 && (
                      <div className="text-center p-2 bg-error-50 rounded-lg border border-error-100">
                        <p className="text-[10px] text-error-600 uppercase tracking-wider">Integration</p>
                        <p className="text-lg font-semibold text-error-700">{errorStats.integration}</p>
                      </div>
                    )}
                  </div>

                  {/* Recent errors list */}
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
                      Recent Errors
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {recentErrors.map((error) => (
                        <div
                          key={error.logId}
                          className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 text-error-500 flex-shrink-0 mt-0.5"
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
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-800 truncate">
                              {error.errorType || 'Error'}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {error.message || 'Unknown error'}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {error.timestamp ? formatTimestamp(error.timestamp) : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* View all link */}
                  {canViewAudit && (
                    <button
                      type="button"
                      onClick={handleNavigateLogs}
                      className="w-full text-center text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors py-2 border-t border-gray-100"
                    >
                      View All Logs →
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8 text-success-300 mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-gray-500">No errors recorded.</p>
                  <p className="text-xs text-gray-400 mt-0.5">System is running smoothly.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Summary Row */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Pipeline Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <div
            className={`text-center p-3 rounded-lg border transition-colors ${canViewFiles ? 'cursor-pointer hover:border-primary-200 hover:bg-primary-50' : ''} bg-gray-50 border-gray-100`}
            onClick={canViewFiles ? handleNavigateFiles : undefined}
            role={canViewFiles ? 'button' : undefined}
            tabIndex={canViewFiles ? 0 : undefined}
            onKeyDown={
              canViewFiles
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigateFiles();
                    }
                  }
                : undefined
            }
          >
            <p className="text-xs text-gray-500 font-medium">Files</p>
            <p className="text-xl font-bold text-gray-800">{fileStats.total}</p>
          </div>
          <div
            className={`text-center p-3 rounded-lg border transition-colors ${canViewMembers ? 'cursor-pointer hover:border-primary-200 hover:bg-primary-50' : ''} bg-gray-50 border-gray-100`}
            onClick={canViewMembers ? handleNavigateMembers : undefined}
            role={canViewMembers ? 'button' : undefined}
            tabIndex={canViewMembers ? 0 : undefined}
            onKeyDown={
              canViewMembers
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigateMembers();
                    }
                  }
                : undefined
            }
          >
            <p className="text-xs text-gray-500 font-medium">Members</p>
            <p className="text-xl font-bold text-gray-800">{memberStats.total}</p>
          </div>
          <div
            className={`text-center p-3 rounded-lg border transition-colors ${hasPermission('process_enrollment') ? 'cursor-pointer hover:border-primary-200 hover:bg-primary-50' : ''} bg-gray-50 border-gray-100`}
            onClick={hasPermission('process_enrollment') ? handleNavigateEnrollments : undefined}
            role={hasPermission('process_enrollment') ? 'button' : undefined}
            tabIndex={hasPermission('process_enrollment') ? 0 : undefined}
            onKeyDown={
              hasPermission('process_enrollment')
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigateEnrollments();
                    }
                  }
                : undefined
            }
          >
            <p className="text-xs text-gray-500 font-medium">Enrollments</p>
            <p className="text-xl font-bold text-gray-800">{enrollmentStats.total}</p>
          </div>
          <div
            className={`text-center p-3 rounded-lg border transition-colors ${canViewIntegration ? 'cursor-pointer hover:border-primary-200 hover:bg-primary-50' : ''} bg-gray-50 border-gray-100`}
            onClick={canViewIntegration ? handleNavigateIntegration : undefined}
            role={canViewIntegration ? 'button' : undefined}
            tabIndex={canViewIntegration ? 0 : undefined}
            onKeyDown={
              canViewIntegration
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigateIntegration();
                    }
                  }
                : undefined
            }
          >
            <p className="text-xs text-gray-500 font-medium">Integrations</p>
            <p className="text-xl font-bold text-gray-800">{integrationStats.total}</p>
          </div>
          <div
            className={`text-center p-3 rounded-lg border transition-colors ${canViewAudit ? 'cursor-pointer hover:border-primary-200 hover:bg-primary-50' : ''} bg-gray-50 border-gray-100`}
            onClick={canViewAudit ? handleNavigateLogs : undefined}
            role={canViewAudit ? 'button' : undefined}
            tabIndex={canViewAudit ? 0 : undefined}
            onKeyDown={
              canViewAudit
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigateLogs();
                    }
                  }
                : undefined
            }
          >
            <p className="text-xs text-gray-500 font-medium">Audit Logs</p>
            <p className="text-xl font-bold text-gray-800">
              {Array.isArray(auditLogs) ? auditLogs.length : 0}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg border bg-gray-50 border-gray-100">
            <p className="text-xs text-gray-500 font-medium">Errors</p>
            <p className={`text-xl font-bold ${errorStats.total > 0 ? 'text-error-600' : 'text-gray-800'}`}>
              {errorStats.total}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;