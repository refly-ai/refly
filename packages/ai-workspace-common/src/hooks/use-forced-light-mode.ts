import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useThemeStoreShallow } from '../stores/theme';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';

// Routes that should always use light mode
const LIGHT_MODE_ROUTES = ['/', '/pricing', '/artifact-gallery', '/use-cases-gallery'];

/**
 * Custom hook to force light mode on specific routes regardless of theme settings
 */
export const useForcedLightMode = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  const { setForcedLightMode } = useThemeStoreShallow((state) => ({
    setForcedLightMode: state.setForcedLightMode,
  }));

  useEffect(() => {
    // Check if current path should force light mode
    const shouldForceLightMode = LIGHT_MODE_ROUTES.some((route) => {
      // For the root path, we need an exact match
      if (route === '/') {
        return !isLogin && currentPath === '/';
      }
      // For other paths, use exact match to ensure we don't affect subpaths
      return currentPath === route;
    });

    // Update the forced light mode state in the store
    setForcedLightMode(shouldForceLightMode);

    // Cleanup - restore normal theme behavior when leaving these routes
    return () => {
      if (shouldForceLightMode) {
        setForcedLightMode(false);
      }
    };
  }, [currentPath, setForcedLightMode]);
};
