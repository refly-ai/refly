import { Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { LightLoading } from '@refly/ui-kit';
import { ErrorBoundary } from '@sentry/react';
import { AppLayout } from '@refly/web-core';

import { RoutesList } from './routes';
import { InitializationSuspense } from './prepare/InitializationSuspense';
import { shouldSkipLayout } from './config/layout';

const AppContent = () => {
  const location = useLocation();
  const skipLayout = shouldSkipLayout(location.pathname);

  const routes = (
    <Suspense fallback={<LightLoading />}>
      <Routes>
        {RoutesList.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
      </Routes>
    </Suspense>
  );

  // Pages that should not be wrapped in AppLayout
  if (skipLayout) {
    return routes;
  }

  return <AppLayout>{routes}</AppLayout>;
};

export const App = () => {
  return (
    <ErrorBoundary>
      <InitializationSuspense>
        <AppContent />
      </InitializationSuspense>
    </ErrorBoundary>
  );
};
