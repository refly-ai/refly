import { Suspense, useMemo } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { InlineLoading } from '@refly/ui-kit';
import { AppLayout, LazyErrorBoundary } from '@refly/web-core';

import { RoutesList } from './routes';
import { InitializationSuspense } from './prepare/InitializationSuspense';
import { shouldSkipLayout } from './config/layout';
import { GlobalSEO } from './components/GlobalSEO';

const AppContent = () => {
  const location = useLocation();
  const skipLayout = shouldSkipLayout(location.pathname);

  // Memoize routes to prevent unnecessary re-renders of AppLayout children
  const routes = useMemo(
    () => (
      <LazyErrorBoundary>
        <Suspense fallback={<InlineLoading />}>
          <Routes>
            {RoutesList.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Routes>
        </Suspense>
      </LazyErrorBoundary>
    ),
    [], // Empty deps - RoutesList is static
  );

  // Pages that should not be wrapped in AppLayout
  if (skipLayout) {
    return routes;
  }

  return <AppLayout>{routes}</AppLayout>;
};

export const App = () => {
  return (
    <>
      <GlobalSEO />
      <LazyErrorBoundary>
        <InitializationSuspense>
          <AppContent />
        </InitializationSuspense>
      </LazyErrorBoundary>
    </>
  );
};
