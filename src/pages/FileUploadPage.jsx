import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFileStore } from '../stores/fileStore';
import { useAuditStore } from '../stores/auditStore';
import { FileUpload } from '../components/files/FileUpload';
import { FileList } from '../components/files/FileList';
import { AlertMessage } from '../components/common/AlertMessage';
import { SUPPORTED_FILE_EXTENSIONS, MAX_FILE_SIZE_BYTES } from '../utils/constants';

/**
 * Tab definitions for the file upload page.
 * @type {Array<{ key: string, label: string, description: string, icon: string }>}
 */
const UPLOAD_TABS = [
  {
    key: 'upload',
    label: 'Upload File',
    description: 'Upload and process EDI 834 files',
    icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
  },
  {
    key: 'files',
    label: 'File History',
    description: 'View previously uploaded files',
    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  },
];

/**
 * FileUploadPage component.
 * File upload page combining FileUpload component for new uploads and FileList
 * for existing files. Includes tabs for Web Upload, Mock API Upload, and Mock SFTP
 * Upload modes. Shows upload instructions and supported file formats.
 *
 * @returns {import('react').ReactElement}
 */
export function FileUploadPage() {
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAuth();
  const files = useFileStore((state) => state.files);
  const logAction = useAuditStore((state) => state.logAction);

  const [activeTab, setActiveTab] = useState('upload');
  const [alertMessage, setAlertMessage] = useState(null);

  const canUpload = hasPermission('upload_files');
  const canViewFiles = hasPermission('view_files');

  const maxFileSizeMB = MAX_FILE_SIZE_BYTES / (1024 * 1024);

  /**
   * File statistics summary.
   */
  const fileStats = {
    total: Array.isArray(files) ? files.length : 0,
    completed: Array.isArray(files) ? files.filter((f) => f.status === 'Completed').length : 0,
    failed: Array.isArray(files) ? files.filter((f) => f.status === 'Failed').length : 0,
    processing: Array.isArray(files)
      ? files.filter(
          (f) =>
            f.status === 'Validating' ||
            f.status === 'Parsing' ||
            f.status === 'Processing'
        ).length
      : 0,
  };

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
        page: 'FileUploadPage',
      });
    },
    [currentUser, logAction]
  );

  /**
   * Handles upload completion callback from FileUpload component.
   * @param {object} result - The upload result from the processing pipeline.
   */
  const handleUploadComplete = useCallback(
    (result) => {
      if (!result) return;

      if (result.success) {
        setAlertMessage({
          type: 'success',
          message: `File processed successfully. ${
            Array.isArray(result.members) ? result.members.length : 0
          } member(s) extracted, ${
            Array.isArray(result.enrollments) ? result.enrollments.length : 0
          } enrollment(s) created.`,
          title: 'Upload Complete',
        });
      } else {
        const errorMsg =
          result.errors && result.errors.length > 0
            ? result.errors.join(' ')
            : 'File processing failed. Please check the file format and try again.';
        setAlertMessage({
          type: 'error',
          message: errorMsg,
          title: 'Upload Failed',
        });
      }
    },
    []
  );

  /**
   * Handles file selection from the FileList component.
   * @param {object} file - The selected file.
   */
  const handleFileSelect = useCallback(
    (file) => {
      if (file) {
        navigate('/files');
      }
    },
    [navigate]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">File Upload</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload EDI 834 enrollment files for processing through the Medicaid enrollment pipeline.
          </p>
        </div>

        {/* Quick stat badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
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
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            {fileStats.total} file{fileStats.total !== 1 ? 's' : ''}
          </span>
          {fileStats.completed > 0 && (
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
          )}
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
          {fileStats.processing > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-warning-50 text-warning-700 rounded-full">
              <svg
                className="animate-spin h-3 w-3 text-warning-500"
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
              {fileStats.processing} processing
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
          autoDismissMs={8000}
        />
      )}

      {/* Upload Instructions Card */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-800">Upload Instructions</h3>
            <p className="text-sm text-gray-600 mt-1">
              Upload EDI 834 enrollment files to process member data through the Medicaid enrollment pipeline.
              Files are validated, parsed, and members are evaluated against configurable eligibility rules.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Supported Formats */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">
                  Supported Formats
                </p>
                <div className="flex flex-wrap gap-1">
                  {SUPPORTED_FILE_EXTENSIONS.map((ext) => (
                    <span
                      key={ext}
                      className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-primary-50 text-primary-700 rounded"
                    >
                      {ext}
                    </span>
                  ))}
                </div>
              </div>

              {/* Max File Size */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">
                  Max File Size
                </p>
                <p className="text-sm font-semibold text-gray-800">{maxFileSizeMB} MB</p>
              </div>

              {/* Upload Sources */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">
                  Upload Sources
                </p>
                <div className="flex flex-wrap gap-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-primary-50 text-primary-700 rounded">
                    Web Upload
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-primary-50 text-primary-700 rounded">
                    Mock API
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-primary-50 text-primary-700 rounded">
                    Mock SFTP
                  </span>
                </div>
              </div>
            </div>

            {/* Processing Pipeline Steps */}
            <div className="mt-3">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
                Processing Pipeline
              </p>
              <div className="flex flex-wrap items-center gap-1">
                {[
                  'Upload',
                  'Validate',
                  'Parse',
                  'Eligibility',
                  'Categorize',
                  'Enrollment',
                  'Integration',
                ].map((stage, index, arr) => (
                  <span key={stage} className="flex items-center gap-1">
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded-full">
                      {stage}
                    </span>
                    {index < arr.length - 1 && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          {UPLOAD_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 sm:flex-none px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-700 bg-primary-50'
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
                {tab.key === 'files' && fileStats.total > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-gray-200 text-gray-600 rounded-full">
                    {fileStats.total}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div>
              {canUpload ? (
                <FileUpload onUploadComplete={handleUploadComplete} />
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
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
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <p className="text-sm text-gray-500 font-medium">Access Denied</p>
                  <p className="text-xs text-gray-400 mt-1">
                    You do not have permission to upload files. Contact your administrator.
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Current role: <span className="font-medium">{currentUser ? currentUser.role : 'Unknown'}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Files Tab */}
          {activeTab === 'files' && (
            <div>
              {canViewFiles ? (
                <FileList onFileSelect={handleFileSelect} />
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
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
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <p className="text-sm text-gray-500 font-medium">Access Denied</p>
                  <p className="text-xs text-gray-400 mt-1">
                    You do not have permission to view files. Contact your administrator.
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Current role: <span className="font-medium">{currentUser ? currentUser.role : 'Unknown'}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">EDI 834 File Format Guide</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Required Segments */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
              Required Segments
            </p>
            <ul className="space-y-1">
              {[
                { code: 'ISA', desc: 'Interchange Control Header' },
                { code: 'GS', desc: 'Functional Group Header' },
                { code: 'ST', desc: 'Transaction Set Header (834)' },
                { code: 'INS', desc: 'Insured Benefit' },
                { code: 'NM1', desc: 'Member Name' },
                { code: 'SE', desc: 'Transaction Set Trailer' },
                { code: 'GE', desc: 'Functional Group Trailer' },
                { code: 'IEA', desc: 'Interchange Control Trailer' },
              ].map((seg) => (
                <li key={seg.code} className="flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium bg-primary-50 text-primary-700 rounded">
                    {seg.code}
                  </span>
                  <span className="text-xs text-gray-600">{seg.desc}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Optional Segments */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
              Optional Segments
            </p>
            <ul className="space-y-1">
              {[
                { code: 'DMG', desc: 'Demographics' },
                { code: 'N3', desc: 'Address Line' },
                { code: 'N4', desc: 'City/State/Zip' },
                { code: 'HD', desc: 'Health Coverage' },
                { code: 'DTP', desc: 'Date/Time Period' },
                { code: 'REF', desc: 'Reference Identification' },
                { code: 'ICM', desc: 'Income Information' },
              ].map((seg) => (
                <li key={seg.code} className="flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium bg-gray-100 text-gray-600 rounded">
                    {seg.code}
                  </span>
                  <span className="text-xs text-gray-600">{seg.desc}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Upload Sources Info */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
              Upload Source Details
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-800">Web Upload</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Drag and drop or browse to upload files directly through the browser.
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-800">Mock API</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Simulates file ingestion via a REST API endpoint for automated workflows.
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-800">Mock SFTP</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Simulates secure file transfer via SFTP for batch processing scenarios.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FileUploadPage;