import { useMemo } from 'react';
import { useIntegrationStore } from '../stores/integrationStore';
import { useMemberStore } from '../stores/memberStore';
import { useAuth } from '../contexts/AuthContext';
import { MEMBER_STATUS } from '../utils/constants';
import { IntegrationPanel } from '../components/integration/IntegrationPanel';
import { StatsCard } from '../components/common/StatsCard';

/**
 * IntegrationPage component.
 * Integration page displaying IntegrationPanel component. Shows integration
 * overview with summary stats for transmissions, endpoint health, and
 * mock endpoint configuration.
 *
 * @returns {import('react').ReactElement}
 */
export function IntegrationPage() {
  const integrationLogs = useIntegrationStore((state) => state.integrationLogs);
  const integrationConfig = useIntegrationStore((state) => state.integrationConfig);
  const getIntegrationStats = useIntegrationStore((state) => state.getIntegrationStats);
  const members = useMemberStore((state) => state.members);
  const { currentUser } = useAuth();

  /**
   * Integration statistics.
   */
  const integrationStats = useMemo(() => {
    return getIntegrationStats();
  }, [getIntegrationStats, integrationLogs]);

  /**
   * Eligible members count.
   */
  const eligibleMemberCount = useMemo(() => {
    const allMembers = Array.isArray(members) ? members : [];
    return allMembers.filter(
      (m) =>
        m.eligibilityStatus === MEMBER_STATUS.ELIGIBLE ||
        m.status === MEMBER_STATUS.ELIGIBLE
    ).length;
  }, [members]);

  /**
   * Endpoint statistics.
   */
  const endpointStats = useMemo(() => {
    const endpoints = (integrationConfig && Array.isArray(integrationConfig.endpoints))
      ? integrationConfig.endpoints
      : [];
    return {
      total: endpoints.length,
      enabled: endpoints.filter((ep) => ep.enabled).length,
      disabled: endpoints.filter((ep) => !ep.enabled).length,
    };
  }, [integrationConfig]);

  /**
   * Success rate percentage.
   */
  const successRate = useMemo(() => {
    if (integrationStats.total === 0) return '0';
    return ((integrationStats.success / integrationStats.total) * 100).toFixed(1);
  }, [integrationStats]);

  /**
   * Overall health status.
   */
  const overallHealth = useMemo(() => {
    if (integrationStats.total === 0) return 'No Data';
    const rate = (integrationStats.success / integrationStats.total) * 100;
    if (rate >= 80) return 'Healthy';
    if (rate >= 50) return 'Warning';
    return 'Degraded';
  }, [integrationStats]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage downstream system integrations, monitor transmission logs, and configure mock endpoints.
          </p>
        </div>

        {/* Quick stat badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Health indicator */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full ${
            overallHealth === 'Healthy'
              ? 'bg-success-50 text-success-700'
              : overallHealth === 'Warning'
                ? 'bg-warning-50 text-warning-700'
                : overallHealth === 'Degraded'
                  ? 'bg-error-50 text-error-700'
                  : 'bg-gray-100 text-gray-600'
          }`}>
            <div className={`h-2 w-2 rounded-full ${
              overallHealth === 'Healthy'
                ? 'bg-success-500'
                : overallHealth === 'Warning'
                  ? 'bg-warning-500'
                  : overallHealth === 'Degraded'
                    ? 'bg-error-500'
                    : 'bg-gray-400'
            }`} />
            {overallHealth}
          </span>

          {integrationStats.total > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded-full">
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
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {successRate}% success rate
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
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"
              />
            </svg>
            {endpointStats.enabled} of {endpointStats.total} endpoint{endpointStats.total !== 1 ? 's' : ''} enabled
          </span>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatsCard
          label="Total Transmissions"
          value={integrationStats.total}
          icon="integrations"
          trend="neutral"
        />
        <StatsCard
          label="Successful"
          value={integrationStats.success}
          icon="eligible"
          trend={integrationStats.success > 0 ? 'up' : 'neutral'}
          trendValue={
            integrationStats.total > 0
              ? `${((integrationStats.success / integrationStats.total) * 100).toFixed(0)}%`
              : ''
          }
        />
        <StatsCard
          label="Failed"
          value={integrationStats.failed}
          icon="errors"
          trend={integrationStats.failed > 0 ? 'down' : 'neutral'}
          trendValue={
            integrationStats.total > 0
              ? `${((integrationStats.failed / integrationStats.total) * 100).toFixed(0)}%`
              : ''
          }
        />
        <StatsCard
          label="In Progress"
          value={integrationStats.inProgress}
          icon="pending"
          trend="neutral"
        />
        <StatsCard
          label="Eligible Members"
          value={eligibleMemberCount}
          icon="members"
          trend={eligibleMemberCount > 0 ? 'up' : 'neutral'}
          trendValue="ready to transmit"
        />
      </div>

      {/* Integration Panel Component */}
      <IntegrationPanel />
    </div>
  );
}

export default IntegrationPage;