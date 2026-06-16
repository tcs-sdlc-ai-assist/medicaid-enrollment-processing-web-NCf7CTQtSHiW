import PropTypes from 'prop-types';

/**
 * Maps a status string to Tailwind CSS color classes for the badge.
 * @param {string} status - The status string.
 * @returns {string} Tailwind CSS classes for background and text color.
 */
function getStatusClasses(status) {
  if (!status || typeof status !== 'string') {
    return 'bg-gray-100 text-gray-700';
  }

  switch (status) {
    // Green statuses
    case 'Eligible':
    case 'Completed':
    case 'Success':
    case 'Active':
      return 'bg-success-100 text-success-700';

    // Red statuses
    case 'Ineligible':
    case 'Failed':
    case 'Error':
    case 'Denied':
      return 'bg-error-100 text-error-700';

    // Amber statuses
    case 'Pending':
    case 'Processing':
    case 'InProgress':
    case 'In Progress':
      return 'bg-warning-100 text-warning-700';

    // Blue statuses
    case 'Uploaded':
    case 'Validating':
    case 'Parsing':
      return 'bg-primary-100 text-primary-700';

    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Maps a size prop to Tailwind CSS sizing classes.
 * @param {string} size - The size variant ('sm', 'md', 'lg').
 * @returns {string} Tailwind CSS classes for padding and font size.
 */
function getSizeClasses(size) {
  switch (size) {
    case 'sm':
      return 'text-[10px] px-1.5 py-0.5';
    case 'lg':
      return 'text-sm px-3 py-1';
    case 'md':
    default:
      return 'text-xs px-2 py-0.5';
  }
}

/**
 * StatusBadge component.
 * Displays a status string inside a color-coded rounded badge.
 * Colors are determined by the status value:
 * - Green: Eligible, Completed, Success, Active
 * - Red: Ineligible, Failed, Error, Denied
 * - Amber: Pending, Processing, InProgress
 * - Blue: Uploaded, Validating, Parsing
 *
 * @param {{ status: string, size?: 'sm' | 'md' | 'lg', className?: string }} props
 * @returns {import('react').ReactElement}
 */
export function StatusBadge({ status, size, className }) {
  const colorClasses = getStatusClasses(status);
  const sizeClasses = getSizeClasses(size);

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full whitespace-nowrap ${colorClasses} ${sizeClasses} ${className || ''}`}
    >
      {status || 'Unknown'}
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
};

StatusBadge.defaultProps = {
  size: 'md',
  className: '',
};

export default StatusBadge;