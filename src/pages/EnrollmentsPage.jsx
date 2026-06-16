import { useMemo } from 'react';
import { useEnrollmentStore } from '../stores/enrollmentStore';
import { useMemberStore } from '../stores/memberStore';
import { useAuth } from '../contexts/AuthContext';
import { MEMBER_STATUS } from '../utils/constants';
import { EnrollmentList } from '../components/enrollments/EnrollmentList';
import { StatsCard } from '../components/common/StatsCard';

/**
 * EnrollmentsPage component.
 * Enrollments page displaying EnrollmentList component with summary stats at top
 * (total enrollments, eligible/active, ineligible/terminated, pending).
 *
 * @returns {import('react').ReactElement}
 */
export function EnrollmentsPage() {
  const enrollments = useEnrollmentStore((state) => state.enrollments);
  const members = useMemberStore((state) => state.members);
  const { currentUser } = useAuth();

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
   * Active enrollments (eligible) rate.
   */
  const activeRate = useMemo(() => {
    if (enrollmentStats.total === 0) return '0';
    return ((enrollmentStats.eligible / enrollmentStats.total) * 100).toFixed(1);
  }, [enrollmentStats]);

  /**
   * Terminated enrollments (ineligible) rate.
   */
  const terminatedRate = useMemo(() => {
    if (enrollmentStats.total === 0) return '0';
    return ((enrollmentStats.ineligible / enrollmentStats.total) * 100).toFixed(1);
  }, [enrollmentStats]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enrollments</h1>
          <p className="text-sm text-gray-500 mt-1">
            View and manage enrollment records for all processed members.
          </p>
        </div>

        {/* Quick stat badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {enrollmentStats.total > 0 && (
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              {enrollmentStats.total} enrollment{enrollmentStats.total !== 1 ? 's' : ''}
            </span>
          )}
          {enrollmentStats.eligible > 0 && (
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
              {activeRate}% active
            </span>
          )}
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
              {terminatedRate}% terminated
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
          label="Active (Eligible)"
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
          label="Terminated (Ineligible)"
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

      {/* Enrollment List Component */}
      <EnrollmentList />
    </div>
  );
}

export default EnrollmentsPage;