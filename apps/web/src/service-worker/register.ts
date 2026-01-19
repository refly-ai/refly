/**
 * Service Worker registration manager
 * Consolidated from the previous App.tsx logic
 */

declare const __SERVICE_WORKER_URL__: string;

/**
 * Register Service Worker
 */
export function registerServiceWorker() {
  console.log('[SW] Checking eligibility...', {
    hasSW: 'serviceWorker' in navigator,
    env: process.env.NODE_ENV,
  });

  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Worker not supported');
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    registerInProduction();
  } else {
    unregisterInDevelopment();
  }
}

/**
 * Production: register Service Worker
 */
function registerInProduction() {
  const register = async () => {
    try {
      // Get SW URL from global variable (injected at build time)
      if (typeof __SERVICE_WORKER_URL__ === 'undefined') {
        console.warn('[SW] Service Worker URL not defined, skipping registration');
        return;
      }

      const swUrl = __SERVICE_WORKER_URL__;
      console.log('[SW] Attempting registration...', swUrl);

      const registration = await navigator.serviceWorker.register(swUrl);
      console.log('[SW] ServiceWorker registration successful with scope:', registration.scope);

      // Check for updates periodically (every hour)
      setInterval(
        () => {
          console.log('[SW] Checking for updates...');
          registration.update();
        },
        60 * 60 * 1000,
      ); // 1 hour
    } catch (error) {
      console.error('[SW] ServiceWorker registration failed:', error);
    }
  };

  // Wait for page load
  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register);
  }
}

/**
 * Development: unregister all Service Workers
 * Avoid cache issues during development
 */
function unregisterInDevelopment() {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length > 0) {
      console.log('[SW] Unregistering', registrations.length, 'service worker(s) in development');

      for (const registration of registrations) {
        registration.unregister();
      }
    }
  });
}
