import { useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Modal component.
 * Renders a reusable modal dialog with overlay, title, body content, and footer action buttons.
 * Supports close on overlay click and escape key press.
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   title?: string,
 *   children: import('react').ReactNode,
 *   actions?: Array<{ label: string, onClick: () => void, variant?: 'primary' | 'secondary' | 'danger', disabled?: boolean }>,
 *   className?: string,
 *   overlayClassName?: string,
 *   showCloseButton?: boolean,
 *   closeOnOverlayClick?: boolean,
 *   closeOnEscape?: boolean,
 *   size?: 'sm' | 'md' | 'lg' | 'xl',
 * }} props
 * @returns {import('react').ReactElement|null}
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  actions,
  className,
  overlayClassName,
  showCloseButton,
  closeOnOverlayClick,
  closeOnEscape,
  size,
}) {
  const modalRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  const safeActions = Array.isArray(actions) ? actions : [];
  const effectiveCloseOnOverlayClick = typeof closeOnOverlayClick === 'boolean' ? closeOnOverlayClick : true;
  const effectiveCloseOnEscape = typeof closeOnEscape === 'boolean' ? closeOnEscape : true;
  const effectiveShowCloseButton = typeof showCloseButton === 'boolean' ? showCloseButton : true;

  const handleClose = useCallback(() => {
    if (typeof onClose === 'function') {
      onClose();
    }
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e) => {
      if (effectiveCloseOnOverlayClick && e.target === e.currentTarget) {
        handleClose();
      }
    },
    [effectiveCloseOnOverlayClick, handleClose]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (effectiveCloseOnEscape && e.key === 'Escape') {
        handleClose();
      }
    },
    [effectiveCloseOnEscape, handleClose]
  );

  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement;

      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      if (modalRef.current) {
        modalRef.current.focus();
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';

        if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  /**
   * Maps a size prop to Tailwind CSS width classes.
   * @param {string} sizeValue - The size variant.
   * @returns {string} Tailwind CSS width class.
   */
  function getSizeClasses(sizeValue) {
    switch (sizeValue) {
      case 'sm':
        return 'max-w-sm';
      case 'lg':
        return 'max-w-2xl';
      case 'xl':
        return 'max-w-4xl';
      case 'md':
      default:
        return 'max-w-lg';
    }
  }

  /**
   * Maps a button variant to Tailwind CSS classes.
   * @param {string} variant - The button variant.
   * @returns {string} Tailwind CSS classes.
   */
  function getButtonClasses(variant) {
    switch (variant) {
      case 'primary':
        return 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500';
      case 'danger':
        return 'bg-error-500 text-white hover:bg-error-600 focus:ring-error-500';
      case 'secondary':
      default:
        return 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-primary-500';
    }
  }

  const sizeClasses = getSizeClasses(size);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayClassName || ''}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Overlay backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" aria-hidden="true" />

      {/* Modal panel */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative z-10 w-full ${sizeClasses} bg-white rounded-lg shadow-xl transform transition-all ${className || ''}`}
      >
        {/* Header */}
        {(title || effectiveShowCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            {title && (
              <h2 id="modal-title" className="text-lg font-semibold text-gray-800">
                {title}
              </h2>
            )}
            {!title && <div />}
            {effectiveShowCloseButton && (
              <button
                type="button"
                onClick={handleClose}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Close modal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
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
        )}

        {/* Body */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>

        {/* Footer with action buttons */}
        {safeActions.length > 0 && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            {safeActions.map((action, index) => {
              const buttonClasses = getButtonClasses(action.variant);
              const isDisabled = action.disabled === true;

              return (
                <button
                  key={action.label || `action-${index}`}
                  type="button"
                  onClick={action.onClick}
                  disabled={isDisabled}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${buttonClasses}`}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  children: PropTypes.node.isRequired,
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      variant: PropTypes.oneOf(['primary', 'secondary', 'danger']),
      disabled: PropTypes.bool,
    })
  ),
  className: PropTypes.string,
  overlayClassName: PropTypes.string,
  showCloseButton: PropTypes.bool,
  closeOnOverlayClick: PropTypes.bool,
  closeOnEscape: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
};

Modal.defaultProps = {
  title: '',
  actions: [],
  className: '',
  overlayClassName: '',
  showCloseButton: true,
  closeOnOverlayClick: true,
  closeOnEscape: true,
  size: 'md',
};

export default Modal;