import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * NotFoundPage component.
 * 404 Not Found page with a message and link back to the dashboard.
 * Shows a friendly error illustration, descriptive text, and navigation options.
 *
 * @returns {import('react').ReactElement}
 */
export function NotFoundPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  /**
   * Handles navigating back to the previous page.
   */
  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16">
      <div className="text-center max-w-md">
        {/* 404 Illustration */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center justify-center h-24 w-24 rounded-full bg-primary-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-primary-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Error Code */}
        <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>

        {/* Error Title */}
        <h2 className="text-xl font-semibold text-gray-800 mb-3">Page Not Found</h2>

        {/* Error Description */}
        <p className="text-sm text-gray-500 mb-8">
          The page you are looking for does not exist or has been moved.
          Please check the URL or navigate back to the dashboard.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-6 py-2.5 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
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
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"
              />
            </svg>
            Go to Dashboard
          </Link>

          <button
            type="button"
            onClick={handleGoBack}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Go Back
          </button>
        </div>

        {/* Additional Help */}
        <div className="mt-10 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            If you believe this is an error, please contact your system administrator.
          </p>
          {!isAuthenticated && (
            <p className="text-xs text-gray-400 mt-2">
              You may need to{' '}
              <Link
                to="/login"
                className="text-primary-600 hover:text-primary-700 font-medium underline transition-colors"
              >
                sign in
              </Link>{' '}
              to access this page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;