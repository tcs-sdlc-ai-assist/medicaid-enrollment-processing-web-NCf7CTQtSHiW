import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { AuthProvider } from '../../contexts/AuthContext';
import { useAuthStore } from '../../stores/authStore';

/**
 * Inner layout component that renders the Header, Sidebar, and content area.
 * Separated from the provider wrapper so it can consume AuthContext.
 *
 * @param {{ children: import('react').ReactNode, className?: string }} props
 * @returns {import('react').ReactElement}
 */
function LayoutContent({ children, className }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex flex-col ${className || ''}`}>
        <Header />
        <main className="flex-1">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${className || ''}`}>
      <Sidebar />
      <div className="lg:pl-60 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}

LayoutContent.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

LayoutContent.defaultProps = {
  className: '',
};

/**
 * MainLayout component.
 * Wraps the application content with the AuthProvider, Header, Sidebar,
 * and a responsive content area. Handles the overall page structure
 * including sidebar offset for desktop viewports.
 *
 * @param {{ children: import('react').ReactNode, className?: string }} props
 * @returns {import('react').ReactElement}
 */
export function MainLayout({ children, className }) {
  return (
    <AuthProvider>
      <LayoutContent className={className}>
        {children}
      </LayoutContent>
    </AuthProvider>
  );
}

MainLayout.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

MainLayout.defaultProps = {
  className: '',
};

export default MainLayout;