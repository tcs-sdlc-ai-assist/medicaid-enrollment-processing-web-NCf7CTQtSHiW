import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Maps an alert type to Tailwind CSS color classes for the alert container.
 * @param {string} type - The alert type ('success', 'error', 'warning', 'info').
 * @returns {{ container: string, icon: string, text: string, dismissButton: string }} Tailwind CSS classes.
 */
function getAlertClasses(type) {
  switch (type) {
    case 'success':
      return {
        container: 'bg-success-50 border-success-200',
        icon: 'text-success-500',
        text: 'text-success-800',
        dismissButton: 'text-success-500 hover:text-success-700 hover:bg-success-100',
      };
    case 'error':
      return {
        container: 'bg-error-50 border-error-200',
        icon: 'text-error-500',
        text: 'text-error-800',
        dismissButton: 'text-error-500 hover:text-error-700 hover:bg-error-100',
      };
    case 'warning':
      return {
        container: 'bg-warning-50 border-warning-200',
        icon: 'text-warning-500',
        text: 'text-warning-800',
        dismissButton: 'text-warning-500 hover:text-warning-700 hover:bg-warning-100',
      };
    case 'info':
    default:
      return {
        container: 'bg-primary-50 border-primary-200',
        icon: 'text-primary-500',
        text: 'text-primary-800',
        dismissButton: 'text-primary-500 hover:text-primary-700 hover:bg-primary-100',
      };
  }
}

/**
 * Returns the SVG icon path for the given alert type.
 * @param {string} type - The alert type ('success', 'error', 'warning', 'info').
 * @returns {string} The SVG path data string.
 */
function getIconPath(type) {
  switch (type) {
    case 'success':
      return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
    case 'error':
      return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
    case 'warning':
      return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
    case 'info':
    default:
      return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }
}

/**
 * AlertMessage component.
 * Renders a styled alert/notification banner with an icon, message text,
 * and optional dismiss button. Supports auto-dismiss after a configurable duration.
 *
 * @param {{
 *   type?: 'success' | 'error' | 'warning' | 'info',
 *   message: string,
 *   dismissible?: boolean,
 *   onDismiss?: () => void,
 *   autoDismissMs?: number,
 *   className?: string,
 *   title?: string,
 * }} props
 * @returns {import('react').ReactElement|null}
 */
export function AlertMessage({
  type,
  message,
  dismissible,
  onDismiss,
  autoDismissMs,
  className,
  title,
}) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef(null);

  const effectiveType = type || 'info';
  const effectiveDismissible = typeof dismissible === 'boolean' ? dismissible : false;
  const effectiveAutoDismissMs =
    typeof autoDismissMs === 'number' && autoDismissMs > 0 ? autoDismissMs : 0;

  const handleDismiss = useCallback(() => {
    setVisible(false);
    if (typeof onDismiss === 'function') {
      onDismiss();
    }
  }, [onDismiss]);

  useEffect(() => {
    if (effectiveAutoDismissMs > 0) {
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, effectiveAutoDismissMs);

      return () => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [effectiveAutoDismissMs, handleDismiss]);

  // Reset visibility when message changes
  useEffect(() => {
    setVisible(true);
  }, [message]);

  if (!visible || !message) {
    return null;
  }

  const classes = getAlertClasses(effectiveType);
  const iconPath = getIconPath(effectiveType);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border rounded-lg ${classes.container} ${className || ''}`}
      role="alert"
    >
      {/* Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-5 w-5 flex-shrink-0 mt-0.5 ${classes.icon}`}
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

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && (
          <p className={`text-sm font-semibold ${classes.text}`}>
            {title}
          </p>
        )}
        <p className={`text-sm ${classes.text} ${title ? 'mt-0.5' : ''}`}>
          {message}
        </p>
      </div>

      {/* Dismiss button */}
      {effectiveDismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className={`flex-shrink-0 p-1 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${classes.dismissButton}`}
          aria-label="Dismiss alert"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

AlertMessage.propTypes = {
  type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
  message: PropTypes.string.isRequired,
  dismissible: PropTypes.bool,
  onDismiss: PropTypes.func,
  autoDismissMs: PropTypes.number,
  className: PropTypes.string,
  title: PropTypes.string,
};

AlertMessage.defaultProps = {
  type: 'info',
  dismissible: false,
  onDismiss: undefined,
  autoDismissMs: 0,
  className: '',
  title: '',
};

export default AlertMessage;