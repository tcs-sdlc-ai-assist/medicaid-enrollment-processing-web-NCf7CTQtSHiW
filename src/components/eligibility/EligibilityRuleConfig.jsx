import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useEligibilityStore } from '../../stores/eligibilityStore';
import { useAuditStore } from '../../stores/auditStore';
import { useAuth } from '../../contexts/AuthContext';
import { DataTable } from '../common/DataTable';
import { SearchBar } from '../common/SearchBar';
import { StatusBadge } from '../common/StatusBadge';
import { AlertMessage } from '../common/AlertMessage';
import { Modal } from '../common/Modal';

/**
 * State options for the rule configuration form.
 * @type {Array<{ value: string, label: string }>}
 */
const STATE_OPTIONS = [
  { value: '*', label: 'All States (Wildcard)' },
  { value: 'CA', label: 'California' },
  { value: 'NY', label: 'New York' },
  { value: 'TX', label: 'Texas' },
  { value: 'FL', label: 'Florida' },
  { value: 'IL', label: 'Illinois' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'OH', label: 'Ohio' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'IN', label: 'Indiana' },
  { value: 'CO', label: 'Colorado' },
  { value: 'AZ', label: 'Arizona' },
];

/**
 * Criteria field options for the rule form.
 * @type {Array<{ value: string, label: string }>}
 */
const CRITERIA_FIELD_OPTIONS = [
  { value: 'age', label: 'Age' },
  { value: 'income', label: 'Income' },
  { value: 'demographics.address.state', label: 'Residency (State)' },
  { value: 'coverage', label: 'Coverage Type' },
  { value: 'demographics.citizenshipStatusCode', label: 'Citizenship Status' },
];

/**
 * Operator options for the rule form.
 * @type {Array<{ value: string, label: string }>}
 */
const OPERATOR_OPTIONS = [
  { value: '>=', label: '>= (Greater than or equal)' },
  { value: '<=', label: '<= (Less than or equal)' },
  { value: '>', label: '> (Greater than)' },
  { value: '<', label: '< (Less than)' },
  { value: '==', label: '== (Equal to)' },
  { value: '!=', label: '!= (Not equal to)' },
  { value: 'exists', label: 'Exists (Has value)' },
];

/**
 * State filter options for the search bar.
 * @type {Array<{ value: string, label: string }>}
 */
const STATE_FILTER_OPTIONS = [
  { value: '*', label: 'Wildcard (*)' },
  ...STATE_OPTIONS.filter((s) => s.value !== '*'),
];

/**
 * Formats a criteria object into a human-readable description string.
 * @param {object} criteria - The criteria object with field, operator, and value.
 * @returns {string} A human-readable description.
 */
function formatCriteriaDescription(criteria) {
  if (!criteria || typeof criteria !== 'object') {
    return '—';
  }

  const { field, operator, value } = criteria;

  const fieldLabels = {
    age: 'Age',
    income: 'Income',
    'demographics.address.state': 'Residency State',
    coverage: 'Coverage Type',
    'demographics.citizenshipStatusCode': 'Citizenship Status',
  };

  const operatorLabels = {
    '>=': '≥',
    '<=': '≤',
    '>': '>',
    '<': '<',
    '==': '=',
    '===': '=',
    '!=': '≠',
    '!==': '≠',
    exists: 'exists',
    in: 'in',
    notIn: 'not in',
  };

  const fieldLabel = fieldLabels[field] || field || 'Unknown';
  const operatorLabel = operatorLabels[operator] || operator || '?';

  if (operator === 'exists') {
    return `${fieldLabel} exists`;
  }

  let valueLabel = value;
  if (field === 'income' && typeof value === 'number') {
    valueLabel = `$${value.toLocaleString('en-US')}`;
  }

  return `${fieldLabel} ${operatorLabel} ${valueLabel}`;
}

/**
 * Returns the state label for a given state code.
 * @param {string} stateCode - The state code.
 * @returns {string} The state label.
 */
function getStateLabel(stateCode) {
  if (!stateCode) return '—';
  if (stateCode === '*') return 'All States (*)';
  const found = STATE_OPTIONS.find((s) => s.value === stateCode);
  return found ? found.label : stateCode;
}

/**
 * Default form state for the rule form.
 * @returns {object} The default form values.
 */
function getDefaultFormState() {
  return {
    state: '*',
    field: 'age',
    operator: '>=',
    value: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    notes: '',
  };
}

/**
 * EligibilityRuleConfig component.
 * UI for configuring eligibility rules per state. Displays existing rules in a table
 * with columns: state, criteria description, effective date, version, created by.
 * Supports add, edit, delete rule actions via modal forms.
 *
 * @param {{ className?: string }} props
 * @returns {import('react').ReactElement}
 */
export function EligibilityRuleConfig({ className }) {
  const rules = useEligibilityStore((state) => state.rules);
  const addRule = useEligibilityStore((state) => state.addRule);
  const updateRule = useEligibilityStore((state) => state.updateRule);
  const deleteRule = useEligibilityStore((state) => state.deleteRule);
  const resetToDefaults = useEligibilityStore((state) => state.resetToDefaults);
  const { currentUser, hasPermission } = useAuth();
  const logAction = useAuditStore((state) => state.logAction);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [alertMessage, setAlertMessage] = useState(null);

  // Add/Edit modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formState, setFormState] = useState(getDefaultFormState());
  const [formErrors, setFormErrors] = useState({});

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState(null);

  // Reset modal state
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const canManageSettings = hasPermission('manage_settings');
  const canEditMembers = hasPermission('edit_members');
  const canModifyRules = canManageSettings || canEditMembers;

  /**
   * Handles search and filter changes from the SearchBar.
   * @param {string} term - The search term.
   * @param {Object<string, string>} filters - The active filters.
   */
  const handleSearch = useCallback((term, filters) => {
    setSearchTerm(term || '');
    setActiveFilters(filters || {});
  }, []);

  /**
   * Filters rules based on search term and active filters.
   */
  const filteredRules = useMemo(() => {
    let result = Array.isArray(rules) ? [...rules] : [];

    if (searchTerm && searchTerm.trim().length > 0) {
      const lowerSearch = searchTerm.toLowerCase().trim();
      result = result.filter((rule) => {
        const stateLabel = getStateLabel(rule.state).toLowerCase();
        const criteriaDesc = formatCriteriaDescription(rule.criteria).toLowerCase();
        const createdBy = (rule.createdBy || '').toLowerCase();
        return (
          stateLabel.includes(lowerSearch) ||
          criteriaDesc.includes(lowerSearch) ||
          createdBy.includes(lowerSearch) ||
          (rule.state || '').toLowerCase().includes(lowerSearch)
        );
      });
    }

    if (activeFilters.state) {
      result = result.filter((rule) => rule.state === activeFilters.state);
    }

    return result;
  }, [rules, searchTerm, activeFilters]);

  /**
   * Rule statistics summary.
   */
  const ruleStats = useMemo(() => {
    const allRules = Array.isArray(rules) ? rules : [];
    const states = new Set(allRules.map((r) => r.state));
    return {
      total: allRules.length,
      stateCount: states.size,
      wildcardCount: allRules.filter((r) => r.state === '*').length,
    };
  }, [rules]);

  /**
   * Validates the form state.
   * @returns {{ valid: boolean, errors: object }} The validation result.
   */
  const validateForm = useCallback(() => {
    const errors = {};

    if (!formState.state) {
      errors.state = 'State is required.';
    }

    if (!formState.field) {
      errors.field = 'Criteria field is required.';
    }

    if (!formState.operator) {
      errors.operator = 'Operator is required.';
    }

    if (formState.operator !== 'exists') {
      if (formState.value === '' || formState.value === undefined || formState.value === null) {
        errors.value = 'Value is required.';
      }

      if (
        (formState.field === 'age' || formState.field === 'income') &&
        formState.value !== '' &&
        isNaN(Number(formState.value))
      ) {
        errors.value = 'Value must be a number for this field.';
      }
    }

    if (!formState.effectiveDate) {
      errors.effectiveDate = 'Effective date is required.';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }, [formState]);

  /**
   * Opens the add rule modal.
   */
  const handleOpenAddModal = useCallback(() => {
    setEditingRule(null);
    setFormState(getDefaultFormState());
    setFormErrors({});
    setFormModalOpen(true);
  }, []);

  /**
   * Opens the edit rule modal.
   * @param {object} rule - The rule to edit.
   */
  const handleOpenEditModal = useCallback((rule) => {
    if (!rule) return;
    setEditingRule(rule);
    setFormState({
      state: rule.state || '*',
      field: (rule.criteria && rule.criteria.field) || 'age',
      operator: (rule.criteria && rule.criteria.operator) || '>=',
      value:
        rule.criteria && rule.criteria.value !== undefined && rule.criteria.value !== null
          ? String(rule.criteria.value)
          : '',
      effectiveDate: rule.effectiveDate || new Date().toISOString().split('T')[0],
      notes: rule.notes || '',
    });
    setFormErrors({});
    setFormModalOpen(true);
  }, []);

  /**
   * Closes the form modal.
   */
  const handleCloseFormModal = useCallback(() => {
    setFormModalOpen(false);
    setEditingRule(null);
    setFormState(getDefaultFormState());
    setFormErrors({});
  }, []);

  /**
   * Handles form field changes.
   * @param {string} field - The form field name.
   * @param {string} value - The new value.
   */
  const handleFormChange = useCallback((field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  }, []);

  /**
   * Handles form submission for add/edit.
   */
  const handleFormSubmit = useCallback(() => {
    const validation = validateForm();
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    const userId = currentUser ? currentUser.id : '';
    const userName = currentUser ? currentUser.name : '';

    let criteriaValue = formState.value;
    if (
      (formState.field === 'age' || formState.field === 'income') &&
      criteriaValue !== '' &&
      !isNaN(Number(criteriaValue))
    ) {
      criteriaValue = Number(criteriaValue);
    }

    const ruleData = {
      state: formState.state,
      criteria: {
        field: formState.field,
        operator: formState.operator,
        value: formState.operator === 'exists' ? true : criteriaValue,
      },
      effectiveDate: formState.effectiveDate,
      createdBy: userName || userId || 'unknown',
      notes: formState.notes || '',
    };

    if (editingRule) {
      const updated = updateRule(editingRule.id, ruleData);
      if (updated) {
        logAction('Eligibility Rule Updated', editingRule.id, userId, {
          state: ruleData.state,
          criteria: ruleData.criteria,
          effectiveDate: ruleData.effectiveDate,
        });
        setAlertMessage({
          type: 'success',
          message: `Rule for ${getStateLabel(ruleData.state)} updated successfully.`,
          title: 'Rule Updated',
        });
      } else {
        setAlertMessage({
          type: 'error',
          message: 'Failed to update the rule. Please try again.',
          title: 'Update Failed',
        });
      }
    } else {
      const created = addRule(ruleData);
      if (created) {
        logAction('Eligibility Rule Added', created.id, userId, {
          state: ruleData.state,
          criteria: ruleData.criteria,
          effectiveDate: ruleData.effectiveDate,
        });
        setAlertMessage({
          type: 'success',
          message: `New rule for ${getStateLabel(ruleData.state)} added successfully.`,
          title: 'Rule Added',
        });
      } else {
        setAlertMessage({
          type: 'error',
          message: 'Failed to add the rule. Please try again.',
          title: 'Add Failed',
        });
      }
    }

    handleCloseFormModal();
  }, [validateForm, formState, editingRule, updateRule, addRule, currentUser, logAction, handleCloseFormModal]);

  /**
   * Opens the delete confirmation modal.
   * @param {object} rule - The rule to delete.
   */
  const handleDeleteClick = useCallback((rule) => {
    if (!rule) return;
    setRuleToDelete(rule);
    setDeleteModalOpen(true);
  }, []);

  /**
   * Confirms and executes rule deletion.
   */
  const handleConfirmDelete = useCallback(() => {
    if (!ruleToDelete) return;

    const userId = currentUser ? currentUser.id : '';
    const deleted = deleteRule(ruleToDelete.id);

    if (deleted) {
      logAction('Eligibility Rule Deleted', ruleToDelete.id, userId, {
        state: ruleToDelete.state,
        criteria: ruleToDelete.criteria,
      });
      setAlertMessage({
        type: 'success',
        message: `Rule for ${getStateLabel(ruleToDelete.state)} deleted successfully.`,
        title: 'Rule Deleted',
      });
    } else {
      setAlertMessage({
        type: 'error',
        message: 'Failed to delete the rule. Please try again.',
        title: 'Delete Failed',
      });
    }

    setDeleteModalOpen(false);
    setRuleToDelete(null);
  }, [ruleToDelete, deleteRule, currentUser, logAction]);

  /**
   * Cancels rule deletion.
   */
  const handleCancelDelete = useCallback(() => {
    setDeleteModalOpen(false);
    setRuleToDelete(null);
  }, []);

  /**
   * Opens the reset confirmation modal.
   */
  const handleResetClick = useCallback(() => {
    setResetModalOpen(true);
  }, []);

  /**
   * Confirms and executes reset to defaults.
   */
  const handleConfirmReset = useCallback(() => {
    const userId = currentUser ? currentUser.id : '';
    resetToDefaults();
    logAction('Eligibility Rules Reset to Defaults', '', userId, {
      resetAt: new Date().toISOString(),
    });
    setAlertMessage({
      type: 'success',
      message: 'Eligibility rules have been reset to defaults.',
      title: 'Rules Reset',
    });
    setResetModalOpen(false);
  }, [resetToDefaults, currentUser, logAction]);

  /**
   * Cancels reset.
   */
  const handleCancelReset = useCallback(() => {
    setResetModalOpen(false);
  }, []);

  /**
   * DataTable column definitions.
   * @type {Array<object>}
   */
  const columns = useMemo(
    () => [
      {
        key: 'state',
        label: 'State',
        sortable: true,
        render: (value) => (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
            {value === '*' ? 'All (*)' : value || '—'}
          </span>
        ),
      },
      {
        key: 'criteria',
        label: 'Criteria',
        sortable: false,
        render: (value) => (
          <span className="text-sm text-gray-800">
            {formatCriteriaDescription(value)}
          </span>
        ),
      },
      {
        key: 'effectiveDate',
        label: 'Effective Date',
        sortable: true,
        render: (value) => (
          <span className="text-xs text-gray-600">{value || '—'}</span>
        ),
      },
      {
        key: 'version',
        label: 'Version',
        sortable: true,
        render: (value) => (
          <span className="text-xs font-medium text-gray-600">v{value || 1}</span>
        ),
      },
      {
        key: 'createdBy',
        label: 'Created By',
        sortable: true,
        render: (value) => (
          <span className="text-xs text-gray-600">{value || 'system'}</span>
        ),
      },
      {
        key: 'id',
        label: 'Actions',
        sortable: false,
        render: (_value, row) => (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {/* Edit */}
            {canModifyRules && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEditModal(row);
                }}
                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                aria-label={`Edit rule for ${getStateLabel(row.state)}`}
                title="Edit Rule"
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
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}

            {/* Delete */}
            {canModifyRules && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(row);
                }}
                className="p-1.5 text-gray-400 hover:text-error-600 hover:bg-error-50 rounded-md transition-colors"
                aria-label={`Delete rule for ${getStateLabel(row.state)}`}
                title="Delete Rule"
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}

            {/* View (non-editable) */}
            {!canModifyRules && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEditModal(row);
                }}
                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                aria-label={`View rule for ${getStateLabel(row.state)}`}
                title="View Rule"
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
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>
            )}
          </div>
        ),
      },
    ],
    [canModifyRules, handleOpenEditModal, handleDeleteClick]
  );

  /**
   * Search bar filter configuration.
   * @type {Array<object>}
   */
  const searchFilters = useMemo(
    () => [
      {
        key: 'state',
        label: 'State',
        options: STATE_FILTER_OPTIONS,
      },
    ],
    []
  );

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Eligibility Rules</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {ruleStats.total} rule{ruleStats.total !== 1 ? 's' : ''} configured across{' '}
            {ruleStats.stateCount} state{ruleStats.stateCount !== 1 ? 's' : ''}
            {ruleStats.wildcardCount > 0 && (
              <span className="text-primary-600 ml-2">
                • {ruleStats.wildcardCount} wildcard
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canModifyRules && (
            <button
              type="button"
              onClick={handleResetClick}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Reset to Defaults
            </button>
          )}
          {canModifyRules && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Rule
            </button>
          )}
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
          autoDismissMs={5000}
        />
      )}

      {/* Search and Filters */}
      <SearchBar
        placeholder="Search rules by state, criteria, or creator..."
        onSearch={handleSearch}
        filters={searchFilters}
        debounceMs={300}
      />

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredRules}
        pageSize={10}
        sortable
        rowKey="id"
        emptyMessage="No eligibility rules configured. Add a rule to get started."
      />

      {/* Add/Edit Rule Modal */}
      <Modal
        isOpen={formModalOpen}
        onClose={handleCloseFormModal}
        title={editingRule ? 'Edit Eligibility Rule' : 'Add Eligibility Rule'}
        size="md"
        actions={
          canModifyRules
            ? [
                {
                  label: 'Cancel',
                  onClick: handleCloseFormModal,
                  variant: 'secondary',
                },
                {
                  label: editingRule ? 'Update Rule' : 'Add Rule',
                  onClick: handleFormSubmit,
                  variant: 'primary',
                },
              ]
            : [
                {
                  label: 'Close',
                  onClick: handleCloseFormModal,
                  variant: 'secondary',
                },
              ]
        }
      >
        <div className="space-y-4">
          {/* State */}
          <div>
            <label
              htmlFor="rule-state"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              State <span className="text-error-500">*</span>
            </label>
            <select
              id="rule-state"
              value={formState.state}
              onChange={(e) => handleFormChange('state', e.target.value)}
              disabled={!canModifyRules}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                formErrors.state ? 'border-error-300' : 'border-gray-300'
              } ${!canModifyRules ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {formErrors.state && (
              <p className="text-xs text-error-600 mt-1">{formErrors.state}</p>
            )}
          </div>

          {/* Criteria Field */}
          <div>
            <label
              htmlFor="rule-field"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Criteria Field <span className="text-error-500">*</span>
            </label>
            <select
              id="rule-field"
              value={formState.field}
              onChange={(e) => handleFormChange('field', e.target.value)}
              disabled={!canModifyRules}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                formErrors.field ? 'border-error-300' : 'border-gray-300'
              } ${!canModifyRules ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {CRITERIA_FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {formErrors.field && (
              <p className="text-xs text-error-600 mt-1">{formErrors.field}</p>
            )}
          </div>

          {/* Operator */}
          <div>
            <label
              htmlFor="rule-operator"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Operator <span className="text-error-500">*</span>
            </label>
            <select
              id="rule-operator"
              value={formState.operator}
              onChange={(e) => handleFormChange('operator', e.target.value)}
              disabled={!canModifyRules}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                formErrors.operator ? 'border-error-300' : 'border-gray-300'
              } ${!canModifyRules ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {OPERATOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {formErrors.operator && (
              <p className="text-xs text-error-600 mt-1">{formErrors.operator}</p>
            )}
          </div>

          {/* Value */}
          {formState.operator !== 'exists' && (
            <div>
              <label
                htmlFor="rule-value"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Value <span className="text-error-500">*</span>
              </label>
              <input
                id="rule-value"
                type={formState.field === 'age' || formState.field === 'income' ? 'number' : 'text'}
                value={formState.value}
                onChange={(e) => handleFormChange('value', e.target.value)}
                disabled={!canModifyRules}
                placeholder={
                  formState.field === 'age'
                    ? 'e.g., 18'
                    : formState.field === 'income'
                      ? 'e.g., 50000'
                      : 'Enter value...'
                }
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                  formErrors.value ? 'border-error-300' : 'border-gray-300'
                } ${!canModifyRules ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
              {formErrors.value && (
                <p className="text-xs text-error-600 mt-1">{formErrors.value}</p>
              )}
              {formState.field === 'income' && (
                <p className="text-xs text-gray-500 mt-1">
                  Enter the income threshold in dollars (e.g., 50000 for $50,000).
                </p>
              )}
              {formState.field === 'age' && (
                <p className="text-xs text-gray-500 mt-1">
                  Enter the age threshold in years.
                </p>
              )}
            </div>
          )}

          {/* Effective Date */}
          <div>
            <label
              htmlFor="rule-effective-date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Effective Date <span className="text-error-500">*</span>
            </label>
            <input
              id="rule-effective-date"
              type="date"
              value={formState.effectiveDate}
              onChange={(e) => handleFormChange('effectiveDate', e.target.value)}
              disabled={!canModifyRules}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                formErrors.effectiveDate ? 'border-error-300' : 'border-gray-300'
              } ${!canModifyRules ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {formErrors.effectiveDate && (
              <p className="text-xs text-error-600 mt-1">{formErrors.effectiveDate}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="rule-notes"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Notes
            </label>
            <textarea
              id="rule-notes"
              value={formState.notes}
              onChange={(e) => handleFormChange('notes', e.target.value)}
              disabled={!canModifyRules}
              placeholder="Optional notes about this rule..."
              rows={3}
              className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none ${
                !canModifyRules ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            />
          </div>

          {/* Preview */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">
              Rule Preview
            </p>
            <p className="text-sm text-gray-800">
              <span className="font-medium">{getStateLabel(formState.state)}</span>
              {' — '}
              {formatCriteriaDescription({
                field: formState.field,
                operator: formState.operator,
                value:
                  formState.operator === 'exists'
                    ? true
                    : (formState.field === 'age' || formState.field === 'income') &&
                        formState.value !== '' &&
                        !isNaN(Number(formState.value))
                      ? Number(formState.value)
                      : formState.value,
              })}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Effective: {formState.effectiveDate || '—'}
            </p>
          </div>

          {/* Version info for editing */}
          {editingRule && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Version: v{editingRule.version || 1}</span>
              <span>Created by: {editingRule.createdBy || 'system'}</span>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={handleCancelDelete}
        title="Delete Eligibility Rule"
        size="sm"
        actions={[
          {
            label: 'Cancel',
            onClick: handleCancelDelete,
            variant: 'secondary',
          },
          {
            label: 'Delete',
            onClick: handleConfirmDelete,
            variant: 'danger',
          },
        ]}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Are you sure you want to delete this eligibility rule? This action cannot be undone.
          </p>
          {ruleToDelete && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
                  {ruleToDelete.state === '*' ? 'All (*)' : ruleToDelete.state || '—'}
                </span>
                <span className="text-xs text-gray-500">v{ruleToDelete.version || 1}</span>
              </div>
              <p className="text-sm text-gray-800">
                {formatCriteriaDescription(ruleToDelete.criteria)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Effective: {ruleToDelete.effectiveDate || '—'}
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={resetModalOpen}
        onClose={handleCancelReset}
        title="Reset Eligibility Rules"
        size="sm"
        actions={[
          {
            label: 'Cancel',
            onClick: handleCancelReset,
            variant: 'secondary',
          },
          {
            label: 'Reset to Defaults',
            onClick: handleConfirmReset,
            variant: 'danger',
          },
        ]}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Are you sure you want to reset all eligibility rules to their default values? This will
            remove all custom rules and restore the system defaults.
          </p>
          <div className="p-3 bg-warning-50 border border-warning-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-warning-500 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-xs text-warning-700">
                This will replace {ruleStats.total} existing rule{ruleStats.total !== 1 ? 's' : ''}{' '}
                with the default rule set.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

EligibilityRuleConfig.propTypes = {
  className: PropTypes.string,
};

EligibilityRuleConfig.defaultProps = {
  className: '',
};

export default EligibilityRuleConfig;