import { useState, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Navigation items configuration.
 * Each item defines a route path, label, icon SVG path, and required permission.
 * @type {Array<{ path: string, label: string, icon: string, permission: string }>}
 */
const NAV_ITEMS = [
  {
    path: '/',
    label: 'Dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1',
    permission: 'view_dashboard',
  },
  {
    path: '/upload',
    label: 'File Upload',
    icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
    permission: 'upload_files',
  },
  {
    path: '/files',
    label: 'Files',
    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    permission: 'view_files',
  },
  {
    path: '/members',
    label: 'Members',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    permission: 'view_members',
  },
  {
    path: '/eligibility',
    label: 'Eligibility Rules',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    permission: 'view_members',
  },
  {
    path: '/enrollments',
    label: 'Enrollments',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    permission: 'process_enrollment',
  },
  {
    path: '/integration',
    label: 'Integration',
    icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    permission: 'view_system_status',
  },
  {
    path: '/audit',
    label: 'Audit Logs',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    permission: 'view_audit_logs',
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    permission: 'manage_settings',
  },
];

/**
 * Sidebar navigation item component.
 * Renders a NavLink with an icon and label, highlighting the active route.
 *
 * @param {{ path: string, label: string, icon: string, collapsed: boolean, onClick?: () => void }} props
 * @returns {import('react').ReactElement}
 */
function SidebarItem({ path, label, icon, collapsed, onClick }) {
  return (
    <NavLink
      to={path}
      end={path === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary-100 text-primary-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        } ${collapsed ? 'justify-center' : ''}`
      }
      title={collapsed ? label : undefined}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

SidebarItem.propTypes = {
  path: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  collapsed: PropTypes.bool,
  onClick: PropTypes.func,
};

SidebarItem.defaultProps = {
  collapsed: false,
  onClick: undefined,
};

/**
 * Sidebar navigation component.
 * Displays navigation links filtered by the current user's role permissions.
 * Collapsible on mobile via a hamburger toggle button.
 *
 * @param {{ className?: string }} props
 * @returns {import('react').ReactElement}
 */
export function Sidebar({ className }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { hasPermission, isAuthenticated, currentUser } = useAuth();
  const location = useLocation();

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  if (!isAuthenticated || !currentUser) {
    return null;
  }

  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(item.permission));

  const navContent = (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {visibleItems.map((item) => (
        <SidebarItem
          key={item.path}
          path={item.path}
          label={item.label}
          icon={item.icon}
          collapsed={collapsed}
          onClick={closeMobile}
        />
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        type="button"
        onClick={toggleMobile}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-white shadow-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {mobileOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black bg-opacity-50 transition-opacity"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-800 truncate">
            {currentUser.name}
          </span>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {currentUser.role}
          </span>
        </div>
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 z-20 bg-white border-r border-gray-200 transition-all duration-200 ${
          collapsed ? 'lg:w-16' : 'lg:w-60'
        } ${className || ''}`}
      >
        <div className={`flex items-center h-14 px-4 border-b border-gray-200 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <span className="text-sm font-semibold text-gray-800 truncate">
              Medicaid Portal
            </span>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {!collapsed && (
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-xs font-semibold text-primary-700">
                {(currentUser.name || '').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {currentUser.name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {currentUser.role}
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {navContent}
        </div>

        {!collapsed && (
          <div className="px-4 py-3 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">
              © {new Date().getFullYear()} Medicaid Portal
            </p>
          </div>
        )}
      </aside>
    </>
  );
}

Sidebar.propTypes = {
  className: PropTypes.string,
};

Sidebar.defaultProps = {
  className: '',
};

export default Sidebar;