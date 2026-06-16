import { useMemo } from 'react';
import { useMemberStore } from '../stores/memberStore';
import { useAuth } from '../contexts/AuthContext';
import { MEMBER_STATUS } from '../utils/constants';
import { MemberSearch } from '../components/members/MemberSearch';
import { StatsCard } from '../components/common/StatsCard';

/**
 * MembersPage component.
 * Members page combining MemberSearch component. Shows total member count
 * and status distribution summary at top.
 *
 * @returns {import('react').ReactElement}
 */
export function MembersPage() {
  const members = useMemberStore((state) => state.members);
  const { currentUser } = useAuth();

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-sm text-gray-500 mt-1">
            View and search member records, demographics, coverage, and eligibility status.
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

      {/* Member Search Component */}
      <MemberSearch />
    </div>
  );
}

export default MembersPage;