import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { STORAGE_KEYS } from '../utils/constants';
import { loadState, saveState } from '../utils/localStorage';

const AUDIT_LOGS_KEY = STORAGE_KEYS.SETTINGS.replace('settings', 'audit_logs');
const ERROR_LOGS_KEY = STORAGE_KEYS.SETTINGS.replace('settings', 'error_logs');

/**
 * Loads persisted audit logs from localStorage.
 * @returns {Array<object>} The stored audit logs or empty array.
 */
function loadAuditLogs() {
  const data = loadState(AUDIT_LOGS_KEY);
  return Array.isArray(data) ? data : [];
}

/**
 * Loads persisted error logs from localStorage.
 * @returns {Array<object>} The stored error logs or empty array.
 */
function loadErrorLogs() {
  const data = loadState(ERROR_LOGS_KEY);
  return Array.isArray(data) ? data : [];
}

/**
 * Persists audit logs to localStorage.
 * @param {Array<object>} logs - The audit logs to persist.
 */
function persistAuditLogs(logs) {
  saveState(AUDIT_LOGS_KEY, logs);
}

/**
 * Persists error logs to localStorage.
 * @param {Array<object>} logs - The error logs to persist.
 */
function persistErrorLogs(logs) {
  saveState(ERROR_LOGS_KEY, logs);
}

/**
 * Filters an array of log entries based on the provided filter criteria.
 * @param {Array<object>} logs - The logs to filter.
 * @param {object} [filters] - Optional filter criteria.
 * @param {string} [filters.action] - Filter by action type.
 * @param {string} [filters.entityId] - Filter by entity ID.
 * @param {string} [filters.userId] - Filter by user ID.
 * @param {string} [filters.startDate] - Filter logs on or after this ISO date.
 * @param {string} [filters.endDate] - Filter logs on or before this ISO date.
 * @param {string} [filters.errorType] - Filter by error type.
 * @param {string} [filters.fileId] - Filter by file ID.
 * @param {string} [filters.memberId] - Filter by member ID.
 * @returns {Array<object>} The filtered logs.
 */
function applyFilters(logs, filters) {
  if (!filters || typeof filters !== 'object') {
    return logs;
  }

  let filtered = [...logs];

  if (filters.action) {
    filtered = filtered.filter((log) => log.action === filters.action);
  }

  if (filters.entityId) {
    filtered = filtered.filter((log) => log.entityId === filters.entityId);
  }

  if (filters.userId) {
    filtered = filtered.filter((log) => log.userId === filters.userId);
  }

  if (filters.errorType) {
    filtered = filtered.filter((log) => log.errorType === filters.errorType);
  }

  if (filters.fileId) {
    filtered = filtered.filter((log) => log.fileId === filters.fileId);
  }

  if (filters.memberId) {
    filtered = filtered.filter((log) => log.memberId === filters.memberId);
  }

  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    if (!isNaN(start)) {
      filtered = filtered.filter((log) => new Date(log.timestamp).getTime() >= start);
    }
  }

  if (filters.endDate) {
    const end = new Date(filters.endDate).getTime();
    if (!isNaN(end)) {
      filtered = filtered.filter((log) => new Date(log.timestamp).getTime() <= end);
    }
  }

  return filtered;
}

export const useAuditStore = create((set, get) => ({
  auditLogs: loadAuditLogs(),
  errorLogs: loadErrorLogs(),

  /**
   * Logs an action to the audit trail.
   * @param {string} action - The action performed (e.g., "File Uploaded", "Eligibility Determined").
   * @param {string} entityId - The ID of the related entity (fileId, memberId, etc.).
   * @param {string} userId - The ID of the user who performed the action.
   * @param {object} [details] - Optional additional details about the action.
   */
  logAction: (action, entityId, userId, details = null) => {
    const entry = {
      logId: uuidv4(),
      action: action || '',
      entityId: entityId || '',
      userId: userId || '',
      timestamp: new Date().toISOString(),
      details: details || null,
    };

    set((state) => {
      const updatedLogs = [entry, ...state.auditLogs];
      persistAuditLogs(updatedLogs);
      return { auditLogs: updatedLogs };
    });

    return entry;
  },

  /**
   * Logs an error to the error log.
   * @param {string} errorType - The type/category of the error (e.g., "ValidationError", "ParsingError").
   * @param {string} message - A descriptive error message.
   * @param {string} [fileId] - Optional file ID associated with the error.
   * @param {string} [memberId] - Optional member ID associated with the error.
   */
  logError: (errorType, message, fileId = null, memberId = null) => {
    const entry = {
      logId: uuidv4(),
      errorType: errorType || '',
      message: message || '',
      fileId: fileId || null,
      memberId: memberId || null,
      timestamp: new Date().toISOString(),
    };

    set((state) => {
      const updatedErrorLogs = [entry, ...state.errorLogs];
      persistErrorLogs(updatedErrorLogs);

      // Also add to audit logs as an error action
      const auditEntry = {
        logId: uuidv4(),
        action: `Error: ${errorType || 'Unknown'}`,
        entityId: fileId || memberId || '',
        userId: '',
        timestamp: entry.timestamp,
        details: {
          errorType: entry.errorType,
          message: entry.message,
          fileId: entry.fileId,
          memberId: entry.memberId,
        },
      };
      const updatedAuditLogs = [auditEntry, ...state.auditLogs];
      persistAuditLogs(updatedAuditLogs);

      return {
        errorLogs: updatedErrorLogs,
        auditLogs: updatedAuditLogs,
      };
    });

    return entry;
  },

  /**
   * Retrieves audit logs, optionally filtered by the provided criteria.
   * @param {object} [filters] - Optional filter criteria.
   * @param {string} [filters.action] - Filter by action type.
   * @param {string} [filters.entityId] - Filter by entity ID.
   * @param {string} [filters.userId] - Filter by user ID.
   * @param {string} [filters.startDate] - Filter logs on or after this ISO date.
   * @param {string} [filters.endDate] - Filter logs on or before this ISO date.
   * @returns {Array<object>} The filtered audit logs.
   */
  getLogs: (filters) => {
    const { auditLogs } = get();
    return applyFilters(auditLogs, filters);
  },

  /**
   * Retrieves error logs, optionally filtered by the provided criteria.
   * @param {object} [filters] - Optional filter criteria.
   * @param {string} [filters.errorType] - Filter by error type.
   * @param {string} [filters.fileId] - Filter by file ID.
   * @param {string} [filters.memberId] - Filter by member ID.
   * @param {string} [filters.startDate] - Filter logs on or after this ISO date.
   * @param {string} [filters.endDate] - Filter logs on or before this ISO date.
   * @returns {Array<object>} The filtered error logs.
   */
  getErrorLogs: (filters) => {
    const { errorLogs } = get();
    return applyFilters(errorLogs, filters);
  },

  /**
   * Clears all audit logs and error logs from state and localStorage.
   */
  clearLogs: () => {
    set({ auditLogs: [], errorLogs: [] });
    persistAuditLogs([]);
    persistErrorLogs([]);
  },

  /**
   * Exports all audit logs and error logs as a JSON string.
   * @returns {string} A JSON string containing both auditLogs and errorLogs.
   */
  exportLogs: () => {
    const { auditLogs, errorLogs } = get();
    const exportData = {
      exportedAt: new Date().toISOString(),
      auditLogs,
      errorLogs,
    };
    return JSON.stringify(exportData, null, 2);
  },
}));

/**
 * Standalone logAction function for use outside of React components.
 * @param {string} action - The action performed.
 * @param {string} entityId - The ID of the related entity.
 * @param {string} userId - The ID of the user.
 * @param {object} [details] - Optional additional details.
 * @returns {object} The created audit log entry.
 */
export function logAction(action, entityId, userId, details) {
  return useAuditStore.getState().logAction(action, entityId, userId, details);
}

/**
 * Standalone logError function for use outside of React components.
 * @param {string} errorType - The type/category of the error.
 * @param {string} message - A descriptive error message.
 * @param {string} [fileId] - Optional file ID.
 * @param {string} [memberId] - Optional member ID.
 * @returns {object} The created error log entry.
 */
export function logError(errorType, message, fileId, memberId) {
  return useAuditStore.getState().logError(errorType, message, fileId, memberId);
}

/**
 * Standalone getLogs function for use outside of React components.
 * @param {object} [filters] - Optional filter criteria.
 * @returns {Array<object>} The filtered audit logs.
 */
export function getLogs(filters) {
  return useAuditStore.getState().getLogs(filters);
}