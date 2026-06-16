import { createContext, useContext, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAuthStore } from '../stores/authStore';

/**
 * @typedef {object} AuthContextValue
 * @property {{ id: string, name: string, role: string } | null} currentUser - The currently authenticated user.
 * @property {boolean} isAuthenticated - Whether a user is currently authenticated.
 * @property {(username: string, role: string) => { id: string, name: string, role: string }} login - Logs in a user with the given username and role.
 * @property {() => void} logout - Logs out the current user.
 * @property {(role: string) => { id: string, name: string, role: string } | null} switchRole - Switches the current user's role.
 * @property {(permission: string) => boolean} hasPermission - Checks if the current user has the specified permission.
 * @property {() => string[]} getPermissions - Returns all permissions for the current user's role.
 */

/** @type {import('react').Context<AuthContextValue | null>} */
const AuthContext = createContext(null);

/**
 * Custom hook to access the AuthContext.
 * Throws an error if used outside of an AuthProvider.
 * @returns {AuthContextValue} The auth context value.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}

/**
 * AuthProvider component that wraps the application and provides authentication
 * context values from the authStore.
 * @param {{ children: import('react').ReactNode }} props - The component props.
 * @returns {import('react').ReactElement} The provider-wrapped children.
 */
export function AuthProvider({ children }) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const storeLogin = useAuthStore((state) => state.login);
  const storeLogout = useAuthStore((state) => state.logout);
  const storeSwitchRole = useAuthStore((state) => state.switchRole);
  const storeHasPermission = useAuthStore((state) => state.hasPermission);
  const storeGetPermissions = useAuthStore((state) => state.getPermissions);

  const login = useCallback(
    (username, role) => {
      return storeLogin(username, role);
    },
    [storeLogin]
  );

  const logout = useCallback(() => {
    storeLogout();
  }, [storeLogout]);

  const switchRole = useCallback(
    (role) => {
      return storeSwitchRole(role);
    },
    [storeSwitchRole]
  );

  const hasPermission = useCallback(
    (permission) => {
      return storeHasPermission(permission);
    },
    [storeHasPermission]
  );

  const getPermissions = useCallback(() => {
    return storeGetPermissions();
  }, [storeGetPermissions]);

  const value = useMemo(
    () => ({
      currentUser,
      isAuthenticated,
      login,
      logout,
      switchRole,
      hasPermission,
      getPermissions,
    }),
    [currentUser, isAuthenticated, login, logout, switchRole, hasPermission, getPermissions]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * ProtectedRoute component that checks if the current user has the required
 * permission before rendering children. If the user is not authenticated,
 * renders a login prompt. If the user lacks the required permission, renders
 * an access denied message.
 *
 * @param {{ children: import('react').ReactNode, permission: string, fallback?: import('react').ReactNode }} props - The component props.
 * @returns {import('react').ReactElement} The children if authorized, or a fallback/access denied message.
 */
export function ProtectedRoute({ children, permission, fallback }) {
  const { isAuthenticated, hasPermission, currentUser } = useAuth();

  if (!isAuthenticated || !currentUser) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold text-warning-800 mb-2">
            Authentication Required
          </h2>
          <p className="text-warning-700 text-sm">
            Please log in to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (permission && !hasPermission(permission)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <div className="bg-error-50 border border-error-200 rounded-lg p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold text-error-800 mb-2">
            Access Denied
          </h2>
          <p className="text-error-700 text-sm">
            You do not have permission to access this page. Your current role is{' '}
            <span className="font-medium">{currentUser.role}</span>.
          </p>
          <p className="text-error-600 text-xs mt-2">
            Required permission: <span className="font-mono">{permission}</span>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  permission: PropTypes.string,
  fallback: PropTypes.node,
};

ProtectedRoute.defaultProps = {
  permission: '',
  fallback: null,
};

export { AuthContext };
export default AuthProvider;