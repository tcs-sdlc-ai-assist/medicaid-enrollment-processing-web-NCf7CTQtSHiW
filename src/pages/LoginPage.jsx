import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { USER_ROLES } from '../utils/constants';
import { AlertMessage } from '../components/common/AlertMessage';

/**
 * Available role options for the login form.
 * @type {Array<{ value: string, label: string, description: string }>}
 */
const ROLE_OPTIONS = [
  {
    value: USER_ROLES.ENROLLMENT_TEAM,
    label: 'Enrollment Team',
    description: 'Upload files, view members, process enrollments, export data',
  },
  {
    value: USER_ROLES.IT,
    label: 'IT',
    description: 'System status, audit logs, settings management, file operations',
  },
  {
    value: USER_ROLES.COMPLIANCE,
    label: 'Compliance',
    description: 'Audit logs, compliance reports, encryption status, data export',
  },
  {
    value: USER_ROLES.ADMIN,
    label: 'Admin',
    description: 'Full access to all features including user management',
  },
];

/**
 * Maps role values to icon SVG path strings.
 * @param {string} role - The user role string.
 * @returns {string} SVG path data string.
 */
function getRoleIconPath(role) {
  switch (role) {
    case USER_ROLES.ENROLLMENT_TEAM:
      return 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01';
    case USER_ROLES.IT:
      return 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z';
    case USER_ROLES.COMPLIANCE:
      return 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z';
    case USER_ROLES.ADMIN:
      return 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z';
    default:
      return 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
  }
}

/**
 * Maps role values to Tailwind CSS color classes.
 * @param {string} role - The user role string.
 * @returns {{ bg: string, text: string, border: string, selectedBg: string, selectedBorder: string }} Tailwind CSS classes.
 */
function getRoleColorClasses(role) {
  switch (role) {
    case USER_ROLES.ENROLLMENT_TEAM:
      return {
        bg: 'bg-success-50',
        text: 'text-success-700',
        border: 'border-success-200',
        selectedBg: 'bg-success-100',
        selectedBorder: 'border-success-500',
      };
    case USER_ROLES.IT:
      return {
        bg: 'bg-primary-50',
        text: 'text-primary-700',
        border: 'border-primary-200',
        selectedBg: 'bg-primary-100',
        selectedBorder: 'border-primary-500',
      };
    case USER_ROLES.COMPLIANCE:
      return {
        bg: 'bg-warning-50',
        text: 'text-warning-700',
        border: 'border-warning-200',
        selectedBg: 'bg-warning-100',
        selectedBorder: 'border-warning-500',
      };
    case USER_ROLES.ADMIN:
      return {
        bg: 'bg-error-50',
        text: 'text-error-700',
        border: 'border-error-200',
        selectedBg: 'bg-error-100',
        selectedBorder: 'border-error-500',
      };
    default:
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        border: 'border-gray-200',
        selectedBg: 'bg-gray-100',
        selectedBorder: 'border-gray-500',
      };
  }
}

/**
 * LoginPage component.
 * Simulated login page for RBAC demonstration. Provides username input and
 * role selector dropdown (EnrollmentTeam, IT, Compliance, Admin). On submit,
 * sets user in authStore and redirects to dashboard. Shows disclaimer that
 * this is a simulated login.
 *
 * @returns {import('react').ReactElement}
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [username, setUsername] = useState('');
  const [selectedRole, setSelectedRole] = useState(USER_ROLES.ENROLLMENT_TEAM);
  const [alertMessage, setAlertMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handles username input change.
   * @param {React.ChangeEvent<HTMLInputElement>} e - The change event.
   */
  const handleUsernameChange = useCallback((e) => {
    setUsername(e.target.value);
    setAlertMessage(null);
  }, []);

  /**
   * Handles role selection.
   * @param {string} role - The selected role value.
   */
  const handleRoleSelect = useCallback((role) => {
    setSelectedRole(role);
    setAlertMessage(null);
  }, []);

  /**
   * Handles form submission.
   * @param {React.FormEvent} e - The form event.
   */
  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();

      const trimmedUsername = username.trim();

      if (!trimmedUsername) {
        setAlertMessage({
          type: 'error',
          message: 'Please enter a username to continue.',
          title: 'Username Required',
        });
        return;
      }

      if (trimmedUsername.length < 2) {
        setAlertMessage({
          type: 'error',
          message: 'Username must be at least 2 characters long.',
          title: 'Invalid Username',
        });
        return;
      }

      setIsSubmitting(true);

      try {
        login(trimmedUsername, selectedRole);

        setAlertMessage({
          type: 'success',
          message: `Welcome, ${trimmedUsername}! Redirecting to dashboard...`,
          title: 'Login Successful',
        });

        // Short delay before redirect for UX
        setTimeout(() => {
          navigate('/');
        }, 500);
      } catch (_err) {
        setAlertMessage({
          type: 'error',
          message: 'An error occurred during login. Please try again.',
          title: 'Login Failed',
        });
        setIsSubmitting(false);
      }
    },
    [username, selectedRole, login, navigate]
  );

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    navigate('/');
    return null;
  }

  const appTitle = import.meta.env.VITE_APP_TITLE || 'Medicaid Enrollment Portal';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center justify-center h-14 w-14 rounded-full bg-primary-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-primary-600"
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
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{appTitle}</h1>
          <p className="text-sm text-gray-500 mt-2">
            Sign in to access the enrollment management system
          </p>
        </div>

        {/* Disclaimer Banner */}
        <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-primary-500 flex-shrink-0 mt-0.5"
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
            <div>
              <p className="text-xs font-semibold text-primary-800">Simulated Login</p>
              <p className="text-xs text-primary-700 mt-0.5">
                This is a demonstration login for role-based access control (RBAC). No real
                authentication is performed. Select a role to explore different permission levels.
              </p>
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
            autoDismissMs={alertMessage.type === 'success' ? 3000 : 0}
          />
        )}

        {/* Login Form */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Input */}
            <div>
              <label
                htmlFor="login-username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="Enter your name"
                  disabled={isSubmitting}
                  autoComplete="username"
                  autoFocus
                  className={`w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                    isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter any name — this is a simulated login.
              </p>
            </div>

            {/* Role Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Role
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLE_OPTIONS.map((option) => {
                  const isSelected = selectedRole === option.value;
                  const colorClasses = getRoleColorClasses(option.value);
                  const iconPath = getRoleIconPath(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleRoleSelect(option.value)}
                      disabled={isSubmitting}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? `${colorClasses.selectedBg} ${colorClasses.selectedBorder}`
                          : `bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50`
                      } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      aria-pressed={isSelected}
                    >
                      <div
                        className={`flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg ${
                          isSelected ? colorClasses.selectedBg : colorClasses.bg
                        }`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-4 w-4 ${colorClasses.text}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={iconPath}
                          />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-sm font-medium ${
                              isSelected ? colorClasses.text : 'text-gray-800'
                            }`}
                          >
                            {option.label}
                          </span>
                          {isSelected && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className={`h-4 w-4 ${colorClasses.text}`}
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
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {option.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
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
                  Signing in...
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
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign In as {ROLE_OPTIONS.find((r) => r.value === selectedRole)?.label || 'User'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Role Permissions Summary */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
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
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Role-Based Access Control
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Each role has different permissions. You can switch roles at any time from the header after logging in.
          </p>
          <div className="space-y-2">
            {ROLE_OPTIONS.map((option) => {
              const colorClasses = getRoleColorClasses(option.value);
              return (
                <div
                  key={option.value}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${colorClasses.bg} ${colorClasses.text}`}
                  >
                    {option.label}
                  </span>
                  <span className="text-xs text-gray-500 truncate">
                    {option.description}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} {appTitle}. Demonstration purposes only.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;