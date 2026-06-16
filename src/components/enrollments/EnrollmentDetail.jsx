import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useEnrollmentStore } from '../../stores/enrollmentStore';
import { useMemberStore } from '../../stores/memberStore';
import { useAuditStore } from '../../stores/auditStore';
import { useAuth } from '../../contexts/AuthContext';
import { MEMBER_STATUS } from '../../utils/constants';
import { formatDate, formatTimestamp } from '../../utils/helpers';
import { StatusBadge } from '../common/StatusBadge';
import { AlertMessage } from '../common/AlertMessage';

/**
 * Tabs available in the enrollment detail view.
 * @type {Array<{ key: string, label: string }>}
 */
const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'member', label: 'Member Info' },
  { key: 'history', label: 'History' },
];

/**
 * Resolves the member record for a given memberId from the member store.
 * @param {string} memberId - The member ID to look up.
 * @param {Array<object>} members - The members array from the store.
 * @returns {object|null} The member record, or null if not found.
 */
function resolveMember(memberId, members) {
  if (!memberId || !Array.isArray(members)) {
    return null;
  }

  return members.find(
    (m) => m.memberId === memberId || m.id === memberId
  ) || null;
}

/**
 * EnrollmentDetail component.
 * Displays a detailed view of a single enrollment including enrollment ID,
 * member info, plan details, status, effective/termination dates, and full
 * history timeline of enrollment actions (created, updated, status changes)
 * with timestamps.
 *
 * @param {{
 *   enrollmentId?: string,
 *   enrollment?: object,
 *   className?: string,
 *   onClose?: () => void,
 * }} props
 * @returns {import('react').ReactElement}
 */
export function EnrollmentDetail({ enrollmentId, enrollment: enrollmentProp, className, onClose }) {
  const getEnrollment = useEnrollmentStore((state) => state.getEnrollment);
  const enrollments = useEnrollmentStore((state) => state.enrollments);
  const members = useMemberStore((state) => state.members);
  const { currentUser } = useAuth();
  const logAction = useAuditStore((state) => state.logAction);

  const [activeTab, setActiveTab] = useState('details');

  /**
   * Resolve the enrollment from either the prop or the store.
   */
  const enrollment = useMemo(() => {
    if (enrollmentProp && typeof enrollmentProp === 'object' && enrollmentProp.id) {
      return enrollmentProp;
    }
    if (enrollmentId) {
      return getEnrollment(enrollmentId);
    }
    return null;
  }, [enrollmentProp, enrollmentId, getEnrollment, enrollments]);

  /**
   * Resolve the associated member record.
   */
  const member = useMemo(() => {
    if (!enrollment || !enrollment.memberId) {
      return null;
    }
    return resolveMember(enrollment.memberId, Array.isArray(members) ? members : []);
  }, [enrollment, members]);

  /**
   * Enrollment history entries.
   */
  const enrollmentHistory = useMemo(() => {
    if (!enrollment) return [];
    return Array.isArray(enrollment.history) ? enrollment.history : [];
  }, [enrollment]);

  /**
   * Handles tab change.
   * @param {string} tabKey - The tab key to switch to.
   */
  const handleTabChange = useCallback(
    (tabKey) => {
      setActiveTab(tabKey);

      if (enrollment) {
        const userId = currentUser ? currentUser.id : '';
        logAction('Enrollment Tab Viewed', enrollment.id, userId, {
          tab: tabKey,
          memberId: enrollment.memberId || '',
        });
      }
    },
    [enrollment, currentUser, logAction]
  );

  // If no enrollment found, show empty state
  if (!enrollment) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm p-8 ${className || ''}`}>
        <div className="flex flex-col items-center justify-center py-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-gray-300 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          <p className="text-sm text-gray-500">Enrollment not found.</p>
          {typeof onClose === 'function' && (
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const enrollmentStatus = enrollment.status || 'Unknown';
  const memberFirstName = member ? (member.firstName || '') : (enrollment.memberFirstName || '');
  const memberLastName = member ? (member.lastName || '') : (enrollment.memberLastName || '');
  const initials = ((memberFirstName.charAt(0) || '') + (memberLastName.charAt(0) || '')).toUpperCase() || '?';

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-lg font-semibold text-primary-700">
                {initials}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-800 truncate">
                {memberFirstName || ''} {memberLastName || ''}
                {!memberFirstName && !memberLastName && (
                  <span className="text-gray-400">Unknown Member</span>
                )}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <StatusBadge status={enrollmentStatus} size="md" />
                <span className="text-xs text-gray-500">
                  Enrollment ID: {enrollment.id ? enrollment.id.substring(0, 12) + '...' : '—'}
                </span>
                <span className="text-xs text-gray-500">
                  Member ID: {enrollment.memberId || '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {typeof onClose === 'function' && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Enrollment Status Card */}
      <div
        className={`border rounded-lg shadow-sm p-4 ${
          enrollmentStatus === MEMBER_STATUS.ELIGIBLE
            ? 'bg-success-50 border-success-200'
            : enrollmentStatus === MEMBER_STATUS.INELIGIBLE
              ? 'bg-error-50 border-error-200'
              : 'bg-warning-50 border-warning-200'
        }`}
      >
        <div className="flex items-center gap-3">
          {enrollmentStatus === MEMBER_STATUS.ELIGIBLE && (
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
          {enrollmentStatus === MEMBER_STATUS.INELIGIBLE && (
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
          {enrollmentStatus !== MEMBER_STATUS.ELIGIBLE && enrollmentStatus !== MEMBER_STATUS.INELIGIBLE && (
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
                enrollmentStatus === MEMBER_STATUS.ELIGIBLE
                  ? 'text-success-800'
                  : enrollmentStatus === MEMBER_STATUS.INELIGIBLE
                    ? 'text-error-800'
                    : 'text-warning-800'
              }`}
            >
              Enrollment Status: {enrollmentStatus}
            </p>
            <p
              className={`text-xs mt-0.5 ${
                enrollmentStatus === MEMBER_STATUS.ELIGIBLE
                  ? 'text-success-600'
                  : enrollmentStatus === MEMBER_STATUS.INELIGIBLE
                    ? 'text-error-600'
                    : 'text-warning-600'
              }`}
            >
              {enrollmentStatus === MEMBER_STATUS.ELIGIBLE &&
                'This enrollment is active and the member is eligible for Medicaid coverage.'}
              {enrollmentStatus === MEMBER_STATUS.INELIGIBLE &&
                'This enrollment is inactive. The member does not meet eligibility criteria.'}
              {enrollmentStatus !== MEMBER_STATUS.ELIGIBLE &&
                enrollmentStatus !== MEMBER_STATUS.INELIGIBLE &&
                'This enrollment is pending eligibility determination.'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 sm:flex-none px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-700 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              aria-selected={activeTab === tab.key}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Enrollment Information */}
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                  Enrollment Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Enrollment ID</p>
                    <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs break-all">
                      {enrollment.id || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Member ID</p>
                    <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs">
                      {enrollment.memberId || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Status</p>
                    <div className="mt-1">
                      <StatusBadge status={enrollmentStatus} size="md" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Plan Details */}
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                  Plan Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Plan ID</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      {enrollment.planId || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Coverage</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      {enrollment.coverage || '—'}
                    </p>
                  </div>
                  {enrollment.effectiveDate && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Effective Date</p>
                      <p className="text-sm text-gray-800 mt-0.5">
                        {formatDate(enrollment.effectiveDate) || enrollment.effectiveDate}
                      </p>
                    </div>
                  )}
                  {enrollment.terminationDate && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Termination Date</p>
                      <p className="text-sm text-gray-800 mt-0.5">
                        {formatDate(enrollment.terminationDate) || enrollment.terminationDate}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamps */}
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                  Record Timestamps
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {enrollment.createdAt && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Created At</p>
                      <p className="text-sm text-gray-800 mt-0.5">
                        {formatTimestamp(enrollment.createdAt)}
                      </p>
                    </div>
                  )}
                  {enrollment.updatedAt && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Last Updated</p>
                      <p className="text-sm text-gray-800 mt-0.5">
                        {formatTimestamp(enrollment.updatedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Member Info Tab */}
          {activeTab === 'member' && (
            <div className="space-y-6">
              {member ? (
                <>
                  {/* Personal Information */}
                  <div>
                    <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                      Personal Information
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">First Name</p>
                        <p className="text-sm text-gray-800 mt-0.5">{member.firstName || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Last Name</p>
                        <p className="text-sm text-gray-800 mt-0.5">{member.lastName || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Member ID</p>
                        <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs">
                          {member.memberId || member.id || '—'}
                        </p>
                      </div>
                      {member.demographics && member.demographics.dateOfBirth && (
                        <div>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Date of Birth</p>
                          <p className="text-sm text-gray-800 mt-0.5">
                            {formatDate(member.demographics.dateOfBirth) || member.demographics.dateOfBirth}
                          </p>
                        </div>
                      )}
                      {member.demographics && member.demographics.age !== undefined && member.demographics.age !== null && (
                        <div>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Age</p>
                          <p className="text-sm text-gray-800 mt-0.5">{member.demographics.age}</p>
                        </div>
                      )}
                      {member.demographics && member.demographics.gender && (
                        <div>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Gender</p>
                          <p className="text-sm text-gray-800 mt-0.5">{member.demographics.gender}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  {member.demographics && member.demographics.address && (
                    <div>
                      <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Address</h4>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                        {member.demographics.address.line1 && (
                          <p className="text-sm text-gray-800">{member.demographics.address.line1}</p>
                        )}
                        {member.demographics.address.line2 && (
                          <p className="text-sm text-gray-800">{member.demographics.address.line2}</p>
                        )}
                        <p className="text-sm text-gray-800">
                          {[
                            member.demographics.address.city,
                            member.demographics.address.state,
                            member.demographics.address.zipCode,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                        {member.demographics.address.countryCode && (
                          <p className="text-xs text-gray-500 mt-0.5">{member.demographics.address.countryCode}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Eligibility */}
                  <div>
                    <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                      Eligibility
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Eligibility Status</p>
                        <div className="mt-1">
                          <StatusBadge status={member.eligibilityStatus || member.status || 'Unknown'} size="md" />
                        </div>
                      </div>
                      {member.coverage && (
                        <div>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Coverage</p>
                          <p className="text-sm text-gray-800 mt-0.5">{member.coverage}</p>
                        </div>
                      )}
                      {member.income !== undefined && member.income !== null && (
                        <div>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Income</p>
                          <p className="text-sm text-gray-800 mt-0.5">
                            ${typeof member.income === 'number'
                              ? member.income.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : member.income}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Demographics from enrollment if member not found */
                enrollment.demographics && typeof enrollment.demographics === 'object' && Object.keys(enrollment.demographics).length > 0 ? (
                  <div>
                    <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                      Demographics (from Enrollment)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {enrollment.demographics.dateOfBirth && (
                        <div>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Date of Birth</p>
                          <p className="text-sm text-gray-800 mt-0.5">
                            {formatDate(enrollment.demographics.dateOfBirth) || enrollment.demographics.dateOfBirth}
                          </p>
                        </div>
                      )}
                      {enrollment.demographics.gender && (
                        <div>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Gender</p>
                          <p className="text-sm text-gray-800 mt-0.5">{enrollment.demographics.gender}</p>
                        </div>
                      )}
                      {enrollment.demographics.age !== undefined && enrollment.demographics.age !== null && (
                        <div>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Age</p>
                          <p className="text-sm text-gray-800 mt-0.5">{enrollment.demographics.age}</p>
                        </div>
                      )}
                      {enrollment.demographics.address && (
                        <div className="sm:col-span-2">
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Address</p>
                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                            {enrollment.demographics.address.line1 && (
                              <p className="text-sm text-gray-800">{enrollment.demographics.address.line1}</p>
                            )}
                            {enrollment.demographics.address.line2 && (
                              <p className="text-sm text-gray-800">{enrollment.demographics.address.line2}</p>
                            )}
                            <p className="text-sm text-gray-800">
                              {[
                                enrollment.demographics.address.city,
                                enrollment.demographics.address.state,
                                enrollment.demographics.address.zipCode,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-10 w-10 text-gray-300 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <p className="text-sm text-gray-500">
                      Member information not available. Member ID: {enrollment.memberId || '—'}
                    </p>
                  </div>
                )
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                  Enrollment History {enrollmentHistory.length > 0 ? `(${enrollmentHistory.length})` : ''}
                </h4>

                {enrollmentHistory.length > 0 ? (
                  <div className="relative">
                    <div className="space-y-0">
                      {enrollmentHistory.map((entry, index) => {
                        const isLast = index === enrollmentHistory.length - 1;
                        const entryStatus = entry.status || 'Unknown';

                        let statusColor = 'bg-gray-100 border-gray-300';
                        let iconColor = 'text-gray-500';
                        if (
                          entryStatus === MEMBER_STATUS.ELIGIBLE ||
                          entryStatus === 'Completed' ||
                          entryStatus === 'Success'
                        ) {
                          statusColor = 'bg-success-100 border-success-500';
                          iconColor = 'text-success-600';
                        } else if (
                          entryStatus === MEMBER_STATUS.INELIGIBLE ||
                          entryStatus === 'Failed' ||
                          entryStatus === 'Error' ||
                          entryStatus === 'Denied'
                        ) {
                          statusColor = 'bg-error-100 border-error-500';
                          iconColor = 'text-error-600';
                        } else if (
                          entryStatus === MEMBER_STATUS.PENDING ||
                          entryStatus === 'Processing' ||
                          entryStatus === 'InProgress' ||
                          entryStatus === 'In Progress'
                        ) {
                          statusColor = 'bg-warning-100 border-warning-500';
                          iconColor = 'text-warning-600';
                        }

                        return (
                          <div key={entry.id || `history-${index}`} className="flex items-start gap-3">
                            {/* Timeline connector */}
                            <div className="flex flex-col items-center flex-shrink-0">
                              <div
                                className={`flex items-center justify-center h-8 w-8 rounded-full border-2 ${statusColor}`}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className={`h-4 w-4 ${iconColor}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                              </div>
                              {!isLast && (
                                <div className="w-0.5 h-6 bg-gray-200" />
                              )}
                            </div>

                            {/* Entry content */}
                            <div className={`pb-4 min-w-0 flex-1 ${isLast ? 'pb-0' : ''}`}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">
                                    {entry.action || 'Unknown Action'}
                                  </p>
                                  <StatusBadge status={entryStatus} size="sm" />
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
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
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-10 w-10 text-gray-300 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-sm text-gray-500">No enrollment history available.</p>
                  </div>
                )}
              </div>

              {/* Timestamps */}
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Record Timestamps</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {enrollment.createdAt && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Created At</p>
                      <p className="text-sm text-gray-800 mt-0.5">{formatTimestamp(enrollment.createdAt)}</p>
                    </div>
                  )}
                  {enrollment.updatedAt && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Last Updated</p>
                      <p className="text-sm text-gray-800 mt-0.5">{formatTimestamp(enrollment.updatedAt)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

EnrollmentDetail.propTypes = {
  enrollmentId: PropTypes.string,
  enrollment: PropTypes.object,
  className: PropTypes.string,
  onClose: PropTypes.func,
};

EnrollmentDetail.defaultProps = {
  enrollmentId: '',
  enrollment: null,
  className: '',
  onClose: undefined,
};

export default EnrollmentDetail;