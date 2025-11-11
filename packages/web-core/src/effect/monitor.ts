import React from 'react';
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom';
import { envTag } from '@refly/ui-kit';
import { getEnv } from '@refly/utils';

export const setupSentry = async () => {
  const sentryDsn = process.env.VITE_SENTRY_DSN;

  if (process.env.NODE_ENV !== 'development' && sentryDsn) {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn: sentryDsn,
      environment: envTag || getEnv(),
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
        Sentry.reactRouterV6BrowserTracingIntegration({
          useEffect: React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes,
        }),
      ],
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ['localhost', 'https://refly.ai'],
      // Session Replay
      replaysSessionSampleRate: 0, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
      beforeSend(event) {
        // Filter out script loading errors that we've already handled
        if (
          event.exception?.values?.some(
            (exception) =>
              exception.value &&
              (exception.value.includes('script') || exception.value.includes('font-inter')),
          )
        ) {
          return null;
        }
        return event;
      },
    });
  }
};
