import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { useAuthStore } from './stores/authStore';
import { seedInitialData } from './services/sampleData';

/**
 * Root App component.
 * Renders the RouterProvider with the application router configuration.
 * On mount, hydrates state from localStorage (handled by individual stores)
 * and optionally seeds sample data if stores are empty.
 *
 * @returns {import('react').ReactElement}
 */
function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      seedInitialData({ memberCount: 10, force: false });
    }
  }, [isAuthenticated]);

  return <RouterProvider router={router} />;
}

export default App;