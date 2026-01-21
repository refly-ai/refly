/**
 * Service Worker message handler
 * Listen for runtime messages from the Service Worker
 */

/**
 * Initialize message handler
 */
export function initMessageHandler() {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW Handler] Service Worker not supported');
    return;
  }

  // Listen for Service Worker messages
  navigator.serviceWorker.addEventListener('message', handleMessage);

  console.log('[SW Handler] Message handler initialized');
}

/**
 * Handle Service Worker messages
 */
function handleMessage(event: MessageEvent) {
  if (!event.data || typeof event.data !== 'object') {
    console.log('[SW Handler] Ignoring message without data:', event.data);
    return;
  }

  const { type } = event.data;

  console.log('[SW Handler] Received message:', event.data);

  switch (type) {
    case 'NEW_VERSION_AVAILABLE':
      handleAutoRefreshDuringLoad();
      break;

    case 'CHUNK_LOAD_ERROR':
      break;

    case 'CHECK_CONNECTION':
      // Respond to Service Worker's connection check
      handleConnectionCheck(event);
      break;

    default:
      console.log('[SW Handler] Unknown message type:', type);
  }
}

function handleAutoRefreshDuringLoad() {
  if (document.readyState !== 'complete') {
    console.log('[SW Handler] Reloading page during initial load for new version');
    window.location.reload();
  }
}

/**
 * Check connection and respond to Service Worker
 */
function handleConnectionCheck(event: MessageEvent) {
  const connection = (navigator as any).connection;
  let mode: 'skip' | 'limited' | 'full' = 'full';

  if (connection) {
    // Skip on very slow connections or Save-Data
    if (connection.saveData) {
      mode = 'skip';
    }
    const slowConnections = ['slow-2g', '2g', '3g'];
    if (slowConnections.includes(connection.effectiveType)) {
      mode = 'skip';
    }

    // Treat cellular as limited even if fast
    if (mode === 'full') {
      const isCellular = connection.type === 'cellular';
      if (isCellular) {
        mode = 'limited';
      }
    }
  }

  // Respond via message port
  if (event.ports?.[0]) {
    event.ports[0].postMessage({ mode });
  }

  console.log('[SW Handler] Connection check response:', { mode });
}
