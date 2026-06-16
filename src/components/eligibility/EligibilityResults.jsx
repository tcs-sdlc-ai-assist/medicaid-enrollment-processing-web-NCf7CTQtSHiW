import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useMemberStore } from '../../stores/memberStore';
import { useEligibilityStore } from '../../stores/eligibilityStore';
import { useAuditStore } from '../../stores/auditStore';
import { useAuth } from '../../contexts/AuthContext';
import { MEMBER_STATUS } from '../../utils/constants';
import { formatDate, formatTimestamp } from '../../utils/helpers';
import { DataTable } from '../common/DataTable';
import { SearchBar } from '../common/SearchBar';
import { StatusBadge } from '../common/StatusBadge';
import { StatsCard } from '../common/StatsCard';
import { Modal } from '../common/Modal';

/**
 * Status filter options for eligibility results.
 * @type {Array<{ value: string, label: string }>}
 */
const STATUS_FILTER_OPTIONS = [
  { value: MEMBER_STATUS.ELIGIBLE, label: 'Eligible' },
  { value: MEMBER_STATUS.INELIGIBLE, label: 'Ineligible' },
  { value: MEMBER_STATUS.PENDING, label: 'Pending' },
];

/**
 * State filter options for eligibility results.
 * @type {Array<{ value: string, label: string }>}
 */
const STATE_FILTER_OPTIONS = [
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
 * Resolves the state value from a member's demographics address.
 * @param {object} member - The member record.
 * @returns {string} The state code or empty string.
 */
function getMemberState(member) {
  if (
    member &&
    member.demographics &&
    typeof member.demographics === 'object' &&
    member.demographics.address &&
    typeof member.demographics.address === 'object'
  ) {
    return member.demographics.address.state || '';
  }
  return '';
}

/**
 * Returns the state label for a given state code.
 * @param {string} stateCode - The state code.
 * @returns {string} The state label.
 */
function getStateLabel(stateCode) {
  if (!stateCode) return '—';
  const found = STATE_FILTER_OPTIONS.find((s) => s.value === stateCode);
  return found ? found.label : stateCode;
}

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
 * Resolves the applied rule description for a member based on their state.
 * @param {object} member - The member record.
 * @param {Array<object>} rules - All eligibility rules.
 * @returns {string} A description of the applied rules.
 */
function getAppliedRuleDescription(member, rules) {
  if (!member || !Array.isArray(rules) || rules.length === 0) {
    return '—';
  }

  const stateCode = getMemberState(member);

  // Find state-specific rules first, then fall back to wildcard
  let applicableRules = rules.filter((r) => r.state === stateCode);
  if (applicableRules.length === 0) {
    applicableRules = rules.filter((r) => r.state === '*');
  }

  if (applicableRules.length === 0) {
    return 'No rules applied';
  }

  const descriptions = applicableRules
    .map((rule) => formatCriteriaDescription(rule.criteria))
    .filter((desc) => desc !== '—');

  if (descriptions.length === 0) {
    return '—';
  }

  if (descriptions.length <= 2) {
    return descriptions.join('; ');
  }

  return `${descriptions.slice(0, 2).join('; ')} (+${descriptions.length - 2} more)`;
}

/**
 * Resolves the determination date from a member's history.
 * @param {object} member - The member record.
 * @returns {string} The determination date or empty string.
 */
function getDeterminationDate(member) {
  if (!member) return '';

  const history = Array.isArray(member.enrollmentHistory)
    ? member.enrollmentHistory
    : Array.isArray(member.history)
      ? member.history
      : [];

  // Find the most recent eligibility determination entry
  const determinationEntry = [...history]
    .reverse()
    .find(
      (entry) =>
        entry.action === 'Eligibility Determined' ||
        entry.action === 'Member Added'
    );

  if (determinationEntry && determinationEntry.timestamp) {
    return determinationEntry.timestamp;
  }

  return member.updatedAt || member.createdAt || '';
}

/**
 * EligibilityResults component.
 * Displays eligibility determination results for processed members.
 * Shows summary cards (total, eligible, ineligible, pending counts) and
 * detailed table with member name, state, applied rule, result status,
 * and determination date. Supports filtering by status and state.
 *
 * @param {{ className?: string, onMemberSelect?: (member: object) => void }} props
 * @returns {import('react').ReactElement}
 */
export function EligibilityResults({ className, onMemberSelect }) {
  const members = useMemberStore((state) => state.members);
  const rules = useEligibilityStore((state) => state.rules);
  const { currentUser } = useAuth();
  const logAction = useAuditStore((state) => state.logAction);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

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
   * Member statistics summary.
   */
  const memberStats = useMemo(() => {
    const allMembers = Array.isArray(members) ? members : [];
    return {
      total: allMembers.length,
      eligible: allMembers.filter(
        (m) => m.eligibilityStatus === MEMBER_STATUS.ELIGIBLE || m.status === MEMBER_STATUS.ELIGIBLE
      ).length,
      ineligible: allMembers.filter(
        (m) => m.eligibilityStatus === MEMBER_STATUS.INELIGIBLE || m.status === MEMBER_STATUS.INELIGIBLE
      ).length,
      pending: allMembers.filter(
        (m) => m.eligibilityStatus === MEMBER_STATUS.PENDING || m.status === MEMBER_STATUS.PENDING
      ).length,
    };
  }, [members]);

  /**
   * Eligibility rate percentage.
   */
  const eligibilityRate = useMemo(() => {
    if (memberStats.total === 0) return '0';
    const determined = memberStats.eligible + memberStats.ineligible;
    if (determined === 0) return '0';
    return ((memberStats.eligible / determined) * 100).toFixed(1);
  }, [memberStats]);

  /**
   * Filters members based on search term and active filters.
   */
  const filteredMembers = useMemo(() => {
    let result = Array.isArray(members) ? [...members] : [];

    // Apply search term filter
    if (searchTerm && searchTerm.trim().length > 0) {
      const lowerSearch = searchTerm.toLowerCase().trim();
      result = result.filter((member) => {
        const firstName = (member.firstName || '').toLowerCase();
        const lastName = (member.lastName || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        const memberId = (member.memberId || '').toLowerCase();
        const id = (member.id || '').toLowerCase();
        const state = getMemberState(member).toLowerCase();

        return (
          firstName.includes(lowerSearch) ||
          lastName.includes(lowerSearch) ||
          fullName.includes(lowerSearch) ||
          memberId.includes(lowerSearch) ||
          id.includes(lowerSearch) ||
          state.includes(lowerSearch)
        );
      });
    }

    // Apply eligibility status filter
    if (activeFilters.status) {
      result = result.filter(
        (member) =>
          member.eligibilityStatus === activeFilters.status ||
          member.status === activeFilters.status
      );
    }

    // Apply state filter
    if (activeFilters.state) {
      result = result.filter((member) => {
        const memberState = getMemberState(member);
        return memberState === activeFilters.state;
      });
    }

    return result;
  }, [members, searchTerm, activeFilters]);

  /**
   * Handles viewing member details.
   * @param {object} member - The member to view details for.
   */
  const handleViewMember = useCallback(
    (member) => {
      if (!member) return;

      const userId = currentUser ? currentUser.id : '';
      logAction('Eligibility Result Viewed', member.memberId || member.id, userId, {
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        eligibilityStatus: member.eligibilityStatus || member.status || '',
      });

      if (typeof onMemberSelect === 'function') {
        onMemberSelect(member);
      } else {
        setSelectedMember(member);
        setDetailModalOpen(true);
      }
    },
    [onMemberSelect, currentUser, logAction]
  );

  /**
   * Handles closing the detail modal.
   */
  const handleCloseDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedMember(null);
  }, []);

  /**
   * Handles row click to select a member.
   * @param {object} member - The clicked member row.
   */
  const handleRowClick = useCallback(
    (member) => {
      handleViewMember(member);
    },
    [handleViewMember]
  );

  /**
   * DataTable column definitions.
   * @type {Array<object>}
   */
  const columns = useMemo(
    () => [
      {
        key: 'firstName',
        label: 'Member',
        sortable: true,
        render: (_value, row) => (
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-xs font-semibold text-primary-700">
                {((row.firstName || '').charAt(0) + (row.lastName || '').charAt(0)).toUpperCase() || '?'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {row.firstName || ''} {row.lastName || ''}
                {!row.firstName && !row.lastName && (
                  <span className="text-gray-400">Unknown</span>
                )}
              </p>
              <p className="text-xs text-gray-500">
                {row.memberId || row.id || '—'}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: 'demographics.address.state',
        label: 'State',
        sortable: false,
        render: (_value, row) => {
          const state = getMemberState(row);
          return (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
              {state || '—'}
            </span>
          );
        },
      },
      {
        key: 'appliedRule',
        label: 'Applied Rule',
        sortable: false,
        render: (_value, row) => {
          const ruleDesc = getAppliedRuleDescription(row, rules);
          return (
            <span className="text-xs text-gray-600" title={ruleDesc}>
              {ruleDesc.length > 40 ? ruleDesc.slice(0, 40) + '...' : ruleDesc}
            </span>
          );
        },
      },
      {
        key: 'eligibilityStatus',
        label: 'Result',
        sortable: true,
        render: (value) => (
          <StatusBadge status={value || 'Unknown'} size="sm" />
        ),
      },
      {
        key: 'updatedAt',
        label: 'Determination Date',
        sortable: true,
        render: (_value, row) => {
          const detDate = getDeterminationDate(row);
          return (
            <span className="text-xs text-gray-500">
              {detDate ? formatTimestamp(detDate) : '—'}
            </span>
          );
        },
      },
      {
        key: 'id',
        label: '',
        sortable: false,
        render: (_value, row) => (
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleViewMember(row);
              }}
              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
              aria-label={`View eligibility details for ${row.firstName || ''} ${row.lastName || ''}`}
              title="View Details"
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
          </div>
        ),
      },
    ],
    [rules, handleViewMember]
  );

  /**
   * Search bar filter configuration.
   * @type {Array<object>}
   */
  const searchFilters = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        options: STATUS_FILTER_OPTIONS,
      },
      {
        key: 'state',
        label: 'State',
        options: STATE_FILTER_OPTIONS,
      },
    ],
    []
  );

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Eligibility Results</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {memberStats.total} member{memberStats.total !== 1 ? 's' : ''} processed
            {filteredMembers.length !== memberStats.total && (
              <span className="text-primary-600 ml-2">
                • {filteredMembers.length} matching
              </span>
            )}
          </p>
        </div>

        {/* Eligibility rate badge */}
        {memberStats.total > 0 && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-primary-50 text-primary-700 rounded-full">
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
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              {eligibilityRate}% Eligibility Rate
            </span>
          </div>
        )}
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard
          label="Total Members"
          value={memberStats.total}
          icon="members"
          trend="neutral"
        />
        <StatsCard
          label="Eligible"
          value={memberStats.eligible}
          icon="eligible"
          trend={memberStats.eligible > 0 ? 'up' : 'neutral'}
          trendValue={
            memberStats.total > 0
              ? `${((memberStats.eligible / memberStats.total) * 100).toFixed(0)}%`
              : ''
          }
        />
        <StatsCard
          label="Ineligible"
          value={memberStats.ineligible}
          icon="ineligible"
          trend={memberStats.ineligible > 0 ? 'down' : 'neutral'}
          trendValue={
            memberStats.total > 0
              ? `${((memberStats.ineligible / memberStats.total) * 100).toFixed(0)}%`
              : ''
          }
        />
        <StatsCard
          label="Pending"
          value={memberStats.pending}
          icon="pending"
          trend="neutral"
          trendValue={
            memberStats.total > 0
              ? `${((memberStats.pending / memberStats.total) * 100).toFixed(0)}%`
              : ''
          }
        />
      </div>

      {/* Search and Filters */}
      <SearchBar
        placeholder="Search by name, member ID, or state..."
        onSearch={handleSearch}
        filters={searchFilters}
        debounceMs={300}
      />

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredMembers}
        onRowClick={handleRowClick}
        pageSize={10}
        sortable
        rowKey="id"
        emptyMessage="No eligibility results found. Upload and process an EDI 834 file to see results."
      />

      {/* Member Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={handleCloseDetailModal}
        title="Eligibility Determination Details"
        size="lg"
        actions={[
          {
            label: 'Close',
            onClick: handleCloseDetailModal,
            variant: 'secondary',
          },
        ]}
      >
        {selectedMember && (
          <div className="space-y-5">
            {/* Member Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
              <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-lg font-semibold text-primary-700">
                  {((selectedMember.firstName || '').charAt(0) + (selectedMember.lastName || '').charAt(0)).toUpperCase() || '?'}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-800">
                  {selectedMember.firstName || ''} {selectedMember.lastName || ''}
                  {!selectedMember.firstName && !selectedMember.lastName && (
                    <span className="text-gray-400">Unknown Member</span>
                  )}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusBadge status={selectedMember.eligibilityStatus || selectedMember.status || 'Unknown'} size="md" />
                  <span className="text-xs text-gray-500">
                    ID: {selectedMember.memberId || selectedMember.id || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Eligibility Status Card */}
            <div
              className={`p-4 rounded-lg border ${
                (selectedMember.eligibilityStatus || selectedMember.status) === MEMBER_STATUS.ELIGIBLE
                  ? 'bg-success-50 border-success-200'
                  : (selectedMember.eligibilityStatus || selectedMember.status) === MEMBER_STATUS.INELIGIBLE
                    ? 'bg-error-50 border-error-200'
                    : 'bg-warning-50 border-warning-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {(selectedMember.eligibilityStatus || selectedMember.status) === MEMBER_STATUS.ELIGIBLE && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-success-500 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {(selectedMember.eligibilityStatus || selectedMember.status) === MEMBER_STATUS.INELIGIBLE && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-error-500 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {(selectedMember.eligibilityStatus || selectedMember.status) !== MEMBER_STATUS.ELIGIBLE &&
                  (selectedMember.eligibilityStatus || selectedMember.status) !== MEMBER_STATUS.INELIGIBLE && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-warning-500 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      (selectedMember.eligibilityStatus || selectedMember.status) === MEMBER_STATUS.ELIGIBLE
                        ? 'text-success-800'
                        : (selectedMember.eligibilityStatus || selectedMember.status) === MEMBER_STATUS.INELIGIBLE
                          ? 'text-error-800'
                          : 'text-warning-800'
                    }`}
                  >
                    Determination: {selectedMember.eligibilityStatus || selectedMember.status || 'Unknown'}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${
                      (selectedMember.eligibilityStatus || selectedMember.status) === MEMBER_STATUS.ELIGIBLE
                        ? 'text-success-600'
                        : (selectedMember.eligibilityStatus || selectedMember.status) === MEMBER_STATUS.INELIGIBLE
                          ? 'text-error-600'
                          : 'text-warning-600'
                    }`}
                  >
                    {(selectedMember.eligibilityStatus || selectedMember.status) === MEMBER_STATUS.ELIGIBLE &&
                      'This member meets all eligibility criteria for Medicaid coverage.'}
                    {(selectedMember.eligibilityStatus || selectedMember.status) === MEMBER_STATUS.INELIGIBLE &&
                      'This member does not meet the eligibility criteria for Medicaid coverage.'}
                    {(selectedMember.eligibilityStatus || selectedMember.status) !== MEMBER_STATUS.ELIGIBLE &&
                      (selectedMember.eligibilityStatus || selectedMember.status) !== MEMBER_STATUS.INELIGIBLE &&
                      'Eligibility determination is pending for this member.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Determination Details */}
            <div>
              <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                Determination Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">State</p>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {getStateLabel(getMemberState(selectedMember)) || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Determination Date</p>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {getDeterminationDate(selectedMember)
                      ? formatTimestamp(getDeterminationDate(selectedMember))
                      : '—'}
                  </p>
                </div>
                {selectedMember.demographics && selectedMember.demographics.age !== undefined && selectedMember.demographics.age !== null && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Age</p>
                    <p className="text-sm text-gray-800 mt-0.5">{selectedMember.demographics.age}</p>
                  </div>
                )}
                {selectedMember.income !== undefined && selectedMember.income !== null && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Income</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      ${typeof selectedMember.income === 'number'
                        ? selectedMember.income.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : selectedMember.income}
                    </p>
                  </div>
                )}
                {selectedMember.coverage && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Coverage</p>
                    <p className="text-sm text-gray-800 mt-0.5">{selectedMember.coverage}</p>
                  </div>
                )}
                {selectedMember.effectiveDate && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Effective Date</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      {formatDate(selectedMember.effectiveDate) || selectedMember.effectiveDate}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Applied Rules */}
            <div>
              <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                Applied Eligibility Rules
              </h4>
              {(() => {
                const stateCode = getMemberState(selectedMember);
                let applicableRules = (Array.isArray(rules) ? rules : []).filter(
                  (r) => r.state === stateCode
                );
                if (applicableRules.length === 0) {
                  applicableRules = (Array.isArray(rules) ? rules : []).filter(
                    (r) => r.state === '*'
                  );
                }

                if (applicableRules.length === 0) {
                  return (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-sm text-gray-500">No applicable rules found for this member.</p>
                    </div>
                  );
                }

                return (
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                    {applicableRules.map((rule, index) => (
                      <div
                        key={rule.id || `rule-${index}`}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-800">
                            {formatCriteriaDescription(rule.criteria)}
                          </p>
                          <p className="text-xs text-gray-500">
                            State: {rule.state === '*' ? 'All States (*)' : rule.state || '—'} • Effective: {rule.effectiveDate || '—'}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-gray-500 ml-2">
                          v{rule.version || 1}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Enrollment History */}
            {(() => {
              const history = Array.isArray(selectedMember.enrollmentHistory)
                ? selectedMember.enrollmentHistory
                : Array.isArray(selectedMember.history)
                  ? selectedMember.history
                  : [];

              if (history.length === 0) return null;

              return (
                <div>
                  <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                    History ({history.length})
                  </h4>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {history.map((entry, index) => (
                      <div
                        key={entry.id || `history-${index}`}
                        className="flex items-center justify-between px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-800">
                            {entry.action || 'Unknown Action'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {entry.timestamp
                              ? formatTimestamp(entry.timestamp)
                              : '—'}
                          </p>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          <StatusBadge status={entry.status || 'Unknown'} size="sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}

EligibilityResults.propTypes = {
  className: PropTypes.string,
  onMemberSelect: PropTypes.func,
};

EligibilityResults.defaultProps = {
  className: '',
  onMemberSelect: undefined,
};

export default EligibilityResults;