import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useEnrollmentStore } from '../../stores/enrollmentStore';
import { useMemberStore } from '../../stores/memberStore';
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
 * Status filter options for enrollment list.
 * @type {Array<{ value: string, label: string }>}
 */
const STATUS_FILTER_OPTIONS = [
  { value: MEMBER_STATUS.ELIGIBLE, label: 'Eligible' },
  { value: MEMBER_STATUS.INELIGIBLE, label: 'Ineligible' },
  { value: MEMBER_STATUS.PENDING, label: 'Pending' },
];

/**
 * Resolves the member name for a given memberId from the member store.
 * @param {string} memberId - The member ID to look up.
 * @param {Array<object>} members - The members array from the store.
 * @returns {{ firstName: string, lastName: string }} The member's first and last name.
 */
function resolveMemberName(memberId, members) {
  if (!memberId || !Array.isArray(members)) {
    return { firstName: '', lastName: '' };
  }

  const member = members.find(
    (m) => m.memberId === memberId || m.id === memberId
  );

  if (member) {
    return {
      firstName: member.firstName || '',
      lastName: member.lastName || '',
    };
  }

  return { firstName: '', lastName: '' };
}

/**
 * EnrollmentList component.
 * Displays enrollment records in a DataTable with columns: enrollment ID, member name,
 * plan, status, effective date, termination date. Supports search, filter by status,
 * and pagination. Clicking a row shows enrollment detail.
 *
 * @param {{
 *   className?: string,
 *   onEnrollmentSelect?: (enrollment: object) => void,
 * }} props
 * @returns {import('react').ReactElement}
 */
export function EnrollmentList({ className, onEnrollmentSelect }) {
  const enrollments = useEnrollmentStore((state) => state.enrollments);
  const members = useMemberStore((state) => state.members);
  const { currentUser } = useAuth();
  const logAction = useAuditStore((state) => state.logAction);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);

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
   * Enrollment statistics summary.
   */
  const enrollmentStats = useMemo(() => {
    const allEnrollments = Array.isArray(enrollments) ? enrollments : [];
    return {
      total: allEnrollments.length,
      eligible: allEnrollments.filter((e) => e.status === MEMBER_STATUS.ELIGIBLE).length,
      ineligible: allEnrollments.filter((e) => e.status === MEMBER_STATUS.INELIGIBLE).length,
      pending: allEnrollments.filter((e) => e.status === MEMBER_STATUS.PENDING).length,
    };
  }, [enrollments]);

  /**
   * Enriched enrollments with member name data for search and display.
   */
  const enrichedEnrollments = useMemo(() => {
    const allEnrollments = Array.isArray(enrollments) ? enrollments : [];
    const allMembers = Array.isArray(members) ? members : [];

    return allEnrollments.map((enrollment) => {
      const { firstName, lastName } = resolveMemberName(enrollment.memberId, allMembers);
      return {
        ...enrollment,
        memberFirstName: firstName,
        memberLastName: lastName,
        memberFullName: [firstName, lastName].filter(Boolean).join(' '),
      };
    });
  }, [enrollments, members]);

  /**
   * Filters enrollments based on search term and active filters.
   */
  const filteredEnrollments = useMemo(() => {
    let result = [...enrichedEnrollments];

    // Apply search term filter
    if (searchTerm && searchTerm.trim().length > 0) {
      const lowerSearch = searchTerm.toLowerCase().trim();
      result = result.filter((enrollment) => {
        const enrollmentId = (enrollment.id || '').toLowerCase();
        const memberId = (enrollment.memberId || '').toLowerCase();
        const planId = (enrollment.planId || '').toLowerCase();
        const coverage = (enrollment.coverage || '').toLowerCase();
        const memberName = (enrollment.memberFullName || '').toLowerCase();

        return (
          enrollmentId.includes(lowerSearch) ||
          memberId.includes(lowerSearch) ||
          planId.includes(lowerSearch) ||
          coverage.includes(lowerSearch) ||
          memberName.includes(lowerSearch)
        );
      });
    }

    // Apply status filter
    if (activeFilters.status) {
      result = result.filter((enrollment) => enrollment.status === activeFilters.status);
    }

    return result;
  }, [enrichedEnrollments, searchTerm, activeFilters]);

  /**
   * Handles viewing enrollment details.
   * @param {object} enrollment - The enrollment to view details for.
   */
  const handleViewEnrollment = useCallback(
    (enrollment) => {
      if (!enrollment) return;

      const userId = currentUser ? currentUser.id : '';
      logAction('Enrollment Viewed', enrollment.id, userId, {
        memberId: enrollment.memberId || '',
        status: enrollment.status || '',
        planId: enrollment.planId || '',
      });

      if (typeof onEnrollmentSelect === 'function') {
        onEnrollmentSelect(enrollment);
      } else {
        setSelectedEnrollment(enrollment);
        setDetailModalOpen(true);
      }
    },
    [onEnrollmentSelect, currentUser, logAction]
  );

  /**
   * Handles closing the detail modal.
   */
  const handleCloseDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedEnrollment(null);
  }, []);

  /**
   * Handles row click to select an enrollment.
   * @param {object} enrollment - The clicked enrollment row.
   */
  const handleRowClick = useCallback(
    (enrollment) => {
      handleViewEnrollment(enrollment);
    },
    [handleViewEnrollment]
  );

  /**
   * DataTable column definitions.
   * @type {Array<object>}
   */
  const columns = useMemo(
    () => [
      {
        key: 'id',
        label: 'Enrollment ID',
        sortable: true,
        render: (value) => (
          <span className="font-mono text-xs text-gray-800" title={value}>
            {value ? value.substring(0, 8) + '...' : '—'}
          </span>
        ),
      },
      {
        key: 'memberFullName',
        label: 'Member',
        sortable: true,
        render: (_value, row) => (
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-xs font-semibold text-primary-700">
                {((row.memberFirstName || '').charAt(0) + (row.memberLastName || '').charAt(0)).toUpperCase() || '?'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {row.memberFirstName || ''} {row.memberLastName || ''}
                {!row.memberFirstName && !row.memberLastName && (
                  <span className="text-gray-400">Unknown</span>
                )}
              </p>
              <p className="text-xs text-gray-500">
                {row.memberId || '—'}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: 'planId',
        label: 'Plan',
        sortable: true,
        render: (value, row) => {
          const displayPlan = row.coverage || value || '—';
          return (
            <span className="text-xs text-gray-700" title={displayPlan}>
              {displayPlan.length > 30 ? displayPlan.slice(0, 30) + '...' : displayPlan}
            </span>
          );
        },
      },
      {
        key: 'status',
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
        key: 'actions',
        label: '',
        sortable: false,
        render: (_value, row) => (
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleViewEnrollment(row);
              }}
              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
              aria-label={`View enrollment details for ${row.memberFirstName || ''} ${row.memberLastName || ''}`}
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
    [handleViewEnrollment]
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
    ],
    []
  );

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Enrollment Records</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {enrollmentStats.total} enrollment{enrollmentStats.total !== 1 ? 's' : ''} total
            {filteredEnrollments.length !== enrollmentStats.total && (
              <span className="text-primary-600 ml-2">
                • {filteredEnrollments.length} matching
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
            {enrollmentStats.eligible} eligible
          </span>
          {enrollmentStats.ineligible > 0 && (
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
              {enrollmentStats.ineligible} ineligible
            </span>
          )}
          {enrollmentStats.pending > 0 && (
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
              {enrollmentStats.pending} pending
            </span>
          )}
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard
          label="Total Enrollments"
          value={enrollmentStats.total}
          icon="enrollments"
          trend="neutral"
        />
        <StatsCard
          label="Eligible"
          value={enrollmentStats.eligible}
          icon="eligible"
          trend={enrollmentStats.eligible > 0 ? 'up' : 'neutral'}
          trendValue={
            enrollmentStats.total > 0
              ? `${((enrollmentStats.eligible / enrollmentStats.total) * 100).toFixed(0)}%`
              : ''
          }
        />
        <StatsCard
          label="Ineligible"
          value={enrollmentStats.ineligible}
          icon="ineligible"
          trend={enrollmentStats.ineligible > 0 ? 'down' : 'neutral'}
          trendValue={
            enrollmentStats.total > 0
              ? `${((enrollmentStats.ineligible / enrollmentStats.total) * 100).toFixed(0)}%`
              : ''
          }
        />
        <StatsCard
          label="Pending"
          value={enrollmentStats.pending}
          icon="pending"
          trend="neutral"
          trendValue={
            enrollmentStats.total > 0
              ? `${((enrollmentStats.pending / enrollmentStats.total) * 100).toFixed(0)}%`
              : ''
          }
        />
      </div>

      {/* Search and Filters */}
      <SearchBar
        placeholder="Search by enrollment ID, member name, plan, or member ID..."
        onSearch={handleSearch}
        filters={searchFilters}
        debounceMs={300}
      />

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredEnrollments}
        onRowClick={handleRowClick}
        pageSize={10}
        sortable
        rowKey="id"
        emptyMessage="No enrollment records found. Upload and process an EDI 834 file to create enrollments."
      />

      {/* Enrollment Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={handleCloseDetailModal}
        title="Enrollment Details"
        size="lg"
        actions={[
          {
            label: 'Close',
            onClick: handleCloseDetailModal,
            variant: 'secondary',
          },
        ]}
      >
        {selectedEnrollment && (
          <div className="space-y-5">
            {/* Enrollment Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
              <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-lg font-semibold text-primary-700">
                  {((selectedEnrollment.memberFirstName || '').charAt(0) + (selectedEnrollment.memberLastName || '').charAt(0)).toUpperCase() || '?'}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-800">
                  {selectedEnrollment.memberFirstName || ''} {selectedEnrollment.memberLastName || ''}
                  {!selectedEnrollment.memberFirstName && !selectedEnrollment.memberLastName && (
                    <span className="text-gray-400">Unknown Member</span>
                  )}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusBadge status={selectedEnrollment.status || 'Unknown'} size="md" />
                  <span className="text-xs text-gray-500">
                    Member ID: {selectedEnrollment.memberId || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Card */}
            <div
              className={`p-4 rounded-lg border ${
                selectedEnrollment.status === MEMBER_STATUS.ELIGIBLE
                  ? 'bg-success-50 border-success-200'
                  : selectedEnrollment.status === MEMBER_STATUS.INELIGIBLE
                    ? 'bg-error-50 border-error-200'
                    : 'bg-warning-50 border-warning-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {selectedEnrollment.status === MEMBER_STATUS.ELIGIBLE && (
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
                {selectedEnrollment.status === MEMBER_STATUS.INELIGIBLE && (
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
                {selectedEnrollment.status !== MEMBER_STATUS.ELIGIBLE &&
                  selectedEnrollment.status !== MEMBER_STATUS.INELIGIBLE && (
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
                      selectedEnrollment.status === MEMBER_STATUS.ELIGIBLE
                        ? 'text-success-800'
                        : selectedEnrollment.status === MEMBER_STATUS.INELIGIBLE
                          ? 'text-error-800'
                          : 'text-warning-800'
                    }`}
                  >
                    Enrollment Status: {selectedEnrollment.status || 'Unknown'}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${
                      selectedEnrollment.status === MEMBER_STATUS.ELIGIBLE
                        ? 'text-success-600'
                        : selectedEnrollment.status === MEMBER_STATUS.INELIGIBLE
                          ? 'text-error-600'
                          : 'text-warning-600'
                    }`}
                  >
                    {selectedEnrollment.status === MEMBER_STATUS.ELIGIBLE &&
                      'This enrollment is active and the member is eligible for Medicaid coverage.'}
                    {selectedEnrollment.status === MEMBER_STATUS.INELIGIBLE &&
                      'This enrollment is inactive. The member does not meet eligibility criteria.'}
                    {selectedEnrollment.status !== MEMBER_STATUS.ELIGIBLE &&
                      selectedEnrollment.status !== MEMBER_STATUS.INELIGIBLE &&
                      'This enrollment is pending eligibility determination.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Enrollment Details */}
            <div>
              <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                Enrollment Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Enrollment ID</p>
                  <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs break-all">
                    {selectedEnrollment.id || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Member ID</p>
                  <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs">
                    {selectedEnrollment.memberId || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Plan</p>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {selectedEnrollment.coverage || selectedEnrollment.planId || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedEnrollment.status || 'Unknown'} size="md" />
                  </div>
                </div>
                {selectedEnrollment.effectiveDate && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Effective Date</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      {formatDate(selectedEnrollment.effectiveDate) || selectedEnrollment.effectiveDate}
                    </p>
                  </div>
                )}
                {selectedEnrollment.terminationDate && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Termination Date</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      {formatDate(selectedEnrollment.terminationDate) || selectedEnrollment.terminationDate}
                    </p>
                  </div>
                )}
                {selectedEnrollment.createdAt && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Created At</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      {formatTimestamp(selectedEnrollment.createdAt)}
                    </p>
                  </div>
                )}
                {selectedEnrollment.updatedAt && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Last Updated</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      {formatTimestamp(selectedEnrollment.updatedAt)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Demographics */}
            {selectedEnrollment.demographics && typeof selectedEnrollment.demographics === 'object' && Object.keys(selectedEnrollment.demographics).length > 0 && (
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                  Demographics
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedEnrollment.demographics.dateOfBirth && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Date of Birth</p>
                      <p className="text-sm text-gray-800 mt-0.5">
                        {formatDate(selectedEnrollment.demographics.dateOfBirth) || selectedEnrollment.demographics.dateOfBirth}
                      </p>
                    </div>
                  )}
                  {selectedEnrollment.demographics.gender && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Gender</p>
                      <p className="text-sm text-gray-800 mt-0.5">{selectedEnrollment.demographics.gender}</p>
                    </div>
                  )}
                  {selectedEnrollment.demographics.age !== undefined && selectedEnrollment.demographics.age !== null && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Age</p>
                      <p className="text-sm text-gray-800 mt-0.5">{selectedEnrollment.demographics.age}</p>
                    </div>
                  )}
                  {selectedEnrollment.demographics.address && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Address</p>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                        {selectedEnrollment.demographics.address.line1 && (
                          <p className="text-sm text-gray-800">{selectedEnrollment.demographics.address.line1}</p>
                        )}
                        {selectedEnrollment.demographics.address.line2 && (
                          <p className="text-sm text-gray-800">{selectedEnrollment.demographics.address.line2}</p>
                        )}
                        <p className="text-sm text-gray-800">
                          {[
                            selectedEnrollment.demographics.address.city,
                            selectedEnrollment.demographics.address.state,
                            selectedEnrollment.demographics.address.zipCode,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Enrollment History */}
            {Array.isArray(selectedEnrollment.history) && selectedEnrollment.history.length > 0 && (
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                  Enrollment History ({selectedEnrollment.history.length})
                </h4>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {selectedEnrollment.history.map((entry, index) => (
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
                        {entry.previousStatus && entry.previousStatus !== entry.status && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Changed from <span className="font-medium">{entry.previousStatus}</span> to{' '}
                            <span className="font-medium">{entry.status}</span>
                          </p>
                        )}
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

EnrollmentList.propTypes = {
  className: PropTypes.string,
  onEnrollmentSelect: PropTypes.func,
};

EnrollmentList.defaultProps = {
  className: '',
  onEnrollmentSelect: undefined,
};

export default EnrollmentList;