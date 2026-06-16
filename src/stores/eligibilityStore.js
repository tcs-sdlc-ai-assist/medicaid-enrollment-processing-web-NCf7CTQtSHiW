import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { MEMBER_STATUS, STORAGE_KEYS } from '../utils/constants';
import { loadState, saveState } from '../utils/localStorage';

const RULES_KEY = STORAGE_KEYS.SETTINGS.replace('settings', 'eligibility_rules');

/**
 * Default eligibility rules applied when no state-specific rules are configured.
 * @type {Array<object>}
 */
const DEFAULT_RULES = [
  {
    id: 'default-age-min',
    state: '*',
    criteria: { field: 'age', operator: '>=', value: 0 },
    effectiveDate: '2024-01-01',
    version: 1,
    createdBy: 'system',
  },
  {
    id: 'default-income-max',
    state: '*',
    criteria: { field: 'income', operator: '<=', value: 50000 },
    effectiveDate: '2024-01-01',
    version: 1,
    createdBy: 'system',
  },
];

/**
 * Loads persisted eligibility rules from localStorage.
 * @returns {Array<object>} The stored rules or default rules.
 */
function loadRules() {
  const data = loadState(RULES_KEY);
  return Array.isArray(data) && data.length > 0 ? data : [...DEFAULT_RULES];
}

/**
 * Persists eligibility rules to localStorage.
 * @param {Array<object>} rules - The rules to persist.
 */
function persistRules(rules) {
  saveState(RULES_KEY, rules);
}

/**
 * Evaluates a single rule criterion against a member's data.
 * @param {*} fieldValue - The value from the member record.
 * @param {string} operator - The comparison operator.
 * @param {*} ruleValue - The value to compare against.
 * @returns {boolean} True if the criterion is satisfied.
 */
function evaluateCriterion(fieldValue, operator, ruleValue) {
  if (fieldValue === undefined || fieldValue === null) {
    return false;
  }

  const numField = Number(fieldValue);
  const numRule = Number(ruleValue);
  const useNumeric = !isNaN(numField) && !isNaN(numRule);

  switch (operator) {
    case '>=':
      return useNumeric ? numField >= numRule : String(fieldValue) >= String(ruleValue);
    case '<=':
      return useNumeric ? numField <= numRule : String(fieldValue) <= String(ruleValue);
    case '>':
      return useNumeric ? numField > numRule : String(fieldValue) > String(ruleValue);
    case '<':
      return useNumeric ? numField < numRule : String(fieldValue) < String(ruleValue);
    case '==':
    case '===':
      return useNumeric ? numField === numRule : String(fieldValue) === String(ruleValue);
    case '!=':
    case '!==':
      return useNumeric ? numField !== numRule : String(fieldValue) !== String(ruleValue);
    case 'in':
      if (Array.isArray(ruleValue)) {
        return ruleValue.includes(fieldValue);
      }
      return false;
    case 'notIn':
      if (Array.isArray(ruleValue)) {
        return !ruleValue.includes(fieldValue);
      }
      return true;
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    default:
      return false;
  }
}

/**
 * Resolves the field value from a member object, supporting nested paths via dot notation
 * and also checking inside the demographics sub-object.
 * @param {object} member - The member record.
 * @param {string} field - The field name or dot-separated path.
 * @returns {*} The resolved value or undefined.
 */
function resolveFieldValue(member, field) {
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

/**
 * Filters rules applicable to a given state code.
 * Returns state-specific rules if available, otherwise returns wildcard ('*') rules.
 * @param {Array<object>} rules - All rules.
 * @param {string} stateCode - The state code to filter by.
 * @returns {Array<object>} The applicable rules.
 */
function getApplicableRules(rules, stateCode) {
  if (!stateCode) {
    return rules.filter((r) => r.state === '*');
  }

  const stateRules = rules.filter((r) => r.state === stateCode);
  if (stateRules.length > 0) {
    return stateRules;
  }

  // Fall back to wildcard rules
  return rules.filter((r) => r.state === '*');
}

export const useEligibilityStore = create((set, get) => ({
  rules: loadRules(),
  defaultRules: DEFAULT_RULES,

  /**
   * Replaces all eligibility rules with the provided array.
   * @param {Array<object>} rules - The new set of rules.
   */
  setRules: (rules) => {
    if (!Array.isArray(rules)) {
      return;
    }

    const normalizedRules = rules.map((rule) => ({
      id: rule.id || uuidv4(),
      state: rule.state || '*',
      criteria: rule.criteria || { field: '', operator: '==', value: '' },
      effectiveDate: rule.effectiveDate || new Date().toISOString().split('T')[0],
      version: rule.version || 1,
      createdBy: rule.createdBy || 'unknown',
    }));

    set({ rules: normalizedRules });
    persistRules(normalizedRules);
  },

  /**
   * Retrieves rules for a specific state code.
   * Returns state-specific rules if available, otherwise wildcard rules.
   * @param {string} [stateCode] - The state code to filter by.
   * @returns {Array<object>} The applicable rules.
   */
  getRules: (stateCode) => {
    const { rules } = get();

    if (!stateCode) {
      return rules;
    }

    return getApplicableRules(rules, stateCode);
  },

  /**
   * Adds a new eligibility rule.
   * @param {object} rule - The rule to add.
   * @returns {object} The created rule with generated id.
   */
  addRule: (rule) => {
    if (!rule || typeof rule !== 'object') {
      return null;
    }

    const newRule = {
      id: uuidv4(),
      state: rule.state || '*',
      criteria: rule.criteria || { field: '', operator: '==', value: '' },
      effectiveDate: rule.effectiveDate || new Date().toISOString().split('T')[0],
      version: rule.version || 1,
      createdBy: rule.createdBy || 'unknown',
    };

    set((state) => {
      const updatedRules = [...state.rules, newRule];
      persistRules(updatedRules);
      return { rules: updatedRules };
    });

    return newRule;
  },

  /**
   * Updates an existing rule by id.
   * @param {string} id - The rule id to update.
   * @param {object} updates - The fields to update.
   * @returns {object|null} The updated rule, or null if not found.
   */
  updateRule: (id, updates) => {
    if (!id || !updates || typeof updates !== 'object') {
      return null;
    }

    let updatedRule = null;

    set((state) => {
      const ruleIndex = state.rules.findIndex((r) => r.id === id);
      if (ruleIndex === -1) {
        return state;
      }

      const existingRule = state.rules[ruleIndex];
      updatedRule = {
        ...existingRule,
        ...updates,
        id: existingRule.id, // Prevent id override
        version: (existingRule.version || 0) + 1,
      };

      const updatedRules = [...state.rules];
      updatedRules[ruleIndex] = updatedRule;
      persistRules(updatedRules);
      return { rules: updatedRules };
    });

    return updatedRule;
  },

  /**
   * Deletes a rule by id.
   * @param {string} id - The rule id to delete.
   * @returns {boolean} True if the rule was found and deleted.
   */
  deleteRule: (id) => {
    if (!id) {
      return false;
    }

    let found = false;

    set((state) => {
      const ruleIndex = state.rules.findIndex((r) => r.id === id);
      if (ruleIndex === -1) {
        return state;
      }

      found = true;
      const updatedRules = state.rules.filter((r) => r.id !== id);
      persistRules(updatedRules);
      return { rules: updatedRules };
    });

    return found;
  },

  /**
   * Determines the eligibility status of a member based on applicable rules.
   * @param {object} member - The member record with demographics and other fields.
   * @param {string} [stateCode] - The state code to use for rule lookup.
   * @returns {string} The eligibility status: 'Eligible', 'Ineligible', or 'Pending'.
   */
  determineEligibility: (member, stateCode) => {
    if (!member || typeof member !== 'object') {
      return MEMBER_STATUS.PENDING;
    }

    const { rules } = get();
    const applicableRules = getApplicableRules(rules, stateCode);

    if (applicableRules.length === 0) {
      return MEMBER_STATUS.PENDING;
    }

    // Check effective dates - only apply rules that are currently effective
    const now = new Date().toISOString().split('T')[0];
    const effectiveRules = applicableRules.filter((rule) => {
      if (!rule.effectiveDate) {
        return true;
      }
      return rule.effectiveDate <= now;
    });

    if (effectiveRules.length === 0) {
      return MEMBER_STATUS.PENDING;
    }

    for (const rule of effectiveRules) {
      if (!rule.criteria || typeof rule.criteria !== 'object') {
        continue;
      }

      const { field, operator, value } = rule.criteria;

      if (!field || !operator) {
        continue;
      }

      const fieldValue = resolveFieldValue(member, field);
      const result = evaluateCriterion(fieldValue, operator, value);

      if (!result) {
        return MEMBER_STATUS.INELIGIBLE;
      }
    }

    return MEMBER_STATUS.ELIGIBLE;
  },

  /**
   * Resets rules to the default set.
   */
  resetToDefaults: () => {
    const defaults = [...DEFAULT_RULES];
    set({ rules: defaults });
    persistRules(defaults);
  },
}));

/**
 * Standalone setRules function for use outside of React components.
 * @param {Array<object>} rules - The new set of rules.
 */
export function setRules(rules) {
  return useEligibilityStore.getState().setRules(rules);
}

/**
 * Standalone getRules function for use outside of React components.
 * @param {string} [stateCode] - The state code to filter by.
 * @returns {Array<object>} The applicable rules.
 */
export function getRules(stateCode) {
  return useEligibilityStore.getState().getRules(stateCode);
}

/**
 * Standalone determineEligibility function for use outside of React components.
 * @param {object} member - The member record.
 * @param {string} [stateCode] - The state code.
 * @returns {string} The eligibility status.
 */
export function determineEligibility(member, stateCode) {
  return useEligibilityStore.getState().determineEligibility(member, stateCode);
}