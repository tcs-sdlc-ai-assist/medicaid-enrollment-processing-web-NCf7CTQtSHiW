import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { USER_ROLES, STORAGE_KEYS } from '../utils/constants';
import { loadState, saveState, removeState } from '../utils/localStorage';

/**
 * Role-permission mappings for the application.
 * Each role has a set of permissions that define what actions the user can perform.
 * @type {Object<string, string[]>}
 */
const ROLE_PERMISSIONS = Object.freeze({
  [USER_ROLES.ENROLLMENT_TEAM]: [
    'view_dashboard',
    'upload_files',
    'view_files',
    'view_members',
    'edit_members',
    'process_enrollment',
    'view_reports',
    'export_data',
  ],
  [USER_ROLES.IT]: [
    'view_dashboard',
    'upload_files',
    'view_files',
    'delete_files',
    'view_members',
    'view_reports',
    'view_audit_logs',
    'view_error_logs',
    'manage_settings',
    'export_data',
    'view_system_status',
  ],
  [USER_ROLES.COMPLIANCE]: [
    'view_dashboard',
    'view_files',
    'view_members',
    'view_reports',
    'view_audit_logs',
    'view_error_logs',
    'export_data',
    'view_encryption_status',
    'generate_compliance_reports',
  ],
  [USER_ROLES.ADMIN]: [
    'view_dashboard',
    'upload_files',
    'view_files',
    'delete_files',
    'view_members',
    'edit_members',
    'delete_members',
    'process_enrollment',
    'view_reports',
    'view_audit_logs',
    'view_error_logs',
    'clear_audit_logs',
    'manage_settings',
    'export_data',
    'view_system_status',
    'view_encryption_status',
    'generate_compliance_reports',
    'manage_users',
  ],
});

/**
 * Loads the persisted user profile from localStorage.
 * @returns {{ id: string, name: string, role: string } | null} The stored user profile or null.
 */
function loadUserProfile() {
  const profile = loadState(STORAGE_KEYS.USER_PROFILE);
  if (profile && typeof profile === 'object' && profile.id && profile.name && profile.role) {
    return profile;
  }
  return null;
}

/**
 * Persists the user profile to localStorage.
 * @param {{ id: string, name: string, role: string } | null} user - The user profile to persist.
 */
function persistUserProfile(user) {
  if (user) {
    saveState(STORAGE_KEYS.USER_PROFILE, user);
    saveState(STORAGE_KEYS.USER_ROLE, user.role);
  } else {
    removeState(STORAGE_KEYS.USER_PROFILE);
    removeState(STORAGE_KEYS.USER_ROLE);
  }
}

const initialUser = loadUserProfile();

export const useAuthStore = create((set, get) => ({
  currentUser: initialUser,
  isAuthenticated: initialUser !== null,

  /**
   * Simulates logging in a user with the given username and role.
   * @param {string} username - The username for the simulated user.
   * @param {string} role - The role to assign (should be one of USER_ROLES values).
   * @returns {{ id: string, name: string, role: string }} The created user profile.
   */
  login: (username, role) => {
    const validRole = Object.values(USER_ROLES).includes(role) ? role : USER_ROLES.ENROLLMENT_TEAM;

    const user = {
      id: uuidv4(),
      name: username || 'Anonymous User',
      role: validRole,
    };

    persistUserProfile(user);

    set({
      currentUser: user,
      isAuthenticated: true,
    });

    return user;
  },

  /**
   * Logs out the current user and clears persisted auth state.
   */
  logout: () => {
    persistUserProfile(null);

    set({
      currentUser: null,
      isAuthenticated: false,
    });
  },

  /**
   * Switches the current user's role to the specified role.
   * Only works if a user is currently authenticated.
   * @param {string} role - The new role to assign (should be one of USER_ROLES values).
   * @returns {{ id: string, name: string, role: string } | null} The updated user profile, or null if not authenticated.
   */
  switchRole: (role) => {
    const { currentUser, isAuthenticated } = get();

    if (!isAuthenticated || !currentUser) {
      return null;
    }

    const validRole = Object.values(USER_ROLES).includes(role) ? role : currentUser.role;

    const updatedUser = {
      ...currentUser,
      role: validRole,
    };

    persistUserProfile(updatedUser);

    set({
      currentUser: updatedUser,
    });

    return updatedUser;
  },

  /**
   * Checks whether the current user has the specified permission.
   * @param {string} permission - The permission string to check.
   * @returns {boolean} True if the current user's role includes the permission, false otherwise.
   */
  hasPermission: (permission) => {
    const { currentUser, isAuthenticated } = get();

    if (!isAuthenticated || !currentUser) {
      return false;
    }

    const permissions = ROLE_PERMISSIONS[currentUser.role];

    if (!permissions) {
      return false;
    }

    return permissions.includes(permission);
  },

  /**
   * Returns all permissions for the current user's role.
   * @returns {string[]} An array of permission strings, or empty array if not authenticated.
   */
  getPermissions: () => {
    const { currentUser, isAuthenticated } = get();

    if (!isAuthenticated || !currentUser) {
      return [];
    }

    return ROLE_PERMISSIONS[currentUser.role] || [];
  },
}));

/**
 * Standalone login function for use outside of React components.
 * @param {string} username - The username for the simulated user.
 * @param {string} role - The role to assign.
 * @returns {{ id: string, name: string, role: string }} The created user profile.
 */
export function login(username, role) {
  return useAuthStore.getState().login(username, role);
}

/**
 * Standalone logout function for use outside of React components.
 */
export function logout() {
  return useAuthStore.getState().logout();
}

/**
 * Standalone switchRole function for use outside of React components.
 * @param {string} role - The new role to assign.
 * @returns {{ id: string, name: string, role: string } | null} The updated user profile.
 */
export function switchRole(role) {
  return useAuthStore.getState().switchRole(role);
}

/**
 * Standalone hasPermission function for use outside of React components.
 * @param {string} permission - The permission string to check.
 * @returns {boolean} True if the current user has the permission.
 */
export function hasPermission(permission) {
  return useAuthStore.getState().hasPermission(permission);
}

export { ROLE_PERMISSIONS };