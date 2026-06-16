import { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';
import { USER_ROLES } from '../../utils/constants';
import { useAuditStore } from '../../stores/auditStore';

/**
 * Available roles for the role switcher dropdown.
 * @type {Array<{ value: string, label: string }>}
 */
const ROLE_OPTIONS = [
  { value: USER_ROLES.ENROLLMENT_TEAM, label: 'Enrollment Team' },
  { value: USER_ROLES.IT, label: 'IT' },
  { value: USER_ROLES.COMPLIANCE, label: 'Compliance' },
  { value: USER_ROLES.ADMIN, label: 'Admin' },
];

/**
 * Maps role values to badge color classes.
 * @param {string} role - The user role string.
 * @returns {string} Tailwind CSS classes for the role badge.
 */
function getRoleBadgeClasses(role) {
  switch (role) {
    case USER_ROLES.ADMIN:
      return 'bg-error-100 text-error-700';
    case USER_ROLES.IT:
      return 'bg-primary-100 text-primary-700';
    case USER_ROLES.COMPLIANCE:
      return 'bg-warning-100 text-warning-700';
    case USER_ROLES.ENROLLMENT_TEAM:
      return 'bg-success-100 text-success-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Header component.
 * Displays the application title, current user info with role badge,
 * a role switcher dropdown, notification bell icon with count, and logout button.
 *
 * @param {{ className?: string }} props
 * @returns {import('react').ReactElement}
 */
export function Header({ className }) {
  const { currentUser, isAuthenticated, switchRole, logout } = useAuth();
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const roleSwitcherRef = useRef(null);
  const notificationRef = useRef(null);

  const errorLogs = useAuditStore((state) => state.errorLogs);
  const notificationCount = errorLogs.length > 99 ? 99 : errorLogs.length;

  const appTitle = import.meta.env.VITE_APP_TITLE || 'Medicaid Enrollment Portal';

  const toggleRoleSwitcher = useCallback(() => {
    setRoleSwitcherOpen((prev) => !prev);
    setNotificationOpen(false);
  }, []);

  const toggleNotification = useCallback(() => {
    setNotificationOpen((prev) => !prev);
    setRoleSwitcherOpen(false);
  }, []);

  const handleRoleSwitch = useCallback(
    (role) => {
      switchRole(role);
      setRoleSwitcherOpen(false);
    },
    [switchRole]
  );

  const handleLogout = useCallback(() => {
    setRoleSwitcherOpen(false);
    setNotificationOpen(false);
    logout();
  }, [logout]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        roleSwitcherRef.current &&
        !roleSwitcherRef.current.contains(event.target)
      ) {
        setRoleSwitcherOpen(false);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setNotificationOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!isAuthenticated || !currentUser) {
    return (
      <header
        className={`sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200 shadow-sm ${className || ''}`}
      >
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-primary-600"
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
          <h1 className="text-lg font-semibold text-gray-800">{appTitle}</h1>
        </div>
      </header>
    );
  }

  const recentErrors = errorLogs.slice(0, 5);

  return (
    <header
      className={`sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200 shadow-sm ${className || ''}`}
    >
      {/* Left section: App title */}
      <div className="flex items-center gap-2 pl-10 lg:pl-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-primary-600 flex-shrink-0"
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
        <h1 className="text-lg font-semibold text-gray-800 hidden sm:block">
          {appTitle}
        </h1>
        <h1 className="text-lg font-semibold text-gray-800 sm:hidden">
          Medicaid
        </h1>
      </div>

      {/* Right section: User info, role switcher, notifications, logout */}
      <div className="flex items-center gap-3">
        {/* User name and role badge */}
        <div className="hidden md:flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 truncate max-w-[150px]">
            {currentUser.name}
          </span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${getRoleBadgeClasses(currentUser.role)}`}
          >
            {currentUser.role}
          </span>
        </div>

        {/* Role switcher dropdown */}
        <div className="relative" ref={roleSwitcherRef}>
          <button
            type="button"
            onClick={toggleRoleSwitcher}
            className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Switch role"
            aria-expanded={roleSwitcherOpen}
            aria-haspopup="listbox"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform ${roleSwitcherOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {roleSwitcherOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Switch Role
                </p>
              </div>
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleRoleSwitch(option.value)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    currentUser.role === option.value
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  role="option"
                  aria-selected={currentUser.role === option.value}
                >
                  <div className="flex items-center justify-between">
                    <span>{option.label}</span>
                    {currentUser.role === option.value && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-primary-600"
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
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notification bell */}
        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={toggleNotification}
            className="relative p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount})` : ''}`}
            aria-expanded={notificationOpen}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-[16px] px-1 text-[10px] font-bold text-white bg-error-500 rounded-full">
                {notificationCount}
              </span>
            )}
          </button>

          {notificationOpen && (
            <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Notifications
                </p>
                {notificationCount > 0 && (
                  <span className="text-xs text-gray-400">
                    {errorLogs.length} error{errorLogs.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {recentErrors.length === 0 ? (
                  <div className="px-3 py-4 text-center">
                    <p className="text-sm text-gray-500">No notifications</p>
                  </div>
                ) : (
                  recentErrors.map((error) => (
                    <div
                      key={error.logId}
                      className="px-3 py-2 border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-2">
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
                            {error.timestamp
                              ? new Date(error.timestamp).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {recentErrors.length > 0 && (
                <div className="px-3 py-2 border-t border-gray-100 text-center">
                  <span className="text-xs text-primary-600 font-medium">
                    View all in Audit Logs
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Logout button */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:text-error-700 hover:bg-error-50 rounded-md transition-colors"
          aria-label="Logout"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}

Header.propTypes = {
  className: PropTypes.string,
};

Header.defaultProps = {
  className: '',
};

export default Header;