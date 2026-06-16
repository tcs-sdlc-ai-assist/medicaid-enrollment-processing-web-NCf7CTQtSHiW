import { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';
import { processFile } from '../../services/processingPipeline';
import { validateFile } from '../../services/fileValidator';
import { mockApiUpload, mockSftpUpload } from '../../services/mockEndpoints';
import { SUPPORTED_FILE_EXTENSIONS, MAX_FILE_SIZE_BYTES } from '../../utils/constants';
import { AlertMessage } from '../common/AlertMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/StatusBadge';

/**
 * Formats a file size in bytes to a human-readable string.
 * @param {number} bytes - The file size in bytes.
 * @returns {string} The formatted file size string.
 */
function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || bytes <= 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Upload source options for the selector.
 * @type {Array<{ value: string, label: string, description: string }>}
 */
const UPLOAD_SOURCES = [
  { value: 'web', label: 'Web Upload', description: 'Upload directly via browser' },
  { value: 'api', label: 'Mock API', description: 'Simulate API file ingestion' },
  { value: 'sftp', label: 'Mock SFTP', description: 'Simulate SFTP file transfer' },
];

/**
 * Accepted file extensions for the file input.
 * @type {string}
 */
const ACCEPT_EXTENSIONS = SUPPORTED_FILE_EXTENSIONS.join(',');

/**
 * FileUpload component.
 * Provides a drag-and-drop zone and file input button for uploading EDI 834 files.
 * Shows file preview with name, size, and validation status.
 * Triggers the processing pipeline on upload.
 * Includes upload source selector (Web, Mock API, Mock SFTP).
 *
 * @param {{ className?: string, onUploadComplete?: (result: object) => void }} props
 * @returns {import('react').ReactElement}
 */
export function FileUpload({ className, onUploadComplete }) {
  const { currentUser, isAuthenticated } = useAuth();

  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [uploadSource, setUploadSource] = useState('web');
  const [validationResult, setValidationResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null);
  const [pipelineStages, setPipelineStages] = useState([]);

  const fileInputRef = useRef(null);

  /**
   * Reads a File object and returns its text content.
   * @param {File} file - The file to read.
   * @returns {Promise<string>} The file content as a string.
   */
  const readFileContent = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target.result);
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file content.'));
      };
      reader.readAsText(file);
    });
  }, []);

  /**
   * Handles file selection from input or drop.
   * Validates the file and reads its content.
   * @param {File} file - The selected file.
   */
  const handleFileSelected = useCallback(
    async (file) => {
      if (!file) {
        return;
      }

      // Reset previous state
      setUploadResult(null);
      setAlertMessage(null);
      setPipelineStages([]);

      // Validate file metadata
      const validation = validateFile({
        name: file.name,
        size: file.size,
        type: file.type,
      });

      setSelectedFile(file);
      setValidationResult(validation);

      if (!validation.valid) {
        setAlertMessage({
          type: 'error',
          message: validation.errors.join(' '),
          title: 'File Validation Failed',
        });
        setFileContent('');
        return;
      }

      try {
        const content = await readFileContent(file);
        setFileContent(content);
        setAlertMessage({
          type: 'success',
          message: `File "${file.name}" (${formatFileSize(file.size)}) is ready for upload.`,
          title: 'File Ready',
        });
      } catch (_err) {
        setAlertMessage({
          type: 'error',
          message: 'Failed to read file content. Please try again.',
          title: 'Read Error',
        });
        setFileContent('');
      }
    },
    [readFileContent]
  );

  /**
   * Handles file input change event.
   * @param {React.ChangeEvent<HTMLInputElement>} e - The change event.
   */
  const handleInputChange = useCallback(
    (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleFileSelected(file);
      }
      // Reset input value so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFileSelected]
  );

  /**
   * Handles click on the browse button to open file dialog.
   */
  const handleBrowseClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  /**
   * Handles drag over event on the drop zone.
   * @param {React.DragEvent} e - The drag event.
   */
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  /**
   * Handles drag leave event on the drop zone.
   * @param {React.DragEvent} e - The drag event.
   */
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  /**
   * Handles drop event on the drop zone.
   * @param {React.DragEvent} e - The drag event.
   */
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) {
        handleFileSelected(file);
      }
    },
    [handleFileSelected]
  );

  /**
   * Handles the status update callback from the processing pipeline.
   * @param {object} statusUpdate - The pipeline status update object.
   */
  const handleStatusUpdate = useCallback((statusUpdate) => {
    setPipelineStages((prev) => {
      const existingIndex = prev.findIndex(
        (s) => s.stage === statusUpdate.stage
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = statusUpdate;
        return updated;
      }
      return [...prev, statusUpdate];
    });
  }, []);

  /**
   * Handles the upload action.
   * Triggers the processing pipeline based on the selected upload source.
   */
  const handleUpload = useCallback(async () => {
    if (!selectedFile || !fileContent || isUploading) {
      return;
    }

    if (validationResult && !validationResult.valid) {
      setAlertMessage({
        type: 'error',
        message: 'Please select a valid file before uploading.',
        title: 'Invalid File',
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);
    setAlertMessage(null);
    setPipelineStages([]);

    const userId = currentUser ? currentUser.id : '';
    const userName = currentUser ? currentUser.name : '';

    try {
      let result;

      if (uploadSource === 'api') {
        const apiResponse = await mockApiUpload({
          filename: selectedFile.name,
          fileContent,
          userId,
          userName,
        });

        result = {
          success: apiResponse.status === 'success',
          fileId: apiResponse.data ? apiResponse.data.fileId : null,
          members: [],
          enrollments: [],
          integrationResults: [],
          stages: apiResponse.data ? apiResponse.data.stages || [] : [],
          errors: apiResponse.status === 'error' ? [apiResponse.message] : [],
          message: apiResponse.message,
        };
      } else if (uploadSource === 'sftp') {
        const sftpResponse = await mockSftpUpload({
          filename: selectedFile.name,
          fileContent,
          userId,
          userName,
        });

        result = {
          success: sftpResponse.status === 'success',
          fileId: sftpResponse.data ? sftpResponse.data.fileId : null,
          members: [],
          enrollments: [],
          integrationResults: [],
          stages: sftpResponse.data ? sftpResponse.data.stages || [] : [],
          errors: sftpResponse.status === 'error' ? [sftpResponse.message] : [],
          message: sftpResponse.message,
        };
      } else {
        // Web upload - direct pipeline processing
        const file = {
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
          rawContent: fileContent,
        };

        result = await processFile(file, {
          uploadSource: 'web',
          userId,
          userName,
          skipIntegration: false,
          onStatusUpdate: handleStatusUpdate,
        });
      }

      setUploadResult(result);

      if (result.success) {
        setAlertMessage({
          type: 'success',
          message: result.message || `File "${selectedFile.name}" processed successfully.`,
          title: 'Upload Complete',
        });
      } else {
        const errorMsg = result.errors && result.errors.length > 0
          ? result.errors.join(' ')
          : result.message || 'File processing failed.';
        setAlertMessage({
          type: 'error',
          message: errorMsg,
          title: 'Processing Failed',
        });
      }

      if (typeof onUploadComplete === 'function') {
        onUploadComplete(result);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during upload.';
      setAlertMessage({
        type: 'error',
        message: errorMessage,
        title: 'Upload Error',
      });
      setUploadResult({
        success: false,
        errors: [errorMessage],
      });
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, fileContent, isUploading, validationResult, uploadSource, currentUser, handleStatusUpdate, onUploadComplete]);

  /**
   * Clears the selected file and resets all state.
   */
  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setFileContent('');
    setValidationResult(null);
    setUploadResult(null);
    setAlertMessage(null);
    setPipelineStages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const maxFileSizeMB = MAX_FILE_SIZE_BYTES / (1024 * 1024);
  const isFileReady = selectedFile && fileContent && validationResult && validationResult.valid && !isUploading;

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Upload Source Selector */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Upload Source</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {UPLOAD_SOURCES.map((source) => (
            <button
              key={source.value}
              type="button"
              onClick={() => setUploadSource(source.value)}
              disabled={isUploading}
              className={`flex flex-col items-start p-3 rounded-lg border-2 transition-colors text-left ${
                uploadSource === source.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              } ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`text-sm font-medium ${
                  uploadSource === source.value ? 'text-primary-700' : 'text-gray-700'
                }`}
              >
                {source.label}
              </span>
              <span
                className={`text-xs mt-0.5 ${
                  uploadSource === source.value ? 'text-primary-600' : 'text-gray-500'
                }`}
              >
                {source.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Drag and Drop Zone */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Select File</h3>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center px-6 py-10 border-2 border-dashed rounded-lg transition-colors ${
            isDragOver
              ? 'border-primary-400 bg-primary-50'
              : selectedFile && validationResult && validationResult.valid
                ? 'border-success-300 bg-success-50'
                : selectedFile && validationResult && !validationResult.valid
                  ? 'border-error-300 bg-error-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          {/* Upload Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-10 w-10 mb-3 ${
              isDragOver
                ? 'text-primary-500'
                : selectedFile && validationResult && validationResult.valid
                  ? 'text-success-500'
                  : selectedFile && validationResult && !validationResult.valid
                    ? 'text-error-500'
                    : 'text-gray-400'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <p className="text-sm text-gray-600 mb-1">
            <span className="font-medium">Drag and drop</span> your EDI 834 file here, or
          </p>

          <button
            type="button"
            onClick={handleBrowseClick}
            disabled={isUploading}
            className="mt-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Browse Files
          </button>

          <p className="mt-3 text-xs text-gray-500">
            Supported formats: {SUPPORTED_FILE_EXTENSIONS.join(', ')} — Max size: {maxFileSizeMB} MB
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_EXTENSIONS}
            onChange={handleInputChange}
            className="hidden"
            aria-label="File upload input"
          />
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
        />
      )}

      {/* File Preview */}
      {selectedFile && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">File Preview</h3>
            <button
              type="button"
              onClick={handleClear}
              disabled={isUploading}
              className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          </div>

          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
            {/* File Icon */}
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

            {/* File Details */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {selectedFile.name}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <span className="text-xs text-gray-500">
                  Size: {formatFileSize(selectedFile.size)}
                </span>
                <span className="text-xs text-gray-500">
                  Type: {selectedFile.type || 'Unknown'}
                </span>
                {validationResult && (
                  <StatusBadge
                    status={validationResult.valid ? 'Active' : 'Failed'}
                    size="sm"
                  />
                )}
              </div>
              {validationResult && !validationResult.valid && (
                <div className="mt-2">
                  {validationResult.errors.map((error, index) => (
                    <p key={index} className="text-xs text-error-600">
                      • {error}
                    </p>
                  ))}
                </div>
              )}
              {fileContent && validationResult && validationResult.valid && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">
                    Content length: {fileContent.length.toLocaleString()} characters
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Upload Button */}
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={handleClear}
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!isFileReady}
              className="px-6 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
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
                  Processing...
                </span>
              ) : (
                `Upload via ${UPLOAD_SOURCES.find((s) => s.value === uploadSource)?.label || 'Web'}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Processing Progress */}
      {isUploading && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Processing Pipeline</h3>
          <div className="flex items-center justify-center py-4">
            <LoadingSpinner size="md" message="Processing file through pipeline..." />
          </div>
          {pipelineStages.length > 0 && (
            <div className="mt-4 space-y-2">
              {pipelineStages.map((stage, index) => (
                <div
                  key={`${stage.stage}-${index}`}
                  className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg"
                >
                  {stage.status === 'completed' && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-success-500 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                  {stage.status === 'started' && (
                    <svg
                      className="animate-spin h-4 w-4 text-primary-500 flex-shrink-0"
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
                  {stage.status === 'failed' && (
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700">
                      {stage.stage}
                    </p>
                    {stage.message && (
                      <p className="text-xs text-gray-500 truncate">
                        {stage.message}
                      </p>
                    )}
                  </div>
                  <StatusBadge
                    status={
                      stage.status === 'completed'
                        ? 'Completed'
                        : stage.status === 'started'
                          ? 'Processing'
                          : 'Failed'
                    }
                    size="sm"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Result Summary */}
      {uploadResult && !isUploading && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Processing Result</h3>
          <div
            className={`p-4 rounded-lg border ${
              uploadResult.success
                ? 'bg-success-50 border-success-200'
                : 'bg-error-50 border-error-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {uploadResult.success ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-success-500"
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
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-error-500"
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
              )}
              <span
                className={`text-sm font-semibold ${
                  uploadResult.success ? 'text-success-800' : 'text-error-800'
                }`}
              >
                {uploadResult.success ? 'Processing Completed Successfully' : 'Processing Failed'}
              </span>
            </div>

            {uploadResult.success && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {uploadResult.fileId && (
                  <div className="text-center p-2 bg-white rounded-md border border-success-100">
                    <p className="text-xs text-gray-500">File ID</p>
                    <p className="text-xs font-medium text-gray-800 truncate" title={uploadResult.fileId}>
                      {uploadResult.fileId.substring(0, 8)}...
                    </p>
                  </div>
                )}
                {Array.isArray(uploadResult.members) && (
                  <div className="text-center p-2 bg-white rounded-md border border-success-100">
                    <p className="text-xs text-gray-500">Members</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {uploadResult.members.length}
                    </p>
                  </div>
                )}
                {Array.isArray(uploadResult.enrollments) && (
                  <div className="text-center p-2 bg-white rounded-md border border-success-100">
                    <p className="text-xs text-gray-500">Enrollments</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {uploadResult.enrollments.length}
                    </p>
                  </div>
                )}
                {Array.isArray(uploadResult.integrationResults) && (
                  <div className="text-center p-2 bg-white rounded-md border border-success-100">
                    <p className="text-xs text-gray-500">Integrations</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {uploadResult.integrationResults.length}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!uploadResult.success && uploadResult.errors && uploadResult.errors.length > 0 && (
              <div className="mt-2 space-y-1">
                {uploadResult.errors.map((error, index) => (
                  <p key={index} className="text-xs text-error-700">
                    • {error}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Upload another file button */}
          <div className="flex items-center justify-end mt-4">
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              Upload Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

FileUpload.propTypes = {
  className: PropTypes.string,
  onUploadComplete: PropTypes.func,
};

FileUpload.defaultProps = {
  className: '',
  onUploadComplete: undefined,
};

export default FileUpload;