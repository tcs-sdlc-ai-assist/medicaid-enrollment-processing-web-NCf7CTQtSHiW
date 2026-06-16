import { useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FileDetails } from '../components/files/FileDetails';

/**
 * FileDetailPage component.
 * Page wrapper for the FileDetails component. Reads the file ID from URL params
 * and passes it to FileDetails. Shows breadcrumb navigation back to the file list.
 *
 * @returns {import('react').ReactElement}
 */
export function FileDetailPage() {
  const { fileId } = useParams();
  const navigate = useNavigate();

  /**
   * Handles closing the file detail view by navigating back to the files list.
   */
  const handleClose = useCallback(() => {
    navigate('/files');
  }, [navigate]);

  /**
   * Handles retry completion callback.
   * @param {object} result - The retry result from the processing pipeline.
   */
  const handleRetryComplete = useCallback((_result) => {
    // Stay on the detail page after retry to show updated status
  }, []);

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
        <Link
          to="/"
          className="text-gray-500 hover:text-primary-600 transition-colors"
        >
          Dashboard
        </Link>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-gray-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <Link
          to="/files"
          className="text-gray-500 hover:text-primary-600 transition-colors"
        >
          Files
        </Link>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-gray-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-800 font-medium truncate max-w-[200px]" title={fileId || ''}>
          {fileId ? `${fileId.substring(0, 12)}...` : 'File Details'}
        </span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">File Details</h1>
          <p className="text-sm text-gray-500 mt-1">
            View file metadata, processing timeline, validation results, and parsed member data.
          </p>
        </div>

        <button
          type="button"
          onClick={handleClose}
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Files
        </button>
      </div>

      {/* File Details Component */}
      <FileDetails
        fileId={fileId}
        onClose={handleClose}
        onRetryComplete={handleRetryComplete}
      />
    </div>
  );
}

export default FileDetailPage;