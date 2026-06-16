import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { MEMBER_STATUS, STORAGE_KEYS } from '../utils/constants';
import { loadState, saveState } from '../utils/localStorage';

const ENROLLMENTS_KEY = STORAGE_KEYS.SETTINGS.replace('settings', 'enrollments');

/**
 * Loads persisted enrollments from localStorage.
 * @returns {Array<object>} The stored enrollments or empty array.
 */
function loadEnrollments() {
  const data = loadState(ENROLLMENTS_KEY);
  return Array.isArray(data) ? data : [];
}

/**
 * Persists enrollments to localStorage.
 * @param {Array<object>} enrollments - The enrollments to persist.
 */
function persistEnrollments(enrollments) {
  saveState(ENROLLMENTS_KEY, enrollments);
}

/**
 * Normalizes an enrollment object to ensure all required fields are present.
 * @param {object} enrollment - The raw enrollment data.
 * @returns {object} The normalized enrollment object.
 */
function normalizeEnrollment(enrollment) {
  return {
    id: enrollment.id || uuidv4(),
    memberId: enrollment.memberId || '',
    planId: enrollment.planId || '',
    status: enrollment.status || MEMBER_STATUS.PENDING,
    effectiveDate: enrollment.effectiveDate || null,
    terminationDate: enrollment.terminationDate || null,
    history: Array.isArray(enrollment.history) ? [...enrollment.history] : [],
    coverage: enrollment.coverage || '',
    demographics: enrollment.demographics && typeof enrollment.demographics === 'object'
      ? { ...enrollment.demographics }
      : {},
    createdAt: enrollment.createdAt || new Date().toISOString(),
    updatedAt: enrollment.updatedAt || new Date().toISOString(),
  };
}

/**
 * Filters an array of enrollment entries based on the provided filter criteria.
 * @param {Array<object>} enrollments - The enrollments to filter.
 * @param {object} [filters] - Optional filter criteria.
 * @param {string} [filters.memberId] - Filter by member ID.
 * @param {string} [filters.planId] - Filter by plan ID.
 * @param {string} [filters.status] - Filter by enrollment status.
 * @param {string} [filters.startDate] - Filter enrollments on or after this ISO date.
 * @param {string} [filters.endDate] - Filter enrollments on or before this ISO date.
 * @returns {Array<object>} The filtered enrollments.
 */
function applyFilters(enrollments, filters) {
  if (!filters || typeof filters !== 'object') {
    return enrollments;
  }

  let filtered = [...enrollments];

  if (filters.memberId) {
    filtered = filtered.filter((e) => e.memberId === filters.memberId);
  }

  if (filters.planId) {
    filtered = filtered.filter((e) => e.planId === filters.planId);
  }

  if (filters.status) {
    filtered = filtered.filter((e) => e.status === filters.status);
  }

  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    if (!isNaN(start)) {
      filtered = filtered.filter(
        (e) => new Date(e.createdAt).getTime() >= start
      );
    }
  }

  if (filters.endDate) {
    const end = new Date(filters.endDate).getTime();
    if (!isNaN(end)) {
      filtered = filtered.filter(
        (e) => new Date(e.createdAt).getTime() <= end
      );
    }
  }

  return filtered;
}

export const useEnrollmentStore = create((set, get) => ({
  enrollments: loadEnrollments(),

  /**
   * Creates a new enrollment record.
   * If an enrollment with the same id already exists, it will not be added.
   * @param {object} data - The enrollment data to create.
   * @returns {object|null} The created enrollment record, or null if invalid or duplicate.
   */
  createEnrollment: (data) => {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const normalized = normalizeEnrollment(data);

    // Add initial history entry
    if (normalized.history.length === 0) {
      const historyEntry = {
        id: uuidv4(),
        action: 'Enrollment Created',
        status: normalized.status,
        timestamp: normalized.createdAt,
        details: null,
      };
      normalized.history = [historyEntry];
    }

    let added = null;

    set((state) => {
      // Check for duplicate by id
      const exists = state.enrollments.some((e) => e.id === normalized.id);

      if (exists) {
        return state;
      }

      added = normalized;
      const updatedEnrollments = [normalized, ...state.enrollments];
      persistEnrollments(updatedEnrollments);
      return { enrollments: updatedEnrollments };
    });

    return added;
  },

  /**
   * Updates an existing enrollment by id.
   * Records the change in the enrollment's history.
   * @param {string} id - The enrollment id to update.
   * @param {object} updates - The fields to update.
   * @returns {object|null} The updated enrollment record, or null if not found.
   */
  updateEnrollment: (id, updates) => {
    if (!id || !updates || typeof updates !== 'object') {
      return null;
    }

    let updatedEnrollment = null;

    set((state) => {
      const enrollmentIndex = state.enrollments.findIndex((e) => e.id === id);

      if (enrollmentIndex === -1) {
        return state;
      }

      const existing = state.enrollments[enrollmentIndex];
      const now = new Date().toISOString();

      updatedEnrollment = {
        ...existing,
        ...updates,
        id: existing.id, // Prevent id override
        memberId: updates.memberId || existing.memberId, // Allow memberId update if provided
        updatedAt: now,
      };

      // If demographics are being updated, merge them
      if (updates.demographics && typeof updates.demographics === 'object') {
        updatedEnrollment.demographics = {
          ...existing.demographics,
          ...updates.demographics,
        };
      }

      // Build history entry for the update
      const historyEntry = {
        id: uuidv4(),
        action: 'Enrollment Updated',
        previousStatus: existing.status,
        status: updatedEnrollment.status,
        timestamp: now,
        details: null,
      };

      // If status changed, record it specifically
      if (updates.status && updates.status !== existing.status) {
        historyEntry.action = 'Status Changed';
      }

      updatedEnrollment.history = [...(existing.history || []), historyEntry];

      const updatedEnrollments = [...state.enrollments];
      updatedEnrollments[enrollmentIndex] = updatedEnrollment;
      persistEnrollments(updatedEnrollments);
      return { enrollments: updatedEnrollments };
    });

    return updatedEnrollment;
  },

  /**
   * Retrieves an enrollment by id.
   * @param {string} id - The enrollment id to look up.
   * @returns {object|null} The enrollment record, or null if not found.
   */
  getEnrollment: (id) => {
    if (!id) {
      return null;
    }

    const { enrollments } = get();
    const enrollment = enrollments.find((e) => e.id === id);
    return enrollment || null;
  },

  /**
   * Retrieves enrollments, optionally filtered by the provided criteria.
   * @param {object} [filters] - Optional filter criteria.
   * @param {string} [filters.memberId] - Filter by member ID.
   * @param {string} [filters.planId] - Filter by plan ID.
   * @param {string} [filters.status] - Filter by enrollment status.
   * @param {string} [filters.startDate] - Filter enrollments on or after this ISO date.
   * @param {string} [filters.endDate] - Filter enrollments on or before this ISO date.
   * @returns {Array<object>} The filtered enrollments.
   */
  getEnrollments: (filters) => {
    const { enrollments } = get();
    return applyFilters(enrollments, filters);
  },

  /**
   * Retrieves all enrollments for a specific member.
   * @param {string} memberId - The member ID to look up.
   * @returns {Array<object>} The enrollments for the specified member, or empty array if none found.
   */
  getEnrollmentsByMember: (memberId) => {
    if (!memberId) {
      return [];
    }

    const { enrollments } = get();
    return enrollments.filter((e) => e.memberId === memberId);
  },

  /**
   * Retrieves the history for a specific enrollment.
   * @param {string} id - The enrollment id to look up.
   * @returns {Array<object>} The enrollment history entries, or empty array if not found.
   */
  getEnrollmentHistory: (id) => {
    if (!id) {
      return [];
    }

    const { enrollments } = get();
    const enrollment = enrollments.find((e) => e.id === id);

    if (!enrollment) {
      return [];
    }

    return Array.isArray(enrollment.history) ? enrollment.history : [];
  },

  /**
   * Removes an enrollment by id.
   * @param {string} id - The enrollment id to remove.
   * @returns {boolean} True if the enrollment was found and removed.
   */
  removeEnrollment: (id) => {
    if (!id) {
      return false;
    }

    let found = false;

    set((state) => {
      const enrollmentIndex = state.enrollments.findIndex((e) => e.id === id);

      if (enrollmentIndex === -1) {
        return state;
      }

      found = true;
      const updatedEnrollments = state.enrollments.filter((e) => e.id !== id);
      persistEnrollments(updatedEnrollments);
      return { enrollments: updatedEnrollments };
    });

    return found;
  },

  /**
   * Clears all enrollments from state and localStorage.
   */
  clearEnrollments: () => {
    set({ enrollments: [] });
    persistEnrollments([]);
  },

  /**
   * Returns the total count of enrollments, optionally filtered by status.
   * @param {string} [status] - Optional status to filter by.
   * @returns {number} The count of matching enrollments.
   */
  getEnrollmentCount: (status) => {
    const { enrollments } = get();

    if (!status) {
      return enrollments.length;
    }

    return enrollments.filter((e) => e.status === status).length;
  },

  /**
   * Returns summary statistics about enrollments in the store.
   * @returns {{ total: number, eligible: number, ineligible: number, pending: number }} Enrollment statistics.
   */
  getEnrollmentStats: () => {
    const { enrollments } = get();

    return {
      total: enrollments.length,
      eligible: enrollments.filter((e) => e.status === MEMBER_STATUS.ELIGIBLE).length,
      ineligible: enrollments.filter((e) => e.status === MEMBER_STATUS.INELIGIBLE).length,
      pending: enrollments.filter((e) => e.status === MEMBER_STATUS.PENDING).length,
    };
  },
}));

/**
 * Standalone createEnrollment function for use outside of React components.
 * @param {object} data - The enrollment data to create.
 * @returns {object|null} The created enrollment record, or null if invalid or duplicate.
 */
export function createEnrollment(data) {
  return useEnrollmentStore.getState().createEnrollment(data);
}

/**
 * Standalone updateEnrollment function for use outside of React components.
 * @param {string} id - The enrollment id to update.
 * @param {object} updates - The fields to update.
 * @returns {object|null} The updated enrollment record, or null if not found.
 */
export function updateEnrollment(id, updates) {
  return useEnrollmentStore.getState().updateEnrollment(id, updates);
}

/**
 * Standalone getEnrollment function for use outside of React components.
 * @param {string} id - The enrollment id to look up.
 * @returns {object|null} The enrollment record, or null if not found.
 */
export function getEnrollment(id) {
  return useEnrollmentStore.getState().getEnrollment(id);
}

/**
 * Standalone getEnrollments function for use outside of React components.
 * @param {object} [filters] - Optional filter criteria.
 * @returns {Array<object>} The filtered enrollments.
 */
export function getEnrollments(filters) {
  return useEnrollmentStore.getState().getEnrollments(filters);
}

/**
 * Standalone getEnrollmentsByMember function for use outside of React components.
 * @param {string} memberId - The member ID to look up.
 * @returns {Array<object>} The enrollments for the specified member.
 */
export function getEnrollmentsByMember(memberId) {
  return useEnrollmentStore.getState().getEnrollmentsByMember(memberId);
}

/**
 * Standalone removeEnrollment function for use outside of React components.
 * @param {string} id - The enrollment id to remove.
 * @returns {boolean} True if the enrollment was found and removed.
 */
export function removeEnrollment(id) {
  return useEnrollmentStore.getState().removeEnrollment(id);
}