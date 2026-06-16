import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFileStore } from '../stores/fileStore';
import { useMemberStore } from '../stores/memberStore';
import { useEnrollmentStore } from '../stores/enrollmentStore';
import { useIntegrationStore } from '../stores/integrationStore';
import { useEligibilityStore } from '../stores/eligibilityStore';
import { useAuditStore } from '../stores/auditStore';
import { clearAllState, getStorageUsage } from '../utils/localStorage';
import { seedInitialData } from '../services/sampleData';
import { clearPipelineData } from '../services/processingPipeline';
import { StatsCard } from '../components/common/StatsCard';
import { AlertMessage } from '../components/common/AlertMessage';
import { Modal } from '../components/common/Modal';

/**
 * SettingsPage component.
 * Settings page allowing users to: clear all data (localStorage reset),
 * export/import data, view storage usage, configure mock processing delay,
 * and seed sample data for demo. Includes danger zone for data reset with
 * confirmation modal.
 *
 * @returns {import('react').ReactElement}
 */
export function SettingsPage() {
  const { currentUser, hasPermission } = useAuth();
  const logAction = useAuditStore((state) => state.logAction);
  const exportLogs = useAuditStore((state) => state.exportLogs);
  const clearLogs = useAuditStore((state) => state.clearLogs);

  const files = useFileStore((state) => state.files);
  const members = useMemberStore((state) => state.members);
  const enrollments = useEnrollmentStore((state) => state.enrollments);
  const integrationLogs = useIntegrationStore((state) => state.integrationLogs);
  const auditLogs = useAuditStore((state) => state.auditLogs);
  const errorLogs = useAuditStore((state) => state.errorLogs);
  const rules = useEligibilityStore((state) => state.rules);

  const [alertMessage, setAlertMessage] = useState(null);
  const [clearAllModalOpen, setClearAllModalOpen] = useState(false);
  const [clearPipelineModalOpen, setClearPipelineModalOpen] = useState(false);
  const [clearLogsModalOpen, setClearLogsModalOpen] = useState(false);
  const [seedModalOpen, setSeedModalOpen] = useState(false);
  const [seedMemberCount, setSeedMemberCount] = useState(10);
  const [isSeeding, setIsSeeding] = useState(false);
  const [importFileInputKey, setImportFileInputKey] = useState(0);

  const canManageSettings = hasPermission('manage_settings');

  /**
   * Storage usage statistics.
   */
  const storageUsage = useMemo(() => {
    return getStorageUsage();
  }, [files, members, enrollments, integrationLogs, auditLogs, errorLogs, rules]);

  /**
   * Data statistics summary.
   */
  const dataStats = useMemo(() => {
    return {
      files: Array.isArray(files) ? files.length : 0,
      members: Array.isArray(members) ? members.length : 0,
      enrollments: Array.isArray(enrollments) ? enrollments.length : 0,
      integrationLogs: Array.isArray(integrationLogs) ? integrationLogs.length : 0,
      auditLogs: Array.isArray(auditLogs) ? auditLogs.length : 0,
      errorLogs: Array.isArray(errorLogs) ? errorLogs.length : 0,
      rules: Array.isArray(rules) ? rules.length : 0,
    };
  }, [files, members, enrollments, integrationLogs, auditLogs, errorLogs, rules]);

  /**
   * Formats bytes to a human-readable string.
   * @param {number} bytes - The byte count.
   * @returns {string} The formatted string.
   */
  const formatBytes = useCallback((bytes) => {
    if (typeof bytes !== 'number' || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }, []);

  /**
   * Storage usage percentage.
   */
  const storagePercentage = useMemo(() => {
    if (storageUsage.quotaEstimate <= 0) return 0;
    return Math.min(100, (storageUsage.totalBytes / storageUsage.quotaEstimate) * 100);
  }, [storageUsage]);

  /**
   * Handles opening the clear all data confirmation modal.
   */
  const handleClearAllClick = useCallback(() => {
    setClearAllModalOpen(true);
  }, []);

  /**
   * Confirms and executes clearing all application data.
   */
  const handleConfirmClearAll = useCallback(() => {
    const userId = currentUser ? currentUser.id : '';

    clearAllState();

    // Clear all stores
    useFileStore.getState().clearFiles();
    useMemberStore.getState().clearMembers();
    useEnrollmentStore.getState().clearEnrollments();
    useIntegrationStore.getState().clearIntegrationLogs();
    useEligibilityStore.getState().resetToDefaults();
    clearLogs();

    setAlertMessage({
      type: 'success',
      message: 'All application data has been cleared. Stores and localStorage have been reset.',
      title: 'Data Cleared',
    });
    setClearAllModalOpen(false);
  }, [currentUser, clearLogs]);

  /**
   * Cancels clearing all data.
   */
  const handleCancelClearAll = useCallback(() => {
    setClearAllModalOpen(false);
  }, []);

  /**
   * Handles opening the clear pipeline data confirmation modal.
   */
  const handleClearPipelineClick = useCallback(() => {
    setClearPipelineModalOpen(true);
  }, []);

  /**
   * Confirms and executes clearing pipeline data (files, members, enrollments, integrations).
   */
  const handleConfirmClearPipeline = useCallback(() => {
    const userId = currentUser ? currentUser.id : '';
    clearPipelineData(userId);

    setAlertMessage({
      type: 'success',
      message: 'Pipeline data (files, members, enrollments, integration logs) has been cleared.',
      title: 'Pipeline Data Cleared',
    });
    setClearPipelineModalOpen(false);
  }, [currentUser]);

  /**
   * Cancels clearing pipeline data.
   */
  const handleCancelClearPipeline = useCallback(() => {
    setClearPipelineModalOpen(false);
  }, []);

  /**
   * Handles opening the clear logs confirmation modal.
   */
  const handleClearLogsClick = useCallback(() => {
    setClearLogsModalOpen(true);
  }, []);

  /**
   * Confirms and executes clearing audit and error logs.
   */
  const handleConfirmClearLogs = useCallback(() => {
    clearLogs();

    setAlertMessage({
      type: 'success',
      message: 'All audit and error logs have been cleared.',
      title: 'Logs Cleared',
    });
    setClearLogsModalOpen(false);
  }, [clearLogs]);

  /**
   * Cancels clearing logs.
   */
  const handleCancelClearLogs = useCallback(() => {
    setClearLogsModalOpen(false);
  }, []);

  /**
   * Handles opening the seed data modal.
   */
  const handleSeedClick = useCallback(() => {
    setSeedModalOpen(true);
  }, []);

  /**
   * Confirms and executes seeding sample data.
   */
  const handleConfirmSeed = useCallback(() => {
    setIsSeeding(true);

    try {
      const result = seedInitialData({
        memberCount: seedMemberCount,
        force: true,
      });

      if (result.seeded) {
        setAlertMessage({
          type: 'success',
          message: `Demo data seeded successfully: ${result.memberCount} member(s), ${result.ruleCount} rule(s), ${result.enrollmentCount} enrollment(s).`,
          title: 'Demo Data Seeded',
        });
      } else {
        setAlertMessage({
          type: 'warning',
          message: 'Data was not seeded. Stores may already contain data.',
          title: 'Seeding Skipped',
        });
      }
    } catch (_err) {
      setAlertMessage({
        type: 'error',
        message: 'An error occurred while seeding demo data.',
        title: 'Seeding Failed',
      });
    } finally {
      setIsSeeding(false);
      setSeedModalOpen(false);
    }
  }, [seedMemberCount]);

  /**
   * Cancels seeding data.
   */
  const handleCancelSeed = useCallback(() => {
    setSeedModalOpen(false);
  }, []);

  /**
   * Handles exporting all application data as JSON.
   */
  const handleExportAllData = useCallback(() => {
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedBy: currentUser ? currentUser.name : 'unknown',
        version: '1.0.0',
        data: {
          files: Array.isArray(files) ? files : [],
          members: Array.isArray(members) ? members : [],
          enrollments: Array.isArray(enrollments) ? enrollments : [],
          integrationLogs: Array.isArray(integrationLogs) ? integrationLogs : [],
          auditLogs: Array.isArray(auditLogs) ? auditLogs : [],
          errorLogs: Array.isArray(errorLogs) ? errorLogs : [],
          rules: Array.isArray(rules) ? rules : [],
        },
      };

      const jsonContent = JSON.stringify(exportData, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `medicaid-portal-export-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const userId = currentUser ? currentUser.id : '';
      logAction('Data Exported', '', userId, {
        format: 'JSON',
        fileCount: dataStats.files,
        memberCount: dataStats.members,
        enrollmentCount: dataStats.enrollments,
      });

      setAlertMessage({
        type: 'success',
        message: 'All application data exported as JSON successfully.',
        title: 'Export Complete',
      });
    } catch (_err) {
      setAlertMessage({
        type: 'error',
        message: 'Failed to export application data.',
        title: 'Export Failed',
      });
    }
  }, [files, members, enrollments, integrationLogs, auditLogs, errorLogs, rules, currentUser, logAction, dataStats]);

  /**
   * Handles exporting audit logs as JSON.
   */
  const handleExportAuditLogs = useCallback(() => {
    try {
      const jsonContent = exportLogs();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setAlertMessage({
        type: 'success',
        message: 'Audit logs exported as JSON successfully.',
        title: 'Export Complete',
      });
    } catch (_err) {
      setAlertMessage({
        type: 'error',
        message: 'Failed to export audit logs.',
        title: 'Export Failed',
      });
    }
  }, [exportLogs]);

  /**
   * Handles importing data from a JSON file.
   * @param {React.ChangeEvent<HTMLInputElement>} e - The file input change event.
   */
  const handleImportData = useCallback(
    (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target.result;
          const importedData = JSON.parse(content);

          if (!importedData || typeof importedData !== 'object' || !importedData.data) {
            setAlertMessage({
              type: 'error',
              message: 'Invalid import file format. Expected a Medicaid Portal export file.',
              title: 'Import Failed',
            });
            return;
          }

          const data = importedData.data;

          // Import members
          if (Array.isArray(data.members)) {
            const memberStore = useMemberStore.getState();
            for (const member of data.members) {
              memberStore.addMember(member);
            }
          }

          // Import eligibility rules
          if (Array.isArray(data.rules) && data.rules.length > 0) {
            useEligibilityStore.getState().setRules(data.rules);
          }

          // Import enrollments
          if (Array.isArray(data.enrollments)) {
            const enrollmentStore = useEnrollmentStore.getState();
            for (const enrollment of data.enrollments) {
              enrollmentStore.createEnrollment(enrollment);
            }
          }

          // Import files
          if (Array.isArray(data.files)) {
            const fileStore = useFileStore.getState();
            for (const fileRecord of data.files) {
              fileStore.addFile(fileRecord);
            }
          }

          const userId = currentUser ? currentUser.id : '';
          logAction('Data Imported', '', userId, {
            source: file.name,
            memberCount: Array.isArray(data.members) ? data.members.length : 0,
            fileCount: Array.isArray(data.files) ? data.files.length : 0,
            enrollmentCount: Array.isArray(data.enrollments) ? data.enrollments.length : 0,
            ruleCount: Array.isArray(data.rules) ? data.rules.length : 0,
          });

          setAlertMessage({
            type: 'success',
            message: `Data imported successfully from "${file.name}".`,
            title: 'Import Complete',
          });
        } catch (_err) {
          setAlertMessage({
            type: 'error',
            message: 'Failed to parse import file. Ensure it is a valid JSON export file.',
            title: 'Import Failed',
          });
        }
      };

      reader.onerror = () => {
        setAlertMessage({
          type: 'error',
          message: 'Failed to read the import file.',
          title: 'Import Failed',
        });
      };

      reader.readAsText(file);

      // Reset file input
      setImportFileInputKey((prev) => prev + 1);
    },
    [currentUser, logAction]
  );

  /**
   * Handles resetting eligibility rules to defaults.
   */
  const handleResetRules = useCallback(() => {
    useEligibilityStore.getState().resetToDefaults();

    const userId = currentUser ? currentUser.id : '';
    logAction('Eligibility Rules Reset', '', userId, {
      resetAt: new Date().toISOString(),
    });

    setAlertMessage({
      type: 'success',
      message: 'Eligibility rules have been reset to defaults.',
      title: 'Rules Reset',
    });
  }, [currentUser, logAction]);

  /**
   * Handles resetting integration configuration to defaults.
   */
  const handleResetIntegrationConfig = useCallback(() => {
    useIntegrationStore.getState().resetIntegrationConfig();

    const userId = currentUser ? currentUser.id : '';
    logAction('Integration Config Reset', '', userId, {
      resetAt: new Date().toISOString(),
    });

    setAlertMessage({
      type: 'success',
      message: 'Integration configuration has been reset to defaults.',
      title: 'Config Reset',
    });
  }, [currentUser, logAction]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage application data, storage, and configuration settings.
          </p>
        </div>

        {currentUser && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              Logged in as <span className="font-medium text-gray-700">{currentUser.name}</span>
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
              {currentUser.role}
            </span>
          </div>
        )}
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

      {/* Data Overview Stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Data Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatsCard
            label="Files"
            value={dataStats.files}
            icon="files"
            trend="neutral"
          />
          <StatsCard
            label="Members"
            value={dataStats.members}
            icon="members"
            trend="neutral"
          />
          <StatsCard
            label="Enrollments"
            value={dataStats.enrollments}
            icon="enrollments"
            trend="neutral"
          />
          <StatsCard
            label="Rules"
            value={dataStats.rules}
            icon="integrations"
            trend="neutral"
          />
          <StatsCard
            label="Integrations"
            value={dataStats.integrationLogs}
            icon="integrations"
            trend="neutral"
          />
          <StatsCard
            label="Audit Logs"
            value={dataStats.auditLogs}
            icon="pending"
            trend="neutral"
          />
          <StatsCard
            label="Errors"
            value={dataStats.errorLogs}
            icon="errors"
            trend={dataStats.errorLogs > 0 ? 'down' : 'neutral'}
          />
        </div>
      </div>

      {/* Storage Usage */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
            />
          </svg>
          Storage Usage
        </h3>

        <div className="space-y-4">
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700">
                {formatBytes(storageUsage.totalBytes)} used
              </span>
              <span className="text-xs text-gray-500">
                {formatBytes(storageUsage.quotaEstimate)} estimated quota
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  storagePercentage > 80
                    ? 'bg-error-500'
                    : storagePercentage > 50
                      ? 'bg-warning-500'
                      : 'bg-primary-500'
                }`}
                style={{ width: `${Math.max(1, storagePercentage)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {storagePercentage.toFixed(2)}% of estimated quota used • {storageUsage.keyCount} key{storageUsage.keyCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Storage breakdown */}
          {storageUsage.keys.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
                Storage Breakdown
              </p>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {storageUsage.keys
                  .sort((a, b) => b.bytes - a.bytes)
                  .map((entry) => (
                    <div
                      key={entry.key}
                      className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
                    >
                      <span className="text-xs text-gray-700 font-mono truncate max-w-[250px]" title={entry.key}>
                        {entry.key}
                      </span>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-3">
                        {formatBytes(entry.bytes)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Data Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export & Import */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
            Export & Import
          </h3>

          <div className="space-y-4">
            {/* Export All Data */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Export All Data</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Download all application data as a JSON file including files, members, enrollments, rules, and logs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportAllData}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
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
                  Export JSON
                </button>
              </div>
            </div>

            {/* Export Audit Logs */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Export Audit Logs</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Download audit and error logs as a JSON file for compliance and review.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportAuditLogs}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
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
                  Export Logs
                </button>
              </div>
            </div>

            {/* Import Data */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Import Data</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Import application data from a previously exported JSON file. Existing data will be merged.
                  </p>
                </div>
                <label className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors cursor-pointer">
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Import JSON
                  <input
                    key={importFileInputKey}
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    className="hidden"
                    aria-label="Import data file"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Demo & Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
            </svg>
            Demo & Configuration
          </h3>

          <div className="space-y-4">
            {/* Seed Demo Data */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Seed Demo Data</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Generate sample members, eligibility rules, and enrollment records for demonstration purposes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSeedClick}
                  disabled={isSeeding}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSeeding ? (
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
                      Seeding...
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
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Seed Data
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Reset Eligibility Rules */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Reset Eligibility Rules</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Restore eligibility rules to the default system configuration.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetRules}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Reset Rules
                </button>
              </div>
            </div>

            {/* Reset Integration Config */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Reset Integration Config</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Restore integration endpoint configuration and retry policy to defaults.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetIntegrationConfig}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Reset Config
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Application Info */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-1.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Application Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Application</p>
            <p className="text-sm text-gray-800 mt-0.5">
              {import.meta.env.VITE_APP_TITLE || 'Medicaid Enrollment Portal'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Version</p>
            <p className="text-sm text-gray-800 mt-0.5">1.0.0</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Storage Prefix</p>
            <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs">
              {import.meta.env.VITE_STORAGE_PREFIX || 'medicaid_'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Max File Size</p>
            <p className="text-sm text-gray-800 mt-0.5">
              {import.meta.env.VITE_MAX_FILE_SIZE_MB || '10'} MB
            </p>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white border-2 border-error-200 rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold text-error-700 mb-1 flex items-center gap-1.5">
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          Danger Zone
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          These actions are destructive and cannot be undone. Proceed with caution.
        </p>

        <div className="space-y-3">
          {/* Clear Pipeline Data */}
          <div className="flex items-center justify-between p-4 bg-error-50 rounded-lg border border-error-100">
            <div>
              <p className="text-sm font-medium text-gray-800">Clear Pipeline Data</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Remove all files, members, enrollments, and integration logs. Audit logs and rules are preserved.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearPipelineClick}
              disabled={!canManageSettings}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-error-700 bg-white border border-error-300 rounded-lg hover:bg-error-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-error-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              Clear Pipeline
            </button>
          </div>

          {/* Clear Audit Logs */}
          <div className="flex items-center justify-between p-4 bg-error-50 rounded-lg border border-error-100">
            <div>
              <p className="text-sm font-medium text-gray-800">Clear Audit & Error Logs</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Remove all audit trail entries and error logs from the system.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearLogsClick}
              disabled={!canManageSettings}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-error-700 bg-white border border-error-300 rounded-lg hover:bg-error-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-error-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          </div>

          {/* Clear All Data */}
          <div className="flex items-center justify-between p-4 bg-error-50 rounded-lg border border-error-200">
            <div>
              <p className="text-sm font-medium text-error-800">Clear All Application Data</p>
              <p className="text-xs text-error-600 mt-0.5">
                Permanently delete ALL data including files, members, enrollments, rules, logs, and localStorage. This cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearAllClick}
              disabled={!canManageSettings}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-error-500 rounded-lg hover:bg-error-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-error-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              Clear Everything
            </button>
          </div>

          {!canManageSettings && (
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
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <p className="text-xs text-warning-700">
                  Destructive actions require the <span className="font-medium">manage_settings</span> permission.
                  Your current role ({currentUser ? currentUser.role : 'Unknown'}) does not have this permission.
                  Switch to IT or Admin role to access these features.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clear All Data Confirmation Modal */}
      <Modal
        isOpen={clearAllModalOpen}
        onClose={handleCancelClearAll}
        title="Clear All Application Data"
        size="sm"
        actions={[
          {
            label: 'Cancel',
            onClick: handleCancelClearAll,
            variant: 'secondary',
          },
          {
            label: 'Clear Everything',
            onClick: handleConfirmClearAll,
            variant: 'danger',
          },
        ]}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Are you sure you want to clear <span className="font-semibold">ALL</span> application data?
            This will permanently delete:
          </p>
          <ul className="space-y-1 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span className="text-error-500">•</span>
              {dataStats.files} file{dataStats.files !== 1 ? 's' : ''}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-error-500">•</span>
              {dataStats.members} member{dataStats.members !== 1 ? 's' : ''}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-error-500">•</span>
              {dataStats.enrollments} enrollment{dataStats.enrollments !== 1 ? 's' : ''}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-error-500">•</span>
              {dataStats.rules} eligibility rule{dataStats.rules !== 1 ? 's' : ''}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-error-500">•</span>
              {dataStats.auditLogs} audit log{dataStats.auditLogs !== 1 ? 's' : ''} and {dataStats.errorLogs} error log{dataStats.errorLogs !== 1 ? 's' : ''}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-error-500">•</span>
              {dataStats.integrationLogs} integration log{dataStats.integrationLogs !== 1 ? 's' : ''}
            </li>
          </ul>
          <div className="p-3 bg-error-50 border border-error-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-error-500 flex-shrink-0"
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
              <p className="text-xs text-error-700 font-medium">
                This action cannot be undone. All localStorage data will be permanently removed.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Clear Pipeline Data Confirmation Modal */}
      <Modal
        isOpen={clearPipelineModalOpen}
        onClose={handleCancelClearPipeline}
        title="Clear Pipeline Data"
        size="sm"
        actions={[
          {
            label: 'Cancel',
            onClick: handleCancelClearPipeline,
            variant: 'secondary',
          },
          {
            label: 'Clear Pipeline Data',
            onClick: handleConfirmClearPipeline,
            variant: 'danger',
          },
        ]}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Are you sure you want to clear all pipeline data? This will remove:
          </p>
          <ul className="space-y-1 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span className="text-error-500">•</span>
              {dataStats.files} file{dataStats.files !== 1 ? 's' : ''}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-error-500">•</span>
              {dataStats.members} member{dataStats.members !== 1 ? 's' : ''}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-error-500">•</span>
              {dataStats.enrollments} enrollment{dataStats.enrollments !== 1 ? 's' : ''}
            </li>
            <li className="flex items-center gap-2">
              <span className="text-error-500">•</span>
              {dataStats.integrationLogs} integration log{dataStats.integrationLogs !== 1 ? 's' : ''}
            </li>
          </ul>
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
                Audit logs and eligibility rules will be preserved.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Clear Logs Confirmation Modal */}
      <Modal
        isOpen={clearLogsModalOpen}
        onClose={handleCancelClearLogs}
        title="Clear Audit & Error Logs"
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
                This will remove {dataStats.auditLogs} audit log{dataStats.auditLogs !== 1 ? 's' : ''} and{' '}
                {dataStats.errorLogs} error log{dataStats.errorLogs !== 1 ? 's' : ''}.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Seed Data Modal */}
      <Modal
        isOpen={seedModalOpen}
        onClose={handleCancelSeed}
        title="Seed Demo Data"
        size="sm"
        actions={[
          {
            label: 'Cancel',
            onClick: handleCancelSeed,
            variant: 'secondary',
          },
          {
            label: isSeeding ? 'Seeding...' : 'Seed Data',
            onClick: handleConfirmSeed,
            variant: 'primary',
            disabled: isSeeding,
          },
        ]}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Generate sample data for demonstration purposes. This will create members, eligibility rules, and enrollment records.
          </p>

          {/* Member Count Input */}
          <div>
            <label
              htmlFor="seed-member-count"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Number of Members
            </label>
            <input
              id="seed-member-count"
              type="number"
              min={1}
              max={100}
              value={seedMemberCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= 100) {
                  setSeedMemberCount(val);
                }
              }}
              disabled={isSeeding}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter a number between 1 and 100. Default is 10.
            </p>
          </div>

          <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-xs text-primary-700">
                Existing data will be preserved. New members will be added alongside existing records.
                Use &quot;Force&quot; mode to replace existing data.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default SettingsPage;