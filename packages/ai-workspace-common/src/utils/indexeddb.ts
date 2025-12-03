const INDEXED_DB_TEST_NAME = '__refly_indexeddb_support_test__';
const SUPPORT_CHECK_TIMEOUT = 3000;

let indexedDbSupported: boolean | null = null;
let supportCheckPromise: Promise<boolean> | null = null;

const settleSupportCheck = (resolve: (value: boolean) => void, result: boolean) => {
  indexedDbSupported = result;
  supportCheckPromise = null;
  resolve(result);
};

const runIndexedDbSupportCheck = (): Promise<boolean> => {
  if (supportCheckPromise) {
    return supportCheckPromise;
  }

  supportCheckPromise = new Promise<boolean>((resolve) => {
    let hasSettled = false;

    const finish = (result: boolean) => {
      if (hasSettled) {
        return;
      }
      hasSettled = true;
      settleSupportCheck(resolve, result);
    };

    try {
      const request = window?.indexedDB?.open(INDEXED_DB_TEST_NAME);
      if (!request) {
        finish(false);
        return;
      }

      const timeoutId = window?.setTimeout?.(() => finish(false), SUPPORT_CHECK_TIMEOUT) ?? 0;
      const clearTimer = () => {
        if (timeoutId) {
          window?.clearTimeout?.(timeoutId);
        }
      };

      request.onupgradeneeded = () => {
        try {
          request.result?.createObjectStore?.('test', { autoIncrement: true });
        } catch {
          // Ignore store creation failures; availability check will still resolve.
        }
      };

      request.onsuccess = () => {
        clearTimer();
        try {
          request.result?.close?.();
          window?.indexedDB?.deleteDatabase?.(INDEXED_DB_TEST_NAME);
        } catch {
          // Ignore cleanup errors because the goal is only to detect support.
        }
        finish(true);
      };

      request.onerror = () => {
        clearTimer();
        finish(false);
      };

      request.onblocked = () => {
        clearTimer();
        finish(false);
      };
    } catch {
      finish(false);
    }
  });

  return supportCheckPromise;
};

export const ensureIndexedDbSupport = async (): Promise<boolean> => {
  if (indexedDbSupported !== null) {
    return indexedDbSupported;
  }

  if (typeof window === 'undefined' || !window?.indexedDB) {
    indexedDbSupported = false;
    return false;
  }

  return runIndexedDbSupportCheck();
};

export const getIndexedDbSupportState = (): boolean | null => indexedDbSupported;
