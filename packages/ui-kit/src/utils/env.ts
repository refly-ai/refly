import { IRuntime } from '@refly/common-types';

declare global {
  interface Window {
    ENV?: {
      API_URL?: string;
      COLLAB_URL?: string;
      STATIC_PUBLIC_ENDPOINT?: string;
      STATIC_PRIVATE_ENDPOINT?: string;
      SUBSCRIPTION_ENABLED?: boolean;
      CANVAS_TEMPLATE_ENABLED?: boolean;
      SENTRY_ENABLED?: boolean;
      ENV_TAG?: string;
    };

    ipcRenderer?: {
      invoke: (channel: string, args: any) => Promise<any>;
    };

    electronEnv?: {
      getApiBaseUrl: () => string;
      getCollabUrl: () => string;
      getPublicStaticEndpoint: () => string;
      getPrivateStaticEndpoint: () => string;
    };
  }
}

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
  process.env.VITE_API_URL ||
  '';
console.log('serverOrigin', serverOrigin);

export const wsServerOrigin =
  getBrowserValue(() => window.electronEnv?.getCollabUrl?.(), '') ||
  getBrowserValue(() => window.ENV?.COLLAB_URL, '') ||
  process.env.VITE_COLLAB_URL ||
  '';
console.log('wsServerOrigin', wsServerOrigin);

export const staticPublicEndpoint =
  getBrowserValue(() => window.electronEnv?.getPublicStaticEndpoint?.(), '') ||
  getBrowserValue(() => window.ENV?.STATIC_PUBLIC_ENDPOINT, '') ||
  process.env.VITE_STATIC_PUBLIC_ENDPOINT ||
  '';

export const staticPrivateEndpoint =
  getBrowserValue(() => window.electronEnv?.getPrivateStaticEndpoint?.(), '') ||
  getBrowserValue(() => window.ENV?.STATIC_PRIVATE_ENDPOINT, '') ||
  process.env.VITE_STATIC_PRIVATE_ENDPOINT ||
  '';

export const subscriptionEnabled =
  getBrowserValue(() => Boolean(window.ENV?.SUBSCRIPTION_ENABLED), false) ||
  Boolean(process.env.VITE_SUBSCRIPTION_ENABLED);

export const canvasTemplateEnabled =
  getBrowserValue(() => Boolean(window.ENV?.CANVAS_TEMPLATE_ENABLED), false) ||
  Boolean(process.env.VITE_CANVAS_TEMPLATE_ENABLED);

export const sentryEnabled =
  getBrowserValue(() => Boolean(window.ENV?.SENTRY_ENABLED), false) ||
  Boolean(process.env.VITE_SENTRY_ENABLED);

export const envTag = getBrowserValue(() => window.ENV?.ENV_TAG, '') || process.env.VITE_ENV_TAG;
console.log('envTag', envTag);

export const runtime = process.env.VITE_RUNTIME as IRuntime;

export const isDesktop = () => runtime === 'desktop';
