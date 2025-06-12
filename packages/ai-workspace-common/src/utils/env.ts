import { IRuntime } from '@refly/common-types';

/**
 * Checks if code is running in browser environment and safely accesses window properties
 */
const isBrowser = typeof window !== 'undefined';

/**
 * Safely access window properties in browser environment
 */
const getBrowserValue = <T>(getter: () => T, fallback: T): T => {
  if (!isBrowser) return fallback;
  try {
    return getter() ?? fallback;
  } catch {
    return fallback;
  }
};

export const serverOrigin =
  getBrowserValue(() => window.electronEnv?.getApiBaseUrl?.(), '') ||
  getBrowserValue(() => window.ENV?.API_URL, '') ||
  import.meta.env.VITE_API_URL ||
  '';
console.log('serverOrigin', serverOrigin);

export const wsServerOrigin =
  getBrowserValue(() => window.electronEnv?.getCollabUrl?.(), '') ||
  getBrowserValue(() => window.ENV?.COLLAB_URL, '') ||
  import.meta.env.VITE_COLLAB_URL ||
  '';
console.log('wsServerOrigin', wsServerOrigin);

export const staticPublicEndpoint =
  getBrowserValue(() => window.electronEnv?.getPublicStaticEndpoint?.(), '') ||
  getBrowserValue(() => window.ENV?.STATIC_PUBLIC_ENDPOINT, '') ||
  import.meta.env.VITE_STATIC_PUBLIC_ENDPOINT ||
  '';

export const staticPrivateEndpoint =
  getBrowserValue(() => window.electronEnv?.getPrivateStaticEndpoint?.(), '') ||
  getBrowserValue(() => window.ENV?.STATIC_PRIVATE_ENDPOINT, '') ||
  import.meta.env.VITE_STATIC_PRIVATE_ENDPOINT ||
  '';

export const subscriptionEnabled =
  getBrowserValue(() => Boolean(window.ENV?.SUBSCRIPTION_ENABLED), false) ||
  Boolean(import.meta.env.VITE_SUBSCRIPTION_ENABLED);

export const canvasTemplateEnabled =
  getBrowserValue(() => Boolean(window.ENV?.CANVAS_TEMPLATE_ENABLED), false) ||
  Boolean(import.meta.env.VITE_CANVAS_TEMPLATE_ENABLED);

export const sentryEnabled =
  getBrowserValue(() => Boolean(window.ENV?.SENTRY_ENABLED), false) ||
  Boolean(import.meta.env.VITE_SENTRY_ENABLED);

export const runtime: IRuntime = import.meta.env.VITE_RUNTIME;

export const isDesktop = () => runtime === 'desktop';

export const isMultiTenantEnabled = () =>
  runtime !== 'desktop' &&
  (getBrowserValue(() => Boolean(window.ENV?.MULTI_TENANT_ENABLED), false) ||
    Boolean(import.meta.env.VITE_MULTI_TENANT_ENABLED));
