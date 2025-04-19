import { IRuntime } from '@refly/common-types';

export const serverOrigin =
  window?.electronEnv?.getApiBaseUrl() ||
  window?.ENV?.API_URL ||
  import.meta.env.VITE_API_URL ||
  '';
console.log('serverOrigin', serverOrigin);

export const wsServerOrigin =
  window?.electronEnv?.getCollabUrl() ||
  window?.ENV?.COLLAB_URL ||
  import.meta.env.VITE_COLLAB_URL ||
  '';
console.log('wsServerOrigin', wsServerOrigin);

export const staticPublicEndpoint =
  window?.electronEnv?.getPublicStaticEndpoint() ||
  window?.ENV?.STATIC_PUBLIC_ENDPOINT ||
  import.meta.env.VITE_STATIC_PUBLIC_ENDPOINT ||
  '';

export const staticPrivateEndpoint =
  window?.electronEnv?.getPrivateStaticEndpoint() ||
  window?.ENV?.STATIC_PRIVATE_ENDPOINT ||
  import.meta.env.VITE_STATIC_PRIVATE_ENDPOINT ||
  '';

export const subscriptionEnabled =
  Boolean(window.ENV?.SUBSCRIPTION_ENABLED) || Boolean(import.meta.env.VITE_SUBSCRIPTION_ENABLED);

export const sentryEnabled =
  Boolean(window.ENV?.SENTRY_ENABLED) || Boolean(import.meta.env.VITE_SENTRY_ENABLED);

export const runtime: IRuntime = import.meta.env.VITE_RUNTIME;

export const isDesktop = () => runtime === 'desktop';
