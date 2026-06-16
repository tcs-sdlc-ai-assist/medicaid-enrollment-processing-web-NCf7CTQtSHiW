import { useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { EnrollmentDetail } from '../components/enrollments/EnrollmentDetail';

/**
 * EnrollmentDetailPage component.
 * Page wrapper for the EnrollmentDetail component. Reads the enrollment ID from URL params
 * and passes it to EnrollmentDetail. Shows breadcrumb navigation back to the enrollments list.
 *
 * @returns {import('react').ReactElement}
 */
export function EnrollmentDetailPage() {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();

  /**
   * Handles closing the enrollment detail view by navigating back to the enrollments list.
   */
  const handleClose = useCallback(() => {
    navigate('/enrollments');
  }, [navigate]);

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
          to="/enrollments"
          className="text-gray-500 hover:text-primary-600 transition-colors"
        >
          Enrollments
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
        <span className="text-gray-800 font-medium truncate max-w-[200px]" title={enrollmentId || ''}>
          {enrollmentId ? `${enrollmentId.substring(0, 12)}${enrollmentId.length > 12 ? '...' : ''}` : 'Enrollment Details'}
        </span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enrollment Details</h1>
          <p className="text-sm text-gray-500 mt-1">
            View enrollment information, member details, plan coverage, and enrollment history timeline.
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
          Back to Enrollments
        </button>
      </div>

      {/* Enrollment Detail Component */}
      <EnrollmentDetail
        enrollmentId={enrollmentId}
        onClose={handleClose}
      />
    </div>
  );
}

export default EnrollmentDetailPage;