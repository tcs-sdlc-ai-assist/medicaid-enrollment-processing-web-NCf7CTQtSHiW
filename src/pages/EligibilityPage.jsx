import { useState, useCallback, useMemo } from 'react';
import { useEligibilityStore } from '../stores/eligibilityStore';
import { useMemberStore } from '../stores/memberStore';
import { useAuditStore } from '../stores/auditStore';
import { useAuth } from '../contexts/AuthContext';
import { MEMBER_STATUS } from '../utils/constants';
import { EligibilityRuleConfig } from '../components/eligibility/EligibilityRuleConfig';
import { EligibilityResults } from '../components/eligibility/EligibilityResults';
import { StatsCard } from '../components/common/StatsCard';

/**
 * Tab definitions for the eligibility page.
 * @type {Array<{ key: string, label: string, icon: string }>}
 */
const ELIGIBILITY_TABS = [
  {
    key: 'rules',
    label: 'Rule Configuration',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  },
  {
    key: 'results',
    label: 'Eligibility Results',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
];

/**
 * EligibilityPage component.
 * Eligibility page with tabs for Rule Configuration and Eligibility Results.
 * Combines EligibilityRuleConfig and EligibilityResults components.
 * Shows summary stats for rules and member eligibility at the top.
 *
 * @returns {import('react').ReactElement}
 */
export function EligibilityPage() {
  const { currentUser, hasPermission } = useAuth();
  const rules = useEligibilityStore((state) => state.rules);
  const members = useMemberStore((state) => state.members);
  const logAction = useAuditStore((state) => state.logAction);

  const [activeTab, setActiveTab] = useState('rules');

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
   * Handles tab change.
   * @param {string} tabKey - The tab key to switch to.
   */
  const handleTabChange = useCallback(
    (tabKey) => {
      setActiveTab(tabKey);

      const userId = currentUser ? currentUser.id : '';
      logAction('Tab Viewed', '', userId, {
        tab: tabKey,
        page: 'EligibilityPage',
      });
    },
    [currentUser, logAction]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Eligibility</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure eligibility rules per state and view member eligibility determination results.
          </p>
        </div>

        {/* Eligibility rate badge */}
        <div className="flex items-center gap-2 flex-wrap">
          {memberStats.total > 0 && (
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
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
            </svg>
            {ruleStats.total} rule{ruleStats.total !== 1 ? 's' : ''} across {ruleStats.stateCount} state{ruleStats.stateCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatsCard
          label="Total Rules"
          value={ruleStats.total}
          icon="integrations"
          trend="neutral"
          trendValue={
            ruleStats.wildcardCount > 0
              ? `${ruleStats.wildcardCount} wildcard`
              : ''
          }
        />
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

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          {ELIGIBILITY_TABS.map((tab) => (
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
              <span className="flex items-center gap-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                {tab.label}
                {tab.key === 'rules' && ruleStats.total > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-gray-200 text-gray-600 rounded-full">
                    {ruleStats.total}
                  </span>
                )}
                {tab.key === 'results' && memberStats.total > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-gray-200 text-gray-600 rounded-full">
                    {memberStats.total}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {/* Rule Configuration Tab */}
          {activeTab === 'rules' && (
            <EligibilityRuleConfig />
          )}

          {/* Eligibility Results Tab */}
          {activeTab === 'results' && (
            <EligibilityResults />
          )}
        </div>
      </div>
    </div>
  );
}

export default EligibilityPage;