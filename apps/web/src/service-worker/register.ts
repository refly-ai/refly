/**
 * Service Worker registration manager
 * Consolidated from the previous App.tsx logic
 */

declare const __SERVICE_WORKER_URL__: string;

/**
 * Register Service Worker
 */
export function registerServiceWorker() {
  if (typeof navigator === 'undefined') {
    console.warn('[SW] Navigator not available, skipping registration');
    return;
  }

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
  if (!navigator?.serviceWorker) {
    console.warn('[SW] Service Worker not supported');
    return;
  }

  const UPDATE_INTERVAL_MS = 60 * 60 * 1000;
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
      setInterval(() => {
        console.log('[SW] Checking for updates...');
        registration.update().catch((error) => {
          console.warn('[SW] ServiceWorker update failed:', error);
        });
      }, UPDATE_INTERVAL_MS); // 1 hour

      // Start background precache after page is fully loaded
      startPrecacheWhenReady();
    } catch (error) {
      console.error('[SW] ServiceWorker registration failed:', error);
    }
  };

  // Wait for page load
  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}

/**
 * Start background precache only after page is fully loaded
 */
function startPrecacheWhenReady() {
  const startPrecache = () => {
    const controller = navigator.serviceWorker?.controller;
    if (!controller) {
      console.warn('[SW] No active controller, cannot start precache');
      return;
    }

    console.log('[SW] Page fully loaded, requesting background precache to start');
    controller.postMessage({ type: 'START_PRECACHE' });
  };

  // Ensure page is fully loaded (readyState === 'complete')
  if (document.readyState === 'complete') {
    // Add a small delay to ensure all immediate post-load requests complete
    setTimeout(startPrecache, 3000);
  } else {
    window.addEventListener(
      'load',
      () => {
        // Add a small delay to ensure all immediate post-load requests complete
        setTimeout(startPrecache, 3000);
      },
      { once: true },
    );
  }
}

/**
 * Development: unregister all Service Workers
 * Avoid cache issues during development
 */
async function unregisterInDevelopment() {
  if (!navigator?.serviceWorker) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
      return;
    }

    console.log('[SW] Unregistering', registrations.length, 'service worker(s) in development');
    for (const registration of registrations) {
      await registration.unregister();
    }
  } catch (error) {
    console.error('[SW] Failed to unregister service workers:', error);
  }
}
