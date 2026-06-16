import { useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useFileStore } from '../../stores/fileStore';
import { useAuditStore } from '../../stores/auditStore';
import { useAuth } from '../../contexts/AuthContext';
import { FILE_STATUS } from '../../utils/constants';
import { formatTimestamp } from '../../utils/helpers';
import { retryFileProcessing } from '../../services/processingPipeline';
import { StatusBadge } from '../common/StatusBadge';
import { AlertMessage } from '../common/AlertMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Modal } from '../common/Modal';

/**
 * Processing pipeline stage definitions with display labels and order.
 * @type {Array<{ key: string, label: string, description: string }>}
 */
const PIPELINE_STAGE_DEFINITIONS = [
  { key: 'Upload', label: 'Upload', description: 'File received and stored' },
  { key: 'Validate', label: 'Validate', description: 'EDI 834 format validation' },
  { key: 'Parse', label: 'Parse', description: 'Extract member data from EDI segments' },
  { key: 'Eligibility', label: 'Eligibility', description: 'Determine member eligibility' },
  { key: 'Categorize', label: 'Categorize', description: 'Categorize and store members' },
  { key: 'Enrollment', label: 'Enrollment', description: 'Create enrollment records' },
  { key: 'Integration', label: 'Integration', description: 'Transmit to downstream systems' },
  { key: 'Complete', label: 'Complete', description: 'Processing pipeline finished' },
];

/**
 * Maps a file status to the expected completed pipeline stages.
 * @param {string} status - The file status.
 * @returns {Array<string>} The list of completed stage keys.
 */
function getCompletedStagesForStatus(status) {
  switch (status) {
    case FILE_STATUS.UPLOADED:
      return ['Upload'];
    case FILE_STATUS.VALIDATING:
      return ['Upload'];
    case FILE_STATUS.PARSING:
      return ['Upload', 'Validate'];
    case FILE_STATUS.PROCESSING:
      return ['Upload', 'Validate', 'Parse'];
    case FILE_STATUS.COMPLETED:
      return ['Upload', 'Validate', 'Parse', 'Eligibility', 'Categorize', 'Enrollment', 'Integration', 'Complete'];
    case FILE_STATUS.FAILED:
      return ['Upload'];
    default:
      return [];
  }
}

/**
 * Returns the currently active stage key based on file status.
 * @param {string} status - The file status.
 * @returns {string|null} The active stage key, or null if none.
 */
function getActiveStageForStatus(status) {
  switch (status) {
    case FILE_STATUS.VALIDATING:
      return 'Validate';
    case FILE_STATUS.PARSING:
      return 'Parse';
    case FILE_STATUS.PROCESSING:
      return 'Eligibility';
    default:
      return null;
  }
}

/**
 * Checks if a file status indicates the file is currently being processed.
 * @param {string} status - The file status.
 * @returns {boolean} True if the file is in a processing state.
 */
function isProcessingStatus(status) {
  return (
    status === FILE_STATUS.VALIDATING ||
    status === FILE_STATUS.PARSING ||
    status === FILE_STATUS.PROCESSING
  );
}

/**
 * Maps upload source values to display labels.
 * @type {Object<string, string>}
 */
const SOURCE_LABELS = {
  web: 'Web Upload',
  api: 'Mock API',
  sftp: 'Mock SFTP',
};

/**
 * FileDetails component.
 * Displays a detailed view of a single file including metadata, validation results,
 * parsed member summary, processing timeline with stage statuses, error details
 * if failed, and a retry button for failed files.
 *
 * @param {{
 *   fileId?: string,
 *   file?: object,
 *   className?: string,
 *   onClose?: () => void,
 *   onRetryComplete?: (result: object) => void,
 * }} props
 * @returns {import('react').ReactElement}
 */
export function FileDetails({ fileId, file: fileProp, className, onClose, onRetryComplete }) {
  const getFile = useFileStore((state) => state.getFile);
  const files = useFileStore((state) => state.files);
  const { currentUser, hasPermission } = useAuth();
  const logAction = useAuditStore((state) => state.logAction);

  const [alertMessage, setAlertMessage] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [memberDetailModalOpen, setMemberDetailModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  const canUploadFiles = hasPermission('upload_files');

  /**
   * Resolve the file from either the prop or the store.
   */
  const file = useMemo(() => {
    if (fileProp && typeof fileProp === 'object' && fileProp.id) {
      return fileProp;
    }
    if (fileId) {
      return getFile(fileId);
    }
    return null;
  }, [fileProp, fileId, getFile, files]);

  /**
   * Derive the completed stages, active stage, and failed stage from file status.
   */
  const completedStages = useMemo(() => {
    if (!file) return [];
    return getCompletedStagesForStatus(file.status);
  }, [file]);

  const activeStage = useMemo(() => {
    if (!file) return null;
    return getActiveStageForStatus(file.status);
  }, [file]);

  const failedStage = useMemo(() => {
    if (!file || file.status !== FILE_STATUS.FAILED) return null;
    // Determine which stage failed based on error or validation errors
    if (file.validationErrors && file.validationErrors.length > 0) {
      return 'Validate';
    }
    if (file.error) {
      const errorLower = (file.error || '').toLowerCase();
      if (errorLower.includes('validation')) return 'Validate';
      if (errorLower.includes('pars')) return 'Parse';
      if (errorLower.includes('eligib')) return 'Eligibility';
      if (errorLower.includes('categor')) return 'Categorize';
      if (errorLower.includes('enrollment')) return 'Enrollment';
      if (errorLower.includes('integrat')) return 'Integration';
    }
    return 'Validate';
  }, [file]);

  /**
   * Member statistics derived from the file's members array.
   */
  const memberStats = useMemo(() => {
    if (!file || !Array.isArray(file.members)) {
      return { total: 0, eligible: 0, ineligible: 0, pending: 0 };
    }
    return {
      total: file.members.length,
      eligible: file.members.filter((m) => m.eligibilityStatus === 'Eligible').length,
      ineligible: file.members.filter((m) => m.eligibilityStatus === 'Ineligible').length,
      pending: file.members.filter((m) => m.eligibilityStatus === 'Pending').length,
    };
  }, [file]);

  /**
   * Handles retrying a failed file.
   */
  const handleRetry = useCallback(async () => {
    if (!file || !file.id || isRetrying) return;

    if (file.status !== FILE_STATUS.FAILED) {
      setAlertMessage({
        type: 'warning',
        message: 'Only failed files can be retried.',
        title: 'Cannot Retry',
      });
      return;
    }

    setIsRetrying(true);
    setAlertMessage(null);

    try {
      const userId = currentUser ? currentUser.id : '';
      const userName = currentUser ? currentUser.name : '';

      const result = await retryFileProcessing(file.id, {
        userId,
        userName,
        skipIntegration: false,
      });

      if (result.success) {
        setAlertMessage({
          type: 'success',
          message: `File "${file.name}" has been reprocessed successfully.`,
          title: 'Retry Successful',
        });
      } else {
        const errorMsg =
          result.errors && result.errors.length > 0
            ? result.errors.join(' ')
            : 'Retry processing failed.';
        setAlertMessage({
          type: 'error',
          message: errorMsg,
          title: 'Retry Failed',
        });
      }

      if (typeof onRetryComplete === 'function') {
        onRetryComplete(result);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred during retry.';
      setAlertMessage({
        type: 'error',
        message: errorMessage,
        title: 'Retry Error',
      });
    } finally {
      setIsRetrying(false);
    }
  }, [file, isRetrying, currentUser, onRetryComplete]);

  /**
   * Handles viewing a member's details.
   * @param {object} member - The member to view.
   */
  const handleViewMember = useCallback((member) => {
    if (!member) return;
    setSelectedMember(member);
    setMemberDetailModalOpen(true);
  }, []);

  /**
   * Closes the member detail modal.
   */
  const handleCloseMemberModal = useCallback(() => {
    setMemberDetailModalOpen(false);
    setSelectedMember(null);
  }, []);

  // If no file found, show empty state
  if (!file) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm p-8 ${className || ''}`}>
        <div className="flex flex-col items-center justify-center py-8">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm text-gray-500">File not found.</p>
          {typeof onClose === 'function' && (
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const isProcessing = isProcessingStatus(file.status);
  const isFailed = file.status === FILE_STATUS.FAILED;
  const isCompleted = file.status === FILE_STATUS.COMPLETED;

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-primary-500"
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
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-800 truncate" title={file.name}>
                {file.name || 'Unnamed File'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <StatusBadge status={file.status || 'Unknown'} size="md" />
                <span className="text-xs text-gray-500">
                  {SOURCE_LABELS[file.uploadSource] || file.uploadSource || 'Unknown Source'}
                </span>
                {isProcessing && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary-600">
                    <svg
                      className="animate-spin h-3 w-3 text-primary-500"
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
                    Processing...
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isFailed && canUploadFiles && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-warning-500 rounded-lg hover:bg-warning-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-warning-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRetrying ? (
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
                    Retrying...
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
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Retry Processing
                  </>
                )}
              </button>
            )}
            {typeof onClose === 'function' && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                Close
              </button>
            )}
          </div>
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

      {/* Retrying indicator */}
      {isRetrying && (
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 flex items-center gap-3">
          <LoadingSpinner size="sm" />
          <p className="text-sm text-warning-700">
            Retrying file processing... This may take a moment.
          </p>
        </div>
      )}

      {/* File Metadata */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">File Metadata</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">File Name</p>
            <p className="text-sm text-gray-800 mt-0.5 break-all">{file.name || 'Unnamed'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">File ID</p>
            <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs break-all">{file.id || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Status</p>
            <div className="mt-1">
              <StatusBadge status={file.status || 'Unknown'} size="md" />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Upload Source</p>
            <p className="text-sm text-gray-800 mt-0.5">
              {SOURCE_LABELS[file.uploadSource] || file.uploadSource || 'Unknown'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Uploaded At</p>
            <p className="text-sm text-gray-800 mt-0.5">
              {file.timestamp ? formatTimestamp(file.timestamp) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Processed At</p>
            <p className="text-sm text-gray-800 mt-0.5">
              {file.processedAt ? formatTimestamp(file.processedAt) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Members</p>
            <p className="text-sm text-gray-800 mt-0.5 font-semibold">
              {memberStats.total}
            </p>
          </div>
          {file.rawContent && (
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Content Size</p>
              <p className="text-sm text-gray-800 mt-0.5">
                {file.rawContent.length.toLocaleString()} characters
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Processing Timeline */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Processing Timeline</h3>
        <div className="relative">
          <div className="space-y-0">
            {PIPELINE_STAGE_DEFINITIONS.map((stage, index) => {
              const isStageCompleted = completedStages.includes(stage.key);
              const isStageActive = activeStage === stage.key;
              const isStageFailed = failedStage === stage.key && isFailed;
              const isLast = index === PIPELINE_STAGE_DEFINITIONS.length - 1;

              let stageStatus = 'pending';
              if (isStageCompleted) stageStatus = 'completed';
              if (isStageActive) stageStatus = 'active';
              if (isStageFailed) stageStatus = 'failed';

              return (
                <div key={stage.key} className="flex items-start gap-3">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    {/* Stage indicator */}
                    <div
                      className={`flex items-center justify-center h-8 w-8 rounded-full border-2 ${
                        stageStatus === 'completed'
                          ? 'bg-success-100 border-success-500'
                          : stageStatus === 'active'
                            ? 'bg-primary-100 border-primary-500'
                            : stageStatus === 'failed'
                              ? 'bg-error-100 border-error-500'
                              : 'bg-gray-50 border-gray-300'
                      }`}
                    >
                      {stageStatus === 'completed' && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-success-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {stageStatus === 'active' && (
                        <svg
                          className="animate-spin h-4 w-4 text-primary-600"
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
                      )}
                      {stageStatus === 'failed' && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-error-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      {stageStatus === 'pending' && (
                        <div className="h-2 w-2 rounded-full bg-gray-300" />
                      )}
                    </div>
                    {/* Connector line */}
                    {!isLast && (
                      <div
                        className={`w-0.5 h-6 ${
                          isStageCompleted ? 'bg-success-300' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>

                  {/* Stage content */}
                  <div className={`pb-4 min-w-0 ${isLast ? 'pb-0' : ''}`}>
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm font-medium ${
                          stageStatus === 'completed'
                            ? 'text-success-700'
                            : stageStatus === 'active'
                              ? 'text-primary-700'
                              : stageStatus === 'failed'
                                ? 'text-error-700'
                                : 'text-gray-500'
                        }`}
                      >
                        {stage.label}
                      </p>
                      {stageStatus === 'completed' && (
                        <span className="text-[10px] font-medium text-success-600 bg-success-50 px-1.5 py-0.5 rounded-full">
                          Done
                        </span>
                      )}
                      {stageStatus === 'active' && (
                        <span className="text-[10px] font-medium text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full">
                          In Progress
                        </span>
                      )}
                      {stageStatus === 'failed' && (
                        <span className="text-[10px] font-medium text-error-600 bg-error-50 px-1.5 py-0.5 rounded-full">
                          Failed
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-xs mt-0.5 ${
                        stageStatus === 'pending' ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      {stage.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Processing indicator for in-progress files */}
      {isProcessing && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 flex items-center gap-3">
          <LoadingSpinner size="sm" />
          <p className="text-sm text-primary-700">
            File is currently being processed ({file.status})...
          </p>
        </div>
      )}

      {/* Error Details */}
      {isFailed && (file.error || (Array.isArray(file.validationErrors) && file.validationErrors.length > 0)) && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
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
            Error Details
          </h3>

          {file.error && (
            <div className="p-3 bg-error-50 border border-error-200 rounded-lg mb-3">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">
                Error Message
              </p>
              <p className="text-sm text-error-700">{file.error}</p>
            </div>
          )}

          {Array.isArray(file.validationErrors) && file.validationErrors.length > 0 && (
            <div className="p-3 bg-error-50 border border-error-200 rounded-lg">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">
                Validation Errors ({file.validationErrors.length})
              </p>
              <ul className="space-y-1">
                {file.validationErrors.map((error, index) => (
                  <li key={index} className="text-sm text-error-700 flex items-start gap-1.5">
                    <span className="flex-shrink-0 mt-0.5">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canUploadFiles && (
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-warning-500 rounded-lg hover:bg-warning-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-warning-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRetrying ? (
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
                    Retrying...
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
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Retry Processing
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500">
                Retry will reprocess the file from the beginning.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Validation Results */}
      {(isCompleted || isFailed) && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Validation Results</h3>
          <div
            className={`p-3 rounded-lg border ${
              isFailed
                ? 'bg-error-50 border-error-200'
                : 'bg-success-50 border-success-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {isFailed ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-error-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-success-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
              <p
                className={`text-sm font-medium ${
                  isFailed ? 'text-error-700' : 'text-success-700'
                }`}
              >
                {isFailed
                  ? 'Validation failed — file could not be processed'
                  : 'Validation passed — file processed successfully'}
              </p>
            </div>
            {isCompleted && (
              <p className="text-xs text-success-600 mt-1 ml-7">
                All EDI 834 format checks passed. {memberStats.total} member(s) extracted.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Parsed Member Summary */}
      {memberStats.total > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Parsed Member Summary ({memberStats.total})
          </h3>

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-semibold text-gray-800">{memberStats.total}</p>
            </div>
            <div className="text-center p-3 bg-success-50 rounded-lg border border-success-100">
              <p className="text-xs text-success-600">Eligible</p>
              <p className="text-lg font-semibold text-success-700">{memberStats.eligible}</p>
            </div>
            <div className="text-center p-3 bg-error-50 rounded-lg border border-error-100">
              <p className="text-xs text-error-600">Ineligible</p>
              <p className="text-lg font-semibold text-error-700">{memberStats.ineligible}</p>
            </div>
            <div className="text-center p-3 bg-warning-50 rounded-lg border border-warning-100">
              <p className="text-xs text-warning-600">Pending</p>
              <p className="text-lg font-semibold text-warning-700">{memberStats.pending}</p>
            </div>
          </div>

          {/* Member list */}
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {file.members.map((member, index) => (
              <div
                key={member.id || member.memberId || `member-${index}`}
                className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleViewMember(member)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 truncate">
                    {member.firstName || ''} {member.lastName || ''}
                    {!member.firstName && !member.lastName && (
                      <span className="text-gray-400">Unknown Member</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    ID: {member.memberId || member.id || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {member.eligibilityStatus && (
                    <StatusBadge status={member.eligibilityStatus} size="sm" />
                  )}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member Detail Modal */}
      <Modal
        isOpen={memberDetailModalOpen}
        onClose={handleCloseMemberModal}
        title="Member Details"
        size="md"
        actions={[
          {
            label: 'Close',
            onClick: handleCloseMemberModal,
            variant: 'secondary',
          },
        ]}
      >
        {selectedMember && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Name</p>
                <p className="text-sm text-gray-800 mt-0.5">
                  {selectedMember.firstName || ''} {selectedMember.lastName || ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Member ID</p>
                <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs">
                  {selectedMember.memberId || selectedMember.id || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Status</p>
                <div className="mt-1">
                  <StatusBadge status={selectedMember.eligibilityStatus || 'Unknown'} size="md" />
                </div>
              </div>
              {selectedMember.demographics && selectedMember.demographics.gender && (
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Gender</p>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {selectedMember.demographics.gender}
                  </p>
                </div>
              )}
              {selectedMember.demographics && selectedMember.demographics.dateOfBirth && (
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Date of Birth</p>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {selectedMember.demographics.dateOfBirth}
                  </p>
                </div>
              )}
              {selectedMember.demographics && selectedMember.demographics.age !== undefined && selectedMember.demographics.age !== null && (
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Age</p>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {selectedMember.demographics.age}
                  </p>
                </div>
              )}
            </div>

            {selectedMember.demographics && selectedMember.demographics.address && (
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Address</p>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  {selectedMember.demographics.address.line1 && (
                    <p className="text-sm text-gray-800">{selectedMember.demographics.address.line1}</p>
                  )}
                  {selectedMember.demographics.address.line2 && (
                    <p className="text-sm text-gray-800">{selectedMember.demographics.address.line2}</p>
                  )}
                  <p className="text-sm text-gray-800">
                    {[
                      selectedMember.demographics.address.city,
                      selectedMember.demographics.address.state,
                      selectedMember.demographics.address.zipCode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              </div>
            )}

            {selectedMember.coverage && (
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Coverage</p>
                <p className="text-sm text-gray-800 mt-0.5">{selectedMember.coverage}</p>
              </div>
            )}

            {selectedMember.effectiveDate && (
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Effective Date</p>
                <p className="text-sm text-gray-800 mt-0.5">{selectedMember.effectiveDate}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

FileDetails.propTypes = {
  fileId: PropTypes.string,
  file: PropTypes.object,
  className: PropTypes.string,
  onClose: PropTypes.func,
  onRetryComplete: PropTypes.func,
};

FileDetails.defaultProps = {
  fileId: '',
  file: null,
  className: '',
  onClose: undefined,
  onRetryComplete: undefined,
};

export default FileDetails;