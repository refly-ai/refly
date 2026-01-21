type NetworkStatus = 'NETWORK_BUSY' | 'NETWORK_IDLE' | 'ROUTE_CHANGE';

let inFlight = 0;
let idleTimer: number | null = null;
let isBusy = false;

const idleDelayMs = 3000;
const patchFlag = '__swNetworkActivityPatched__';

const postToServiceWorker = (type: NetworkStatus) => {
  const controller = navigator.serviceWorker?.controller;
  if (controller) {
    controller.postMessage({ type });
  }
};

const setBusy = () => {
  if (idleTimer) {
    window.clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (!isBusy) {
    isBusy = true;
    postToServiceWorker('NETWORK_BUSY');
  }
};

const setIdle = () => {
  if (idleTimer) {
    window.clearTimeout(idleTimer);
  }
  idleTimer = window.setTimeout(() => {
    idleTimer = null;
    if (inFlight === 0 && isBusy) {
      isBusy = false;
      postToServiceWorker('NETWORK_IDLE');
    }
  }, idleDelayMs);
};

const onRequestStart = () => {
  inFlight += 1;
  setBusy();
};

const onRequestEnd = () => {
  inFlight = Math.max(0, inFlight - 1);
  if (inFlight === 0) {
    setIdle();
  }
};

const patchFetch = () => {
  if (typeof window.fetch !== 'function') {
    return;
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    onRequestStart();
    try {
      return await originalFetch(...args);
    } finally {
      onRequestEnd();
    }
  };
};

const patchXHR = () => {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (...args) {
    (this as any).__swTracked = false;
    return originalOpen.apply(this, args as any);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    if (!(this as any).__swTracked) {
      (this as any).__swTracked = true;
      onRequestStart();
      this.addEventListener(
        'loadend',
        () => {
          onRequestEnd();
        },
        { once: true },
      );
    }
    return originalSend.apply(this, args as any);
  };
};

const setupControllerBridge = () => {
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (inFlight > 0) {
      setBusy();
    } else {
      setIdle();
    }
  });
};

const patchHistory = () => {
  const notifyRouteChange = () => {
    postToServiceWorker('ROUTE_CHANGE');
  };

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = (...args) => {
    const result = originalPushState(...args);
    notifyRouteChange();
    return result;
  };

  history.replaceState = (...args) => {
    const result = originalReplaceState(...args);
    notifyRouteChange();
    return result;
  };

  window.addEventListener('popstate', notifyRouteChange);
  window.addEventListener('hashchange', notifyRouteChange);
};

export const initNetworkActivityTracking = () => {
  if ((window as any)[patchFlag]) {
    return;
  }
  (window as any)[patchFlag] = true;

  patchFetch();
  patchXHR();
  patchHistory();
  setupControllerBridge();

  if (inFlight === 0) {
    setIdle();
  }
};
