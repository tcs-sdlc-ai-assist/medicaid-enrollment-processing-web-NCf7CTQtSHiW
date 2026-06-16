import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { MEMBER_STATUS, STORAGE_KEYS } from '../utils/constants';
import { loadState, saveState } from '../utils/localStorage';

const MEMBERS_KEY = STORAGE_KEYS.MEMBERS;

/**
 * Loads persisted members from localStorage.
 * @returns {Array<object>} The stored members or empty array.
 */
function loadMembers() {
  const data = loadState(MEMBERS_KEY);
  return Array.isArray(data) ? data : [];
}

/**
 * Persists members to localStorage.
 * @param {Array<object>} members - The members to persist.
 */
function persistMembers(members) {
  saveState(MEMBERS_KEY, members);
}

/**
 * Normalizes a member object to ensure all required fields are present.
 * @param {object} member - The raw member data.
 * @returns {object} The normalized member object.
 */
function normalizeMember(member) {
  return {
    id: member.id || uuidv4(),
    memberId: member.memberId || member.id || uuidv4(),
    firstName: member.firstName || '',
    lastName: member.lastName || '',
    demographics: member.demographics && typeof member.demographics === 'object'
      ? { ...member.demographics }
      : {},
    coverage: member.coverage || '',
    eligibilityStatus: member.eligibilityStatus || MEMBER_STATUS.PENDING,
    status: member.status || member.eligibilityStatus || MEMBER_STATUS.PENDING,
    history: Array.isArray(member.history) ? [...member.history] : [],
    enrollmentHistory: Array.isArray(member.enrollmentHistory)
      ? [...member.enrollmentHistory]
      : Array.isArray(member.history) ? [...member.history] : [],
    createdAt: member.createdAt || new Date().toISOString(),
    updatedAt: member.updatedAt || new Date().toISOString(),
  };
}

/**
 * Checks if a member field value matches a search criterion value.
 * Supports case-insensitive partial string matching for strings,
 * and strict equality for other types.
 * @param {*} fieldValue - The value from the member record.
 * @param {*} criterionValue - The value to match against.
 * @returns {boolean} True if the values match.
 */
function matchesCriterion(fieldValue, criterionValue) {
  if (fieldValue === undefined || fieldValue === null) {
    return false;
  }

  if (typeof fieldValue === 'string' && typeof criterionValue === 'string') {
    return fieldValue.toLowerCase().includes(criterionValue.toLowerCase());
  }

  return fieldValue === criterionValue;
}

/**
 * Resolves a field value from a member object, supporting top-level fields,
 * demographics sub-object, and dot-notation paths.
 * @param {object} member - The member record.
 * @param {string} field - The field name or dot-separated path.
 * @returns {*} The resolved value or undefined.
 */
function resolveField(member, field) {
  if (!member || typeof member !== 'object' || !field) {
    return undefined;
  }

  // Direct property
  if (member[field] !== undefined) {
    return member[field];
  }

  // Check inside demographics
  if (member.demographics && typeof member.demographics === 'object') {
    if (member.demographics[field] !== undefined) {
      return member.demographics[field];
    }
  }

  // Dot notation path
  const parts = field.split('.');
  let current = member;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

export const useMemberStore = create((set, get) => ({
  members: loadMembers(),

  /**
   * Adds a new member to the store.
   * If a member with the same id or memberId already exists, it will not be added.
   * @param {object} member - The member data to add.
   * @returns {object|null} The created member, or null if invalid or duplicate.
   */
  addMember: (member) => {
    if (!member || typeof member !== 'object') {
      return null;
    }

    const normalized = normalizeMember(member);

    // Add initial history entry
    if (normalized.history.length === 0) {
      const historyEntry = {
        id: uuidv4(),
        action: 'Member Added',
        status: normalized.eligibilityStatus,
        timestamp: normalized.createdAt,
        details: null,
      };
      normalized.history = [historyEntry];
      normalized.enrollmentHistory = [historyEntry];
    }

    let added = null;

    set((state) => {
      // Check for duplicate
      const exists = state.members.some(
        (m) => m.id === normalized.id || m.memberId === normalized.memberId
      );

      if (exists) {
        return state;
      }

      added = normalized;
      const updatedMembers = [...state.members, normalized];
      persistMembers(updatedMembers);
      return { members: updatedMembers };
    });

    return added;
  },

  /**
   * Updates an existing member by id.
   * @param {string} id - The member id to update.
   * @param {object} updates - The fields to update.
   * @returns {object|null} The updated member, or null if not found.
   */
  updateMember: (id, updates) => {
    if (!id || !updates || typeof updates !== 'object') {
      return null;
    }

    let updatedMember = null;

    set((state) => {
      const memberIndex = state.members.findIndex(
        (m) => m.id === id || m.memberId === id
      );

      if (memberIndex === -1) {
        return state;
      }

      const existing = state.members[memberIndex];
      const now = new Date().toISOString();

      updatedMember = {
        ...existing,
        ...updates,
        id: existing.id, // Prevent id override
        memberId: existing.memberId, // Prevent memberId override
        updatedAt: now,
      };

      // If demographics are being updated, merge them
      if (updates.demographics && typeof updates.demographics === 'object') {
        updatedMember.demographics = {
          ...existing.demographics,
          ...updates.demographics,
        };
      }

      // Keep history arrays intact unless explicitly provided
      if (!updates.history) {
        updatedMember.history = existing.history || [];
      }
      if (!updates.enrollmentHistory) {
        updatedMember.enrollmentHistory = existing.enrollmentHistory || [];
      }

      // Sync status fields
      if (updates.eligibilityStatus) {
        updatedMember.status = updates.eligibilityStatus;
      } else if (updates.status) {
        updatedMember.eligibilityStatus = updates.status;
      }

      const updatedMembers = [...state.members];
      updatedMembers[memberIndex] = updatedMember;
      persistMembers(updatedMembers);
      return { members: updatedMembers };
    });

    return updatedMember;
  },

  /**
   * Retrieves a member by id.
   * @param {string} id - The member id or memberId to look up.
   * @returns {object|null} The member record, or null if not found.
   */
  getMember: (id) => {
    if (!id) {
      return null;
    }

    const { members } = get();
    const member = members.find((m) => m.id === id || m.memberId === id);
    return member || null;
  },

  /**
   * Searches members based on the provided criteria.
   * Supports filtering by any top-level field, demographics sub-fields,
   * and dot-notation paths.
   * @param {object} [criteria] - The search criteria as key-value pairs.
   * @returns {Array<object>} The matching members.
   */
  searchMembers: (criteria) => {
    const { members } = get();

    if (!criteria || typeof criteria !== 'object') {
      return members;
    }

    const criteriaEntries = Object.entries(criteria).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    );

    if (criteriaEntries.length === 0) {
      return members;
    }

    return members.filter((member) => {
      return criteriaEntries.every(([field, value]) => {
        const fieldValue = resolveField(member, field);
        return matchesCriterion(fieldValue, value);
      });
    });
  },

  /**
   * Retrieves the enrollment history for a specific member.
   * @param {string} memberId - The member id to look up.
   * @returns {Array<object>} The enrollment history entries, or empty array if not found.
   */
  getEnrollmentHistory: (memberId) => {
    if (!memberId) {
      return [];
    }

    const { members } = get();
    const member = members.find((m) => m.id === memberId || m.memberId === memberId);

    if (!member) {
      return [];
    }

    // Return enrollmentHistory if available, fall back to history
    if (Array.isArray(member.enrollmentHistory) && member.enrollmentHistory.length > 0) {
      return member.enrollmentHistory;
    }

    return Array.isArray(member.history) ? member.history : [];
  },

  /**
   * Categorizes a member by updating their eligibility status and recording
   * the change in their history.
   * @param {string} memberId - The member id to categorize.
   * @param {string} status - The new eligibility status (Eligible, Ineligible, Pending).
   * @returns {object|null} The updated member, or null if not found or invalid status.
   */
  categorizeMember: (memberId, status) => {
    if (!memberId || !status) {
      return null;
    }

    const validStatuses = Object.values(MEMBER_STATUS);
    if (!validStatuses.includes(status)) {
      return null;
    }

    let updatedMember = null;

    set((state) => {
      const memberIndex = state.members.findIndex(
        (m) => m.id === memberId || m.memberId === memberId
      );

      if (memberIndex === -1) {
        return state;
      }

      const existing = state.members[memberIndex];
      const now = new Date().toISOString();

      const historyEntry = {
        id: uuidv4(),
        action: 'Eligibility Determined',
        previousStatus: existing.eligibilityStatus || existing.status || MEMBER_STATUS.PENDING,
        status,
        timestamp: now,
        details: null,
      };

      const updatedHistory = [...(existing.history || []), historyEntry];
      const updatedEnrollmentHistory = [...(existing.enrollmentHistory || []), historyEntry];

      updatedMember = {
        ...existing,
        eligibilityStatus: status,
        status,
        history: updatedHistory,
        enrollmentHistory: updatedEnrollmentHistory,
        updatedAt: now,
      };

      const updatedMembers = [...state.members];
      updatedMembers[memberIndex] = updatedMember;
      persistMembers(updatedMembers);
      return { members: updatedMembers };
    });

    return updatedMember;
  },

  /**
   * Removes a member by id.
   * @param {string} id - The member id to remove.
   * @returns {boolean} True if the member was found and removed.
   */
  removeMember: (id) => {
    if (!id) {
      return false;
    }

    let found = false;

    set((state) => {
      const memberIndex = state.members.findIndex(
        (m) => m.id === id || m.memberId === id
      );

      if (memberIndex === -1) {
        return state;
      }

      found = true;
      const updatedMembers = state.members.filter(
        (m) => m.id !== id && m.memberId !== id
      );
      persistMembers(updatedMembers);
      return { members: updatedMembers };
    });

    return found;
  },

  /**
   * Clears all members from state and localStorage.
   */
  clearMembers: () => {
    set({ members: [] });
    persistMembers([]);
  },

  /**
   * Returns the total count of members, optionally filtered by status.
   * @param {string} [status] - Optional status to filter by.
   * @returns {number} The count of matching members.
   */
  getMemberCount: (status) => {
    const { members } = get();

    if (!status) {
      return members.length;
    }

    return members.filter(
      (m) => m.eligibilityStatus === status || m.status === status
    ).length;
  },
}));

/**
 * Standalone addMember function for use outside of React components.
 * @param {object} member - The member data to add.
 * @returns {object|null} The created member, or null if invalid or duplicate.
 */
export function addMember(member) {
  return useMemberStore.getState().addMember(member);
}

/**
 * Standalone updateMember function for use outside of React components.
 * @param {string} id - The member id to update.
 * @param {object} updates - The fields to update.
 * @returns {object|null} The updated member, or null if not found.
 */
export function updateMember(id, updates) {
  return useMemberStore.getState().updateMember(id, updates);
}

/**
 * Standalone getMember function for use outside of React components.
 * @param {string} id - The member id to look up.
 * @returns {object|null} The member record, or null if not found.
 */
export function getMember(id) {
  return useMemberStore.getState().getMember(id);
}

/**
 * Standalone searchMembers function for use outside of React components.
 * @param {object} [criteria] - The search criteria.
 * @returns {Array<object>} The matching members.
 */
export function searchMembers(criteria) {
  return useMemberStore.getState().searchMembers(criteria);
}

/**
 * Standalone getEnrollmentHistory function for use outside of React components.
 * @param {string} memberId - The member id to look up.
 * @returns {Array<object>} The enrollment history entries.
 */
export function getEnrollmentHistory(memberId) {
  return useMemberStore.getState().getEnrollmentHistory(memberId);
}