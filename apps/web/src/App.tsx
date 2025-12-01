import { Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { LightLoading } from '@refly/ui-kit';
import { ErrorBoundary } from '@sentry/react';
import { AppLayout } from '@refly/web-core';

import { RoutesList } from './routes';
import { InitializationSuspense } from './prepare/InitializationSuspense';
import { shouldSkipLayout } from './config/layout';
import { ErrorFallback } from './components/ErrorFallback';
import { GlobalSEO } from './components/GlobalSEO';

const AppContent = () => {
  const location = useLocation();
  const skipLayout = shouldSkipLayout(location.pathname);

  const routes = (
    <ErrorBoundary
      fallback={({ error, componentStack, eventId, resetError }) => (
        <ErrorFallback
          error={error}
          componentStack={componentStack}
          eventId={eventId}
          resetError={resetError}
          isGlobal={false}
        />
      )}
    >
      <Suspense fallback={<LightLoading />}>
        <Routes>
          {RoutesList.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </Suspense>
    </ErrorBoundary>
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
      <ErrorBoundary
        fallback={({ error, componentStack, eventId, resetError }) => (
          <ErrorFallback
            error={error}
            componentStack={componentStack}
            eventId={eventId}
            resetError={resetError}
            isGlobal={true}
          />
        )}
      >
        <InitializationSuspense>
          <AppContent />
        </InitializationSuspense>
      </ErrorBoundary>
    </>
  );
};
