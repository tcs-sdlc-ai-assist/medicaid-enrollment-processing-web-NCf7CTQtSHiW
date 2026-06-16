import PropTypes from 'prop-types';

/**
 * Maps a trend direction to Tailwind CSS color classes and arrow icon.
 * @param {string} trend - The trend direction ('up', 'down', 'neutral').
 * @returns {{ color: string, icon: string }} Tailwind CSS classes and SVG path for the trend indicator.
 */
function getTrendClasses(trend) {
  switch (trend) {
    case 'up':
      return {
        color: 'text-success-600',
        icon: 'M5 10l7-7m0 0l7 7m-7-7v18',
      };
    case 'down':
      return {
        color: 'text-error-600',
        icon: 'M19 14l-7 7m0 0l-7-7m7 7V3',
      };
    case 'neutral':
    default:
      return {
        color: 'text-gray-500',
        icon: 'M5 12h14',
      };
  }
}

/**
 * Maps an icon name to an SVG path string.
 * @param {string} icon - The icon name ('files', 'members', 'enrollments', 'errors', 'integrations', 'eligible', 'ineligible', 'pending').
 * @returns {string} The SVG path data string.
 */
function getIconPath(icon) {
  switch (icon) {
    case 'files':
      return 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z';
    case 'members':
      return 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z';
    case 'enrollments':
      return 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01';
    case 'errors':
      return 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    case 'integrations':
      return 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z';
    case 'eligible':
      return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
    case 'ineligible':
      return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
    case 'pending':
      return 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z';
    default:
      return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }
}

/**
 * Maps an icon name to Tailwind CSS background and text color classes.
 * @param {string} icon - The icon name.
 * @returns {{ bg: string, text: string }} Tailwind CSS classes for the icon container.
 */
function getIconColorClasses(icon) {
  switch (icon) {
    case 'files':
      return { bg: 'bg-primary-100', text: 'text-primary-600' };
    case 'members':
      return { bg: 'bg-primary-100', text: 'text-primary-600' };
    case 'enrollments':
      return { bg: 'bg-primary-100', text: 'text-primary-600' };
    case 'errors':
      return { bg: 'bg-error-100', text: 'text-error-600' };
    case 'integrations':
      return { bg: 'bg-primary-100', text: 'text-primary-600' };
    case 'eligible':
      return { bg: 'bg-success-100', text: 'text-success-600' };
    case 'ineligible':
      return { bg: 'bg-error-100', text: 'text-error-600' };
    case 'pending':
      return { bg: 'bg-warning-100', text: 'text-warning-600' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600' };
  }
}

/**
 * StatsCard component.
 * Displays a dashboard statistics card with a metric label, value,
 * optional trend indicator (up/down/neutral), and an icon.
 *
 * @param {{
 *   label: string,
 *   value: string | number,
 *   trend?: 'up' | 'down' | 'neutral',
 *   trendValue?: string,
 *   icon?: 'files' | 'members' | 'enrollments' | 'errors' | 'integrations' | 'eligible' | 'ineligible' | 'pending',
 *   className?: string,
 *   onClick?: () => void,
 * }} props
 * @returns {import('react').ReactElement}
 */
export function StatsCard({ label, value, trend, trendValue, icon, className, onClick }) {
  const effectiveTrend = trend || 'neutral';
  const trendClasses = getTrendClasses(effectiveTrend);
  const iconPath = getIconPath(icon);
  const iconColors = getIconColorClasses(icon);

  const isClickable = typeof onClick === 'function';

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg shadow-sm p-5 ${
        isClickable ? 'cursor-pointer hover:shadow-md hover:border-primary-200 transition-shadow' : ''
      } ${className || ''}`}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {value !== undefined && value !== null ? value : '—'}
          </p>

          {/* Trend indicator */}
          {(trend || trendValue) && (
            <div className="mt-2 flex items-center gap-1">
              {trend && trend !== 'neutral' && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 flex-shrink-0 ${trendClasses.color}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={trendClasses.icon}
                  />
                </svg>
              )}
              {trend === 'neutral' && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 flex-shrink-0 ${trendClasses.color}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={trendClasses.icon}
                  />
                </svg>
              )}
              {trendValue && (
                <span className={`text-xs font-medium ${trendClasses.color}`}>
                  {trendValue}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Icon */}
        {icon && (
          <div
            className={`flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-lg ${iconColors.bg}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 ${iconColors.text}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={iconPath}
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

StatsCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  trend: PropTypes.oneOf(['up', 'down', 'neutral']),
  trendValue: PropTypes.string,
  icon: PropTypes.oneOf([
    'files',
    'members',
    'enrollments',
    'errors',
    'integrations',
    'eligible',
    'ineligible',
    'pending',
  ]),
  className: PropTypes.string,
  onClick: PropTypes.func,
};

StatsCard.defaultProps = {
  trend: 'neutral',
  trendValue: '',
  icon: undefined,
  className: '',
  onClick: undefined,
};

export default StatsCard;