import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiderStoreShallow } from '@refly/stores';

/**
 * Custom hook to handle sidebar collapse state based on route changes
 * Sets collapseState to 'expanded' for specific routes, 'hidden' for all others
 */
export const useRouteCollapse = () => {
  const location = useLocation();
  const { collapseState, isManualCollapse, setCollapseState } = useSiderStoreShallow((state) => ({
    collapseState: state.collapseState,
    isManualCollapse: state.isManualCollapse,
    setCollapseState: state.setCollapseState,
  }));

  useEffect(() => {
    if (isManualCollapse) {
      return;
    }

    const currentPath = location.pathname;

    // Routes that should have sidebar expanded (collapse = false)
    const expandedRoutes = [
      '/app-manager',
      '/workflow-list',
      '/canvas/empty',
      '/home',
      '/project',
      '/marketplace',
    ];

    // Check if current route matches any of the expanded routes
    const shouldExpand = expandedRoutes.some((route) => {
      if (route === '/home') {
        return currentPath === '/';
      }
      if (route === '/canvas/empty') {
        // Exact match for /canvas/empty
        return currentPath === '/canvas/empty';
      }

      // For other routes, check if path starts with the route
      return currentPath.startsWith(route);
    });

    // Set collapse state based on route
    // If shouldExpand is true, set collapseState to 'expanded'
    // If shouldExpand is false, set collapseState to 'hidden'
    const nextState = shouldExpand ? 'expanded' : 'hidden';
    if (collapseState !== nextState) {
      setCollapseState(nextState);
    }
  }, [collapseState, isManualCollapse, location.pathname, setCollapseState]);
};
