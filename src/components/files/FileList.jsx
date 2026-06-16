import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useFileStore } from '../../stores/fileStore';
import { useAuditStore } from '../../stores/auditStore';
import { useAuth } from '../../contexts/AuthContext';
import { FILE_STATUS } from '../../utils/constants';
import { formatTimestamp } from '../../utils/helpers';
import { retryFileProcessing } from '../../services/processingPipeline';
import { DataTable } from '../common/DataTable';
import { SearchBar } from '../common/SearchBar';
import { StatusBadge } from '../common/StatusBadge';
import { AlertMessage } from '../common/AlertMessage';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';

/**
 * Status filter options for the file list.
 * @type {Array<{ value: string, label: string }>}
 */
const STATUS_FILTER_OPTIONS = [
  { value: FILE_STATUS.UPLOADED, label: 'Uploaded' },
  { value: FILE_STATUS.VALIDATING, label: 'Validating' },
  { value: FILE_STATUS.PARSING, label: 'Parsing' },
  { value: FILE_STATUS.PROCESSING, label: 'Processing' },
  { value: FILE_STATUS.COMPLETED, label: 'Completed' },
  { value: FILE_STATUS.FAILED, label: 'Failed' },
];

/**
 * Upload source filter options for the file list.
 * @type {Array<{ value: string, label: string }>}
 */
const SOURCE_FILTER_OPTIONS = [
  { value: 'web', label: 'Web Upload' },
  { value: 'api', label: 'Mock API' },
  { value: 'sftp', label: 'Mock SFTP' },
];

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
 * FileList component.
 * Displays a list of uploaded files with columns for name, upload source, status,
 * timestamp, member count, and actions (view details, retry, delete).
 * Uses the DataTable component with search and filter capabilities.
 * Shows processing progress indicator for in-progress files.
 *
 * @param {{ className?: string, onFileSelect?: (file: object) => void }} props
 * @returns {import('react').ReactElement}
 */
export function FileList({ className, onFileSelect }) {
  const files = useFileStore((state) => state.files);
  const removeFile = useFileStore((state) => state.removeFile);
  const { currentUser, hasPermission } = useAuth();
  const logAction = useAuditStore((state) => state.logAction);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [alertMessage, setAlertMessage] = useState(null);
  const [retryingFileId, setRetryingFileId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedFileDetail, setSelectedFileDetail] = useState(null);

  const canDeleteFiles = hasPermission('delete_files');
  const canUploadFiles = hasPermission('upload_files');

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
   * Filters files based on search term and active filters.
   */
  const filteredFiles = useMemo(() => {
    let result = Array.isArray(files) ? [...files] : [];

    // Apply search term filter
    if (searchTerm && searchTerm.trim().length > 0) {
      const lowerSearch = searchTerm.toLowerCase().trim();
      result = result.filter(
        (file) =>
          (file.name && file.name.toLowerCase().includes(lowerSearch)) ||
          (file.id && file.id.toLowerCase().includes(lowerSearch))
      );
    }

    // Apply status filter
    if (activeFilters.status) {
      result = result.filter((file) => file.status === activeFilters.status);
    }

    // Apply upload source filter
    if (activeFilters.uploadSource) {
      result = result.filter((file) => file.uploadSource === activeFilters.uploadSource);
    }

    return result;
  }, [files, searchTerm, activeFilters]);

  /**
   * Handles viewing file details.
   * @param {object} file - The file to view details for.
   */
  const handleViewDetails = useCallback(
    (file) => {
      if (!file) return;
      setSelectedFileDetail(file);
      setDetailModalOpen(true);
    },
    []
  );

  /**
   * Handles closing the detail modal.
   */
  const handleCloseDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedFileDetail(null);
  }, []);

  /**
   * Handles retrying a failed file.
   * @param {object} file - The file to retry.
   */
  const handleRetry = useCallback(
    async (file) => {
      if (!file || !file.id || retryingFileId) return;

      if (file.status !== FILE_STATUS.FAILED) {
        setAlertMessage({
          type: 'warning',
          message: 'Only failed files can be retried.',
          title: 'Cannot Retry',
        });
        return;
      }

      setRetryingFileId(file.id);
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
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred during retry.';
        setAlertMessage({
          type: 'error',
          message: errorMessage,
          title: 'Retry Error',
        });
      } finally {
        setRetryingFileId(null);
      }
    },
    [retryingFileId, currentUser]
  );

  /**
   * Opens the delete confirmation modal.
   * @param {object} file - The file to delete.
   */
  const handleDeleteClick = useCallback(
    (file) => {
      if (!file || !canDeleteFiles) return;
      setFileToDelete(file);
      setDeleteModalOpen(true);
    },
    [canDeleteFiles]
  );

  /**
   * Confirms and executes file deletion.
   */
  const handleConfirmDelete = useCallback(() => {
    if (!fileToDelete) return;

    const removed = removeFile(fileToDelete.id);

    if (removed) {
      const userId = currentUser ? currentUser.id : '';
      logAction('File Deleted', fileToDelete.id, userId, {
        fileName: fileToDelete.name || '',
        deletedAt: new Date().toISOString(),
      });

      setAlertMessage({
        type: 'success',
        message: `File "${fileToDelete.name}" has been deleted.`,
        title: 'File Deleted',
      });
    } else {
      setAlertMessage({
        type: 'error',
        message: `Failed to delete file "${fileToDelete.name}".`,
        title: 'Delete Failed',
      });
    }

    setDeleteModalOpen(false);
    setFileToDelete(null);
  }, [fileToDelete, removeFile, currentUser, logAction]);

  /**
   * Cancels file deletion.
   */
  const handleCancelDelete = useCallback(() => {
    setDeleteModalOpen(false);
    setFileToDelete(null);
  }, []);

  /**
   * Handles row click to select a file or view details.
   * @param {object} file - The clicked file row.
   */
  const handleRowClick = useCallback(
    (file) => {
      if (typeof onFileSelect === 'function') {
        onFileSelect(file);
      } else {
        handleViewDetails(file);
      }
    },
    [onFileSelect, handleViewDetails]
  );

  /**
   * DataTable column definitions.
   * @type {Array<object>}
   */
  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'File Name',
        sortable: true,
        render: (value, row) => (
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
            <span className="font-medium text-gray-800 truncate max-w-[200px]" title={value}>
              {value || 'Unnamed File'}
            </span>
            {isProcessingStatus(row.status) && (
              <svg
                className="animate-spin h-3 w-3 text-primary-500 flex-shrink-0"
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
          </div>
        ),
      },
      {
        key: 'uploadSource',
        label: 'Source',
        sortable: true,
        render: (value) => {
          const sourceLabels = {
            web: 'Web',
            api: 'API',
            sftp: 'SFTP',
          };
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
        sortable: true,
        render: (value) => <StatusBadge status={value || 'Unknown'} size="sm" />,
      },
      {
        key: 'timestamp',
        label: 'Uploaded',
        sortable: true,
        render: (value) => (
          <span className="text-xs text-gray-500">{value ? formatTimestamp(value) : '—'}</span>
        ),
      },
      {
        key: 'members',
        label: 'Members',
        sortable: false,
        render: (value) => {
          const count = Array.isArray(value) ? value.length : 0;
          return (
            <span className="text-sm text-gray-700 font-medium">
              {count}
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
                handleViewDetails(row);
              }}
              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
              aria-label={`View details for ${row.name}`}
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

            {/* Retry (only for failed files) */}
            {row.status === FILE_STATUS.FAILED && canUploadFiles && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRetry(row);
                }}
                disabled={retryingFileId === row.id}
                className="p-1.5 text-gray-400 hover:text-warning-600 hover:bg-warning-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Retry processing ${row.name}`}
                title="Retry"
              >
                {retryingFileId === row.id ? (
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

            {/* Delete */}
            {canDeleteFiles && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(row);
                }}
                className="p-1.5 text-gray-400 hover:text-error-600 hover:bg-error-50 rounded-md transition-colors"
                aria-label={`Delete ${row.name}`}
                title="Delete"
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
              </button>
            )}
          </div>
        ),
      },
    ],
    [handleViewDetails, handleRetry, handleDeleteClick, canDeleteFiles, canUploadFiles, retryingFileId]
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
        key: 'uploadSource',
        label: 'Source',
        options: SOURCE_FILTER_OPTIONS,
      },
    ],
    []
  );

  /**
   * File statistics summary.
   */
  const fileStats = useMemo(() => {
    const allFiles = Array.isArray(files) ? files : [];
    return {
      total: allFiles.length,
      completed: allFiles.filter((f) => f.status === FILE_STATUS.COMPLETED).length,
      failed: allFiles.filter((f) => f.status === FILE_STATUS.FAILED).length,
      processing: allFiles.filter((f) => isProcessingStatus(f.status)).length,
    };
  }, [files]);

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Uploaded Files</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {fileStats.total} file{fileStats.total !== 1 ? 's' : ''} total
            {fileStats.processing > 0 && (
              <span className="text-primary-600 ml-2">
                • {fileStats.processing} processing
              </span>
            )}
            {fileStats.failed > 0 && (
              <span className="text-error-600 ml-2">
                • {fileStats.failed} failed
              </span>
            )}
          </p>
        </div>

        {/* Quick stat badges */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-success-50 text-success-700 rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {fileStats.completed} completed
          </span>
          {fileStats.failed > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-error-50 text-error-700 rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {fileStats.failed} failed
            </span>
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

      {/* Search and Filters */}
      <SearchBar
        placeholder="Search files by name..."
        onSearch={handleSearch}
        filters={searchFilters}
        debounceMs={300}
      />

      {/* Retrying indicator */}
      {retryingFileId && (
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 flex items-center gap-3">
          <LoadingSpinner size="sm" />
          <p className="text-sm text-warning-700">
            Retrying file processing...
          </p>
        </div>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredFiles}
        onRowClick={handleRowClick}
        pageSize={10}
        sortable
        rowKey="id"
        emptyMessage="No files found. Upload an EDI 834 file to get started."
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={handleCancelDelete}
        title="Delete File"
        size="sm"
        actions={[
          {
            label: 'Cancel',
            onClick: handleCancelDelete,
            variant: 'secondary',
          },
          {
            label: 'Delete',
            onClick: handleConfirmDelete,
            variant: 'danger',
          },
        ]}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Are you sure you want to delete this file? This action cannot be undone.
          </p>
          {fileToDelete && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5"
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
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {fileToDelete.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={fileToDelete.status || 'Unknown'} size="sm" />
                  <span className="text-xs text-gray-500">
                    {fileToDelete.timestamp ? formatTimestamp(fileToDelete.timestamp) : ''}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* File Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={handleCloseDetailModal}
        title="File Details"
        size="lg"
        actions={[
          {
            label: 'Close',
            onClick: handleCloseDetailModal,
            variant: 'secondary',
          },
        ]}
      >
        {selectedFileDetail && (
          <div className="space-y-4">
            {/* File Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  File Name
                </p>
                <p className="text-sm text-gray-800 mt-0.5 break-all">
                  {selectedFileDetail.name || 'Unnamed'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  File ID
                </p>
                <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs break-all">
                  {selectedFileDetail.id || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Status
                </p>
                <div className="mt-1">
                  <StatusBadge status={selectedFileDetail.status || 'Unknown'} size="md" />
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Upload Source
                </p>
                <p className="text-sm text-gray-800 mt-0.5 capitalize">
                  {selectedFileDetail.uploadSource || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Uploaded At
                </p>
                <p className="text-sm text-gray-800 mt-0.5">
                  {selectedFileDetail.timestamp
                    ? formatTimestamp(selectedFileDetail.timestamp)
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Processed At
                </p>
                <p className="text-sm text-gray-800 mt-0.5">
                  {selectedFileDetail.processedAt
                    ? formatTimestamp(selectedFileDetail.processedAt)
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Members
                </p>
                <p className="text-sm text-gray-800 mt-0.5 font-semibold">
                  {Array.isArray(selectedFileDetail.members)
                    ? selectedFileDetail.members.length
                    : 0}
                </p>
              </div>
            </div>

            {/* Processing indicator for in-progress files */}
            {isProcessingStatus(selectedFileDetail.status) && (
              <div className="flex items-center gap-3 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                <LoadingSpinner size="sm" />
                <p className="text-sm text-primary-700">
                  File is currently being processed ({selectedFileDetail.status})...
                </p>
              </div>
            )}

            {/* Error details */}
            {selectedFileDetail.error && (
              <div className="p-3 bg-error-50 border border-error-200 rounded-lg">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">
                  Error
                </p>
                <p className="text-sm text-error-700">{selectedFileDetail.error}</p>
              </div>
            )}

            {/* Validation errors */}
            {Array.isArray(selectedFileDetail.validationErrors) &&
              selectedFileDetail.validationErrors.length > 0 && (
                <div className="p-3 bg-error-50 border border-error-200 rounded-lg">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">
                    Validation Errors
                  </p>
                  <ul className="space-y-1">
                    {selectedFileDetail.validationErrors.map((error, index) => (
                      <li key={index} className="text-sm text-error-700">
                        • {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Members list */}
            {Array.isArray(selectedFileDetail.members) &&
              selectedFileDetail.members.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
                    Members ({selectedFileDetail.members.length})
                  </p>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {selectedFileDetail.members.map((member, index) => (
                      <div
                        key={member.id || member.memberId || `member-${index}`}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 truncate">
                            {member.firstName || ''} {member.lastName || ''}
                          </p>
                          <p className="text-xs text-gray-500">
                            ID: {member.memberId || member.id || '—'}
                          </p>
                        </div>
                        {member.eligibilityStatus && (
                          <StatusBadge status={member.eligibilityStatus} size="sm" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </Modal>
    </div>
  );
}

FileList.propTypes = {
  className: PropTypes.string,
  onFileSelect: PropTypes.func,
};

FileList.defaultProps = {
  className: '',
  onFileSelect: undefined,
};

export default FileList;