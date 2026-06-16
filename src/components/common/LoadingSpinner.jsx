import PropTypes from 'prop-types';

/**
 * Maps a size prop to Tailwind CSS sizing classes for the spinner.
 * @param {string} size - The size variant ('sm', 'md', 'lg', 'xl').
 * @returns {{ spinner: string, text: string }} Tailwind CSS classes for the spinner and text.
 */
function getSizeClasses(size) {
  switch (size) {
    case 'sm':
      return { spinner: 'h-4 w-4', text: 'text-xs' };
    case 'lg':
      return { spinner: 'h-10 w-10', text: 'text-base' };
    case 'xl':
      return { spinner: 'h-14 w-14', text: 'text-lg' };
    case 'md':
    default:
      return { spinner: 'h-8 w-8', text: 'text-sm' };
  }
}

/**
 * LoadingSpinner component.
 * Displays an animated spinning indicator with an optional message text.
 * Supports multiple size variants and custom styling via className.
 *
 * @param {{
 *   size?: 'sm' | 'md' | 'lg' | 'xl',
 *   message?: string,
 *   className?: string,
 * }} props
 * @returns {import('react').ReactElement}
 */
export function LoadingSpinner({ size, message, className }) {
  const sizeClasses = getSizeClasses(size);

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className || ''}`}>
      <svg
        className={`animate-spin ${sizeClasses.spinner} text-primary-500`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {message && (
        <p className={`${sizeClasses.text} text-gray-500`}>{message}</p>
      )}
    </div>
  );
}

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  message: PropTypes.string,
  className: PropTypes.string,
};

LoadingSpinner.defaultProps = {
  size: 'md',
  message: '',
  className: '',
};

export default LoadingSpinner;