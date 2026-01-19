import { Suspense, useEffect, useMemo } from 'react';
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
  // Register Service Worker for Code Caching
  useEffect(() => {
    // Debug log to verify environment
    console.log('[SW] Checking eligibility...', {
      hasSW: 'serviceWorker' in navigator,
      env: process.env.NODE_ENV,
    });

    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        // Register SW in production with dynamic filename (includes build hash)
        const registerSW = async () => {
          try {
            // Get SW URL from global variable (injected at build time)
            if (typeof __SERVICE_WORKER_URL__ === 'undefined') {
              console.warn('[SW] Service Worker URL not defined, skipping registration');
              return;
            }

            const swUrl = __SERVICE_WORKER_URL__;
            console.log('[SW] Attempting registration...', swUrl);
            const registration = await navigator.serviceWorker.register(swUrl);
            console.log(
              '[SW] ServiceWorker registration successful with scope: ',
              registration.scope,
            );

            // Check for updates periodically
            setInterval(
              () => {
                registration.update();
              },
              60 * 60 * 1000,
            ); // Check every hour
          } catch (registrationError) {
            console.error('[SW] ServiceWorker registration failed: ', registrationError);
          }
        };

        if (document.readyState === 'complete') {
          registerSW();
        } else {
          window.addEventListener('load', registerSW);
        }
      } else {
        // Unregister all service workers in development to avoid caching issues
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          if (registrations.length > 0) {
            console.log(
              '[SW] Unregistering',
              registrations.length,
              'service worker(s) in development',
            );
            for (const registration of registrations) {
              registration.unregister();
            }
          }
        });
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
