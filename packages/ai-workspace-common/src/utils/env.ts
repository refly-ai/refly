export const serverOrigin =
  (typeof window !== 'undefined' && window.ENV?.API_URL) || import.meta.env.VITE_API_URL;
export const wsServerOrigin =
  (typeof window !== 'undefined' && window.ENV?.COLLAB_URL) || import.meta.env.VITE_COLLAB_URL;
export const staticPublicEndpoint =
  (typeof window !== 'undefined' && window.ENV?.STATIC_PUBLIC_ENDPOINT) ||
  import.meta.env.VITE_STATIC_PUBLIC_ENDPOINT;
export const staticPrivateEndpoint =
  (typeof window !== 'undefined' && window.ENV?.STATIC_PRIVATE_ENDPOINT) ||
  import.meta.env.VITE_STATIC_PRIVATE_ENDPOINT;

export const subscriptionEnabled =
  Boolean(typeof window !== 'undefined' && window.ENV?.SUBSCRIPTION_ENABLED) ||
  Boolean(import.meta.env.VITE_SUBSCRIPTION_ENABLED);

export const sentryEnabled =
  Boolean(typeof window !== 'undefined' && window.ENV?.SENTRY_ENABLED) ||
  Boolean(import.meta.env.VITE_SENTRY_ENABLED);
