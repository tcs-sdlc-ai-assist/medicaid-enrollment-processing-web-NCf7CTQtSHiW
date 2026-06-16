import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useMemberStore } from '../../stores/memberStore';
import { useAuditStore } from '../../stores/auditStore';
import { useAuth } from '../../contexts/AuthContext';
import { MEMBER_STATUS } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';
import { DataTable } from '../common/DataTable';
import { SearchBar } from '../common/SearchBar';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';

/**
 * Status filter options for member search.
 * @type {Array<{ value: string, label: string }>}
 */
const STATUS_FILTER_OPTIONS = [
  { value: MEMBER_STATUS.ELIGIBLE, label: 'Eligible' },
  { value: MEMBER_STATUS.INELIGIBLE, label: 'Ineligible' },
  { value: MEMBER_STATUS.PENDING, label: 'Pending' },
];

/**
 * State filter options for member search.
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
 * Resolves the date of birth from a member's demographics.
 * @param {object} member - The member record.
 * @returns {string} The date of birth string or empty string.
 */
function getMemberDOB(member) {
  if (
    member &&
    member.demographics &&
    typeof member.demographics === 'object'
  ) {
    return member.demographics.dateOfBirth || '';
  }
  return '';
}

/**
 * MemberSearch component.
 * Provides search fields for member ID, name, SSN (last 4), state, and eligibility status.
 * Displays results in a DataTable with columns: ID, name, DOB, state, status, coverage dates.
 * Clicking a row opens a member detail modal or navigates to member detail.
 *
 * @param {{
 *   className?: string,
 *   onMemberSelect?: (member: object) => void,
 * }} props
 * @returns {import('react').ReactElement}
 */
export function MemberSearch({ className, onMemberSelect }) {
  const members = useMemberStore((state) => state.members);
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
   * Filters members based on search term and active filters.
   */
  const filteredMembers = useMemo(() => {
    let result = Array.isArray(members) ? [...members] : [];

    // Apply search term filter (searches across name, memberId, and last 4 of SSN-like IDs)
    if (searchTerm && searchTerm.trim().length > 0) {
      const lowerSearch = searchTerm.toLowerCase().trim();
      result = result.filter((member) => {
        const firstName = (member.firstName || '').toLowerCase();
        const lastName = (member.lastName || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        const memberId = (member.memberId || '').toLowerCase();
        const id = (member.id || '').toLowerCase();

        // Check SSN-like match (last 4 digits)
        let ssnMatch = false;
        if (
          member.names &&
          member.names.member &&
          member.names.member.idCode
        ) {
          const idCode = member.names.member.idCode;
          if (lowerSearch.length <= 4) {
            const last4 = idCode.slice(-4);
            ssnMatch = last4.includes(lowerSearch);
          }
        }

        return (
          firstName.includes(lowerSearch) ||
          lastName.includes(lowerSearch) ||
          fullName.includes(lowerSearch) ||
          memberId.includes(lowerSearch) ||
          id.includes(lowerSearch) ||
          ssnMatch
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
      logAction('Member Viewed', member.memberId || member.id, userId, {
        firstName: member.firstName || '',
        lastName: member.lastName || '',
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
        key: 'memberId',
        label: 'Member ID',
        sortable: true,
        render: (value) => (
          <span className="font-mono text-xs text-gray-800">
            {value || '—'}
          </span>
        ),
      },
      {
        key: 'firstName',
        label: 'Name',
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
            </div>
          </div>
        ),
      },
      {
        key: 'demographics',
        label: 'DOB',
        sortable: false,
        render: (_value, row) => {
          const dob = getMemberDOB(row);
          return (
            <span className="text-xs text-gray-600">
              {dob ? formatDate(dob) : '—'}
            </span>
          );
        },
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
        key: 'eligibilityStatus',
        label: 'Status',
        sortable: true,
        render: (value) => (
          <StatusBadge status={value || 'Unknown'} size="sm" />
        ),
      },
      {
        key: 'effectiveDate',
        label: 'Effective Date',
        sortable: true,
        render: (value) => (
          <span className="text-xs text-gray-600">
            {value ? formatDate(value) : '—'}
          </span>
        ),
      },
      {
        key: 'terminationDate',
        label: 'Term Date',
        sortable: true,
        render: (value) => (
          <span className="text-xs text-gray-600">
            {value ? formatDate(value) : '—'}
          </span>
        ),
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
              aria-label={`View details for ${row.firstName || ''} ${row.lastName || ''}`}
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
    [handleViewMember]
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

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Member Search</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {memberStats.total} member{memberStats.total !== 1 ? 's' : ''} total
            {filteredMembers.length !== memberStats.total && (
              <span className="text-primary-600 ml-2">
                • {filteredMembers.length} matching
              </span>
            )}
          </p>
        </div>

        {/* Quick stat badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-success-50 text-success-700 rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {memberStats.eligible} eligible
          </span>
          {memberStats.ineligible > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-error-50 text-error-700 rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {memberStats.ineligible} ineligible
            </span>
          )}
          {memberStats.pending > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-warning-50 text-warning-700 rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {memberStats.pending} pending
            </span>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <SearchBar
        placeholder="Search by name, member ID, or last 4 of SSN..."
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
        emptyMessage="No members found. Try adjusting your search criteria or upload an EDI 834 file to add members."
      />

      {/* Member Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={handleCloseDetailModal}
        title="Member Details"
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

            {/* Personal Information */}
            <div>
              <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Personal Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">First Name</p>
                  <p className="text-sm text-gray-800 mt-0.5">{selectedMember.firstName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Last Name</p>
                  <p className="text-sm text-gray-800 mt-0.5">{selectedMember.lastName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Member ID</p>
                  <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs">{selectedMember.memberId || selectedMember.id || '—'}</p>
                </div>
                {selectedMember.demographics && selectedMember.demographics.dateOfBirth && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Date of Birth</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      {formatDate(selectedMember.demographics.dateOfBirth) || selectedMember.demographics.dateOfBirth}
                    </p>
                  </div>
                )}
                {selectedMember.demographics && selectedMember.demographics.age !== undefined && selectedMember.demographics.age !== null && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Age</p>
                    <p className="text-sm text-gray-800 mt-0.5">{selectedMember.demographics.age}</p>
                  </div>
                )}
                {selectedMember.demographics && selectedMember.demographics.gender && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Gender</p>
                    <p className="text-sm text-gray-800 mt-0.5">{selectedMember.demographics.gender}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            {selectedMember.demographics && selectedMember.demographics.address && (
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Address</h4>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  {selectedMember.demographics.address.line1 && (
                    <p className="text-sm text-gray-800">{selectedMember.demographics.address.line1}</p>
                  )}
                  {selectedMember.demographics.address.line2 && (
                    <p className="text-sm text-gray-800">{selectedMember.demographics.address.line2}</p>
                  )}
                  <p className="text-sm text-gray-800">
                    {[
                      selectedMember.demographics.address.city,
                      selectedMember.demographics.address.state,
                      selectedMember.demographics.address.zipCode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {selectedMember.demographics.address.countryCode && (
                    <p className="text-xs text-gray-500 mt-0.5">{selectedMember.demographics.address.countryCode}</p>
                  )}
                </div>
              </div>
            )}

            {/* Coverage & Eligibility */}
            <div>
              <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Coverage & Eligibility</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Eligibility Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedMember.eligibilityStatus || selectedMember.status || 'Unknown'} size="md" />
                  </div>
                </div>
                {selectedMember.coverage && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Coverage</p>
                    <p className="text-sm text-gray-800 mt-0.5">{selectedMember.coverage}</p>
                  </div>
                )}
                {selectedMember.effectiveDate && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Effective Date</p>
                    <p className="text-sm text-gray-800 mt-0.5">{formatDate(selectedMember.effectiveDate) || selectedMember.effectiveDate}</p>
                  </div>
                )}
                {selectedMember.terminationDate && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Termination Date</p>
                    <p className="text-sm text-gray-800 mt-0.5">{formatDate(selectedMember.terminationDate) || selectedMember.terminationDate}</p>
                  </div>
                )}
                {selectedMember.income !== undefined && selectedMember.income !== null && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Income</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      ${typeof selectedMember.income === 'number' ? selectedMember.income.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : selectedMember.income}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Enrollment History */}
            {Array.isArray(selectedMember.enrollmentHistory) && selectedMember.enrollmentHistory.length > 0 && (
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                  Enrollment History ({selectedMember.enrollmentHistory.length})
                </h4>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {selectedMember.enrollmentHistory.map((entry, index) => (
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
                            ? new Date(entry.timestamp).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
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
            )}

            {/* Fallback to history if enrollmentHistory is empty */}
            {(!Array.isArray(selectedMember.enrollmentHistory) || selectedMember.enrollmentHistory.length === 0) &&
              Array.isArray(selectedMember.history) && selectedMember.history.length > 0 && (
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                  History ({selectedMember.history.length})
                </h4>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {selectedMember.history.map((entry, index) => (
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
                            ? new Date(entry.timestamp).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
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
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

MemberSearch.propTypes = {
  className: PropTypes.string,
  onMemberSelect: PropTypes.func,
};

MemberSearch.defaultProps = {
  className: '',
  onMemberSelect: undefined,
};

export default MemberSearch;