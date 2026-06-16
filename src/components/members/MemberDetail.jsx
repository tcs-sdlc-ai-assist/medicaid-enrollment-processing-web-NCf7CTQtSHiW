import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useMemberStore } from '../../stores/memberStore';
import { useFileStore } from '../../stores/fileStore';
import { useEnrollmentStore } from '../../stores/enrollmentStore';
import { useAuditStore } from '../../stores/auditStore';
import { useAuth } from '../../contexts/AuthContext';
import { MEMBER_STATUS } from '../../utils/constants';
import { formatDate, formatTimestamp } from '../../utils/helpers';
import { StatusBadge } from '../common/StatusBadge';
import { AlertMessage } from '../common/AlertMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';

/**
 * Tabs available in the member detail view.
 * @type {Array<{ key: string, label: string }>}
 */
const TABS = [
  { key: 'demographics', label: 'Demographics' },
  { key: 'coverage', label: 'Coverage' },
  { key: 'history', label: 'History' },
];

/**
 * Masks an SSN-like identifier, showing only the last 4 digits.
 * @param {string} value - The SSN or ID code to mask.
 * @returns {string} The masked value (e.g., "***-**-1234") or '—' if empty.
 */
function maskSSN(value) {
  if (!value || typeof value !== 'string') {
    return '—';
  }

  const cleaned = value.replace(/\D/g, '');

  if (cleaned.length < 4) {
    return '***-**-' + cleaned;
  }

  const last4 = cleaned.slice(-4);
  return `***-**-${last4}`;
}

/**
 * Resolves the SSN-like identifier from a member's names data.
 * @param {object} member - The member record.
 * @returns {string} The SSN-like identifier or empty string.
 */
function getMemberSSN(member) {
  if (
    member &&
    member.names &&
    member.names.member &&
    member.names.member.idCode
  ) {
    return member.names.member.idCode;
  }
  return '';
}

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
 * MemberDetail component.
 * Displays a detailed view of a single member including demographics (name, DOB,
 * SSN masked, address, gender), coverage information (plan, dates, type),
 * eligibility status with badge, enrollment history timeline, and associated
 * file references. Includes tabs for Demographics, Coverage, History.
 *
 * @param {{
 *   memberId?: string,
 *   member?: object,
 *   className?: string,
 *   onClose?: () => void,
 * }} props
 * @returns {import('react').ReactElement}
 */
export function MemberDetail({ memberId, member: memberProp, className, onClose }) {
  const getMember = useMemberStore((state) => state.getMember);
  const members = useMemberStore((state) => state.members);
  const files = useFileStore((state) => state.files);
  const enrollments = useEnrollmentStore((state) => state.enrollments);
  const { currentUser } = useAuth();
  const logAction = useAuditStore((state) => state.logAction);

  const [activeTab, setActiveTab] = useState('demographics');

  /**
   * Resolve the member from either the prop or the store.
   */
  const member = useMemo(() => {
    if (memberProp && typeof memberProp === 'object' && (memberProp.id || memberProp.memberId)) {
      return memberProp;
    }
    if (memberId) {
      return getMember(memberId);
    }
    return null;
  }, [memberProp, memberId, getMember, members]);

  /**
   * Find associated files that contain this member.
   */
  const associatedFiles = useMemo(() => {
    if (!member) return [];

    const mId = member.memberId || member.id || '';
    if (!mId) return [];

    return (Array.isArray(files) ? files : []).filter((file) => {
      if (!Array.isArray(file.members)) return false;
      return file.members.some(
        (m) =>
          m.memberId === mId ||
          m.id === mId ||
          m.memberId === member.id ||
          m.id === member.memberId
      );
    });
  }, [member, files]);

  /**
   * Find associated enrollment records for this member.
   */
  const memberEnrollments = useMemo(() => {
    if (!member) return [];

    const mId = member.memberId || member.id || '';
    if (!mId) return [];

    return (Array.isArray(enrollments) ? enrollments : []).filter(
      (e) => e.memberId === mId || e.memberId === member.id || e.memberId === member.memberId
    );
  }, [member, enrollments]);

  /**
   * Enrollment history from the member record.
   */
  const enrollmentHistory = useMemo(() => {
    if (!member) return [];

    if (Array.isArray(member.enrollmentHistory) && member.enrollmentHistory.length > 0) {
      return member.enrollmentHistory;
    }

    if (Array.isArray(member.history) && member.history.length > 0) {
      return member.history;
    }

    return [];
  }, [member]);

  /**
   * Handles tab change.
   * @param {string} tabKey - The tab key to switch to.
   */
  const handleTabChange = useCallback(
    (tabKey) => {
      setActiveTab(tabKey);

      if (member) {
        const userId = currentUser ? currentUser.id : '';
        logAction('Member Tab Viewed', member.memberId || member.id, userId, {
          tab: tabKey,
          firstName: member.firstName || '',
          lastName: member.lastName || '',
        });
      }
    },
    [member, currentUser, logAction]
  );

  // If no member found, show empty state
  if (!member) {
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <p className="text-sm text-gray-500">Member not found.</p>
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

  const ssn = getMemberSSN(member);
  const maskedSSN = maskSSN(ssn);
  const memberState = getMemberState(member);
  const eligibilityStatus = member.eligibilityStatus || member.status || 'Unknown';

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-lg font-semibold text-primary-700">
                {((member.firstName || '').charAt(0) + (member.lastName || '').charAt(0)).toUpperCase() || '?'}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-800 truncate">
                {member.firstName || ''} {member.middleName ? member.middleName + ' ' : ''}{member.lastName || ''}
                {!member.firstName && !member.lastName && (
                  <span className="text-gray-400">Unknown Member</span>
                )}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <StatusBadge status={eligibilityStatus} size="md" />
                <span className="text-xs text-gray-500">
                  ID: {member.memberId || member.id || '—'}
                </span>
                {memberState && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {memberState}
                  </span>
                )}
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

      {/* Eligibility Status Card */}
      <div className={`border rounded-lg shadow-sm p-4 ${
        eligibilityStatus === MEMBER_STATUS.ELIGIBLE
          ? 'bg-success-50 border-success-200'
          : eligibilityStatus === MEMBER_STATUS.INELIGIBLE
            ? 'bg-error-50 border-error-200'
            : 'bg-warning-50 border-warning-200'
      }`}>
        <div className="flex items-center gap-3">
          {eligibilityStatus === MEMBER_STATUS.ELIGIBLE && (
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
          {eligibilityStatus === MEMBER_STATUS.INELIGIBLE && (
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
          {eligibilityStatus !== MEMBER_STATUS.ELIGIBLE && eligibilityStatus !== MEMBER_STATUS.INELIGIBLE && (
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
            <p className={`text-sm font-semibold ${
              eligibilityStatus === MEMBER_STATUS.ELIGIBLE
                ? 'text-success-800'
                : eligibilityStatus === MEMBER_STATUS.INELIGIBLE
                  ? 'text-error-800'
                  : 'text-warning-800'
            }`}>
              Eligibility Status: {eligibilityStatus}
            </p>
            <p className={`text-xs mt-0.5 ${
              eligibilityStatus === MEMBER_STATUS.ELIGIBLE
                ? 'text-success-600'
                : eligibilityStatus === MEMBER_STATUS.INELIGIBLE
                  ? 'text-error-600'
                  : 'text-warning-600'
            }`}>
              {eligibilityStatus === MEMBER_STATUS.ELIGIBLE && 'This member meets all eligibility criteria for Medicaid coverage.'}
              {eligibilityStatus === MEMBER_STATUS.INELIGIBLE && 'This member does not meet the eligibility criteria for Medicaid coverage.'}
              {eligibilityStatus !== MEMBER_STATUS.ELIGIBLE && eligibilityStatus !== MEMBER_STATUS.INELIGIBLE && 'Eligibility determination is pending for this member.'}
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
          {/* Demographics Tab */}
          {activeTab === 'demographics' && (
            <div className="space-y-6">
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
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Middle Name</p>
                    <p className="text-sm text-gray-800 mt-0.5">{member.middleName || '—'}</p>
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
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">SSN (Masked)</p>
                    <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs">{maskedSSN}</p>
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
                  {member.demographics && member.demographics.maritalStatusCode && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Marital Status Code</p>
                      <p className="text-sm text-gray-800 mt-0.5">{member.demographics.maritalStatusCode}</p>
                    </div>
                  )}
                  {member.demographics && member.demographics.citizenshipStatusCode && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Citizenship Status</p>
                      <p className="text-sm text-gray-800 mt-0.5">{member.demographics.citizenshipStatusCode}</p>
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

              {/* INS Data */}
              {member.insData && (
                <div>
                  <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Insurance Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {member.insData.relationship && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Relationship</p>
                        <p className="text-sm text-gray-800 mt-0.5">{member.insData.relationship}</p>
                      </div>
                    )}
                    {member.insData.maintenanceType && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Maintenance Type</p>
                        <p className="text-sm text-gray-800 mt-0.5">{member.insData.maintenanceType}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Subscriber</p>
                      <p className="text-sm text-gray-800 mt-0.5">
                        {member.insData.isSubscriber ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* References */}
              {member.references && (
                <div>
                  <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Reference Numbers</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {member.references.subscriberNumber && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Subscriber Number</p>
                        <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs">
                          {member.references.subscriberNumber}
                        </p>
                      </div>
                    )}
                    {member.references.groupPolicyNumber && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Group Policy Number</p>
                        <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs">
                          {member.references.groupPolicyNumber}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Coverage Tab */}
          {activeTab === 'coverage' && (
            <div className="space-y-6">
              {/* Coverage Summary */}
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Coverage Summary</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Coverage</p>
                    <p className="text-sm text-gray-800 mt-0.5">{member.coverage || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Eligibility Status</p>
                    <div className="mt-1">
                      <StatusBadge status={eligibilityStatus} size="md" />
                    </div>
                  </div>
                  {member.effectiveDate && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Effective Date</p>
                      <p className="text-sm text-gray-800 mt-0.5">
                        {formatDate(member.effectiveDate) || member.effectiveDate}
                      </p>
                    </div>
                  )}
                  {member.terminationDate && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Termination Date</p>
                      <p className="text-sm text-gray-800 mt-0.5">
                        {formatDate(member.terminationDate) || member.terminationDate}
                      </p>
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

              {/* Coverage Details */}
              {Array.isArray(member.coverageDetails) && member.coverageDetails.length > 0 && (
                <div>
                  <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                    Coverage Details ({member.coverageDetails.length})
                  </h4>
                  <div className="space-y-3">
                    {member.coverageDetails.map((coverage, index) => (
                      <div
                        key={`coverage-${index}`}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {coverage.insuranceLine && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Insurance Line</p>
                              <p className="text-sm text-gray-800 mt-0.5">{coverage.insuranceLine}</p>
                            </div>
                          )}
                          {coverage.planCoverageDescription && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Plan</p>
                              <p className="text-sm text-gray-800 mt-0.5">{coverage.planCoverageDescription}</p>
                            </div>
                          )}
                          {coverage.maintenanceType && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Maintenance Type</p>
                              <p className="text-sm text-gray-800 mt-0.5">{coverage.maintenanceType}</p>
                            </div>
                          )}
                          {coverage.coverageLevelCode && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Coverage Level</p>
                              <p className="text-sm text-gray-800 mt-0.5">{coverage.coverageLevelCode}</p>
                            </div>
                          )}
                          {coverage.insuranceLineCode && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Line Code</p>
                              <p className="text-sm text-gray-800 mt-0.5 font-mono text-xs">{coverage.insuranceLineCode}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Date Periods */}
              {Array.isArray(member.dates) && member.dates.length > 0 && (
                <div>
                  <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                    Date Periods ({member.dates.length})
                  </h4>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                    {member.dates.map((dateEntry, index) => (
                      <div
                        key={`date-${index}`}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-800">
                            {dateEntry.qualifierDescription || dateEntry.qualifier || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Qualifier: {dateEntry.qualifier || '—'}
                          </p>
                        </div>
                        <div className="flex-shrink-0 ml-3 text-right">
                          {dateEntry.date && (
                            <p className="text-sm text-gray-800">
                              {formatDate(dateEntry.date) || dateEntry.date}
                            </p>
                          )}
                          {dateEntry.startDate && dateEntry.endDate && (
                            <p className="text-xs text-gray-600">
                              {formatDate(dateEntry.startDate) || dateEntry.startDate} — {formatDate(dateEntry.endDate) || dateEntry.endDate}
                            </p>
                          )}
                          {!dateEntry.date && !dateEntry.startDate && (
                            <p className="text-xs text-gray-400">—</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Enrollment Records */}
              {memberEnrollments.length > 0 && (
                <div>
                  <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                    Enrollment Records ({memberEnrollments.length})
                  </h4>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                    {memberEnrollments.map((enrollment, index) => (
                      <div
                        key={enrollment.id || `enrollment-${index}`}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-800">
                            {enrollment.planId || enrollment.coverage || 'Unknown Plan'}
                          </p>
                          <p className="text-xs text-gray-500">
                            ID: {enrollment.id ? enrollment.id.substring(0, 8) + '...' : '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <StatusBadge status={enrollment.status || 'Unknown'} size="sm" />
                          {enrollment.effectiveDate && (
                            <span className="text-xs text-gray-500">
                              {formatDate(enrollment.effectiveDate)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for coverage */}
              {!member.coverage &&
                (!Array.isArray(member.coverageDetails) || member.coverageDetails.length === 0) &&
                memberEnrollments.length === 0 && (
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
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <p className="text-sm text-gray-500">No coverage information available.</p>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              {/* Enrollment History Timeline */}
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
                        if (entryStatus === MEMBER_STATUS.ELIGIBLE || entryStatus === 'Completed' || entryStatus === 'Success') {
                          statusColor = 'bg-success-100 border-success-500';
                          iconColor = 'text-success-600';
                        } else if (entryStatus === MEMBER_STATUS.INELIGIBLE || entryStatus === 'Failed' || entryStatus === 'Error' || entryStatus === 'Denied') {
                          statusColor = 'bg-error-100 border-error-500';
                          iconColor = 'text-error-600';
                        } else if (entryStatus === MEMBER_STATUS.PENDING || entryStatus === 'Processing' || entryStatus === 'InProgress') {
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

              {/* Associated Files */}
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">
                  Associated Files {associatedFiles.length > 0 ? `(${associatedFiles.length})` : ''}
                </h4>

                {associatedFiles.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                    {associatedFiles.map((file, index) => (
                      <div
                        key={file.id || `file-${index}`}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 text-primary-500 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-sm text-gray-800 truncate">{file.name || 'Unnamed File'}</p>
                            <p className="text-xs text-gray-500">
                              {file.timestamp ? formatTimestamp(file.timestamp) : '—'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <StatusBadge status={file.status || 'Unknown'} size="sm" />
                          <span className="text-xs text-gray-400 font-mono">
                            {file.id ? file.id.substring(0, 8) + '...' : '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8 text-gray-300 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                    <p className="text-sm text-gray-500">No associated files found.</p>
                  </div>
                )}
              </div>

              {/* Timestamps */}
              <div>
                <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Record Timestamps</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {member.createdAt && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Created At</p>
                      <p className="text-sm text-gray-800 mt-0.5">{formatTimestamp(member.createdAt)}</p>
                    </div>
                  )}
                  {member.updatedAt && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Last Updated</p>
                      <p className="text-sm text-gray-800 mt-0.5">{formatTimestamp(member.updatedAt)}</p>
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

MemberDetail.propTypes = {
  memberId: PropTypes.string,
  member: PropTypes.object,
  className: PropTypes.string,
  onClose: PropTypes.func,
};

MemberDetail.defaultProps = {
  memberId: '',
  member: null,
  className: '',
  onClose: undefined,
};

export default MemberDetail;