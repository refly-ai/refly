/**
 * Service Worker message handler
 * Listen for version update notifications and show friendly prompts
 */

let hasShownUpdateNotification = false;

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

  const { type, oldVersion, newVersion, url } = event.data;

  console.log('[SW Handler] Received message:', event.data);

  switch (type) {
    case 'NEW_VERSION_AVAILABLE':
      handleNewVersion(oldVersion, newVersion, url);
      break;

    case 'CHUNK_LOAD_ERROR':
      handleChunkLoadError(url);
      break;

    case 'CHECK_CONNECTION':
      // Respond to Service Worker's connection check
      handleConnectionCheck(event);
      break;

    default:
      console.log('[SW Handler] Unknown message type:', type);
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

/**
 * Handle new version notification
 */
function handleNewVersion(oldVersion: string, newVersion: string, url: string) {
  console.log('[SW Handler] New version detected:', {
    old: oldVersion,
    new: newVersion,
    url,
  });

  // Prevent duplicate notifications
  if (hasShownUpdateNotification) {
    console.log('[SW Handler] Update notification already shown, skipping');
    return;
  }
  hasShownUpdateNotification = true;

  // Report to monitoring (optional)
  reportVersionUpdate(oldVersion, newVersion);

  // Show update prompt
  showUpdateNotification(oldVersion, newVersion);
}

/**
 * Show update notification modal
 */
function showUpdateNotification(_oldVersion: string, _newVersion: string) {
  console.log('[SW Handler] Showing update notification');

  // Create update prompt modal
  const modalHTML = `
    <div id="sw-update-modal" style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <div style="
        background: white;
        border-radius: 12px;
        padding: 32px;
        max-width: 400px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      ">
        <div style="
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 16px;
          color: #1a1a1a;
        ">
          🎉 App Updated
        </div>
        <div style="
          font-size: 14px;
          color: #666;
          margin-bottom: 24px;
          line-height: 1.6;
        ">
          A new version is available. Please refresh the page for the best experience.
        </div>
        <div style="
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        ">
          <button id="sw-update-later" style="
            padding: 8px 16px;
            border: 1px solid #d9d9d9;
            border-radius: 6px;
            background: white;
            color: #333;
            cursor: pointer;
            font-size: 14px;
          ">
            Later
          </button>
          <button id="sw-update-now" style="
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            background: #1890ff;
            color: white;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">
            Refresh Now
          </button>
        </div>
      </div>
    </div>
  `;

  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer);

  // Refresh now button
  document.getElementById('sw-update-now')?.addEventListener('click', () => {
    window.location.reload();
  });

  // Later button - force reload after 5 minutes
  document.getElementById('sw-update-later')?.addEventListener('click', () => {
    modalContainer.remove();
    console.log('[SW Handler] User chose to update later, will force reload in 5 minutes');
    setTimeout(
      () => {
        console.log('[SW Handler] Force reloading after 5 minutes...');
        window.location.reload();
      },
      5 * 60 * 1000,
    ); // 5 minutes
  });
}

/**
 * Handle chunk load error
 */
function handleChunkLoadError(url: string) {
  console.error('[SW Handler] Chunk load error:', url);

  // Show error prompt
  if (confirm('Failed to load resource. The page will refresh to get the latest content.')) {
    window.location.reload();
  }
}

/**
 * Report version update to monitoring system (optional)
 */
function reportVersionUpdate(oldVersion: string, newVersion: string) {
  try {
    // Report to Sentry
    if ((window as any).Sentry) {
      (window as any).Sentry.captureMessage('App version updated', {
        level: 'info',
        extra: {
          oldVersion,
          newVersion,
          timestamp: Date.now(),
        },
      });
    }

    // Report to custom analytics
    if ((window as any).analytics) {
      (window as any).analytics.track('app_version_updated', {
        old_version: oldVersion,
        new_version: newVersion,
      });
    }
  } catch (error) {
    console.error('[SW Handler] Failed to report version update:', error);
  }
}
