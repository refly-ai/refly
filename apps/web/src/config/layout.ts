/**
 * Paths that should not be wrapped in AppLayout
 * These pages will be rendered without the standard app layout (no sidebar, no EnvironmentBanner, etc.)
 */
export const PATHS_WITHOUT_LAYOUT = ['/login', '/workflow-template'] as const;

/**
 * Check if a path should not be wrapped in AppLayout
 */
export const shouldSkipLayout = (pathname: string): boolean => {
  return PATHS_WITHOUT_LAYOUT.some((path) => pathname === path);
};
