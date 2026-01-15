import { Suspense, useEffect, lazy, useMemo } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { LightLoading } from '@refly/ui-kit';

const AppLayout = lazy(() =>
  import('@refly/web-core/src/components/layout').then((m) => ({ default: m.AppLayout })),
);

import { RoutesList } from './routes';
import { InitializationSuspense } from './prepare/InitializationSuspense';
import { shouldSkipLayout } from './config/layout';
import { GlobalSEO } from './components/GlobalSEO';
import { LazyErrorBoundary } from '@refly/web-core';

const AppContent = () => {
  const location = useLocation();
  const skipLayout = shouldSkipLayout(location.pathname);

  // Memoize routes to prevent unnecessary re-renders of AppLayout children
  const routes = useMemo(
    () => (
      <LazyErrorBoundary>
        <Suspense fallback={<LightLoading />}>
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
  // Register Service Worker for Code Caching
  // Register Service Worker for Code Caching
  useEffect(() => {
    // Debug log to verify environment
    console.log('[SW] Checking eligibility...', {
      hasSW: 'serviceWorker' in navigator,
      env: process.env.NODE_ENV,
    });

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const registerSW = () => {
        console.log('[SW] Attempting registration...');
        navigator.serviceWorker
          .register('/service-worker.js')
          .then((registration) => {
            console.log(
              '[SW] ServiceWorker registration successful with scope: ',
              registration.scope,
            );
          })
          .catch((registrationError) => {
            console.error('[SW] ServiceWorker registration failed: ', registrationError);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }
  }, []);

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
