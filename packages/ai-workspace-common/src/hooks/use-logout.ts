import { useTranslation } from 'react-i18next';
import { Modal } from 'antd';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

// Clear IndexedDB
const deleteIndexedDB = async () => {
  try {
    const databases = await window.indexedDB.databases?.();
    for (const db of databases ?? []) {
      window.indexedDB.deleteDatabase(db.name ?? '');
    }
  } catch (error) {
    console.error('Failed to clear IndexedDB:', error);
  }
};

// Flag to track post-logout reload
const AUTH_RELOAD_FLAG = 'rf_auth_last_reload';
// Set expiration to 5 minutes (in milliseconds)
const AUTH_RELOAD_EXPIRY_TIME = 5 * 60 * 1000;

/**
 * Sets the auth reload flag
 */
const setAuthReloadFlag = () => {
  localStorage.setItem(AUTH_RELOAD_FLAG, String(Date.now()));
};

/**
 * Checks if the auth reload flag exists and is not expired
 * @returns {boolean} Whether the flag exists and is valid
 */
const hasValidAuthReloadFlag = (): boolean => {
  const flagExists = localStorage.getItem(AUTH_RELOAD_FLAG) !== null;
  if (!flagExists) return false;

  const lastReloadTime = Number(localStorage.getItem(AUTH_RELOAD_FLAG) ?? '0');
  const isExpired = lastReloadTime + AUTH_RELOAD_EXPIRY_TIME < Date.now();

  return !isExpired;
};

// Add flag to track logout status
let isLoggingOut = false;

export const logout = async ({
  callRemoteLogout,
  forceReload = false,
}: {
  callRemoteLogout?: boolean;
  forceReload?: boolean;
} = {}) => {
  // Return early if already logging out
  if (isLoggingOut) {
    console.log('Logout already in progress');
    return;
  }

  try {
    isLoggingOut = true;

    // Call logout api to clear cookies and revoke refresh token
    if (callRemoteLogout) {
      await getClient().logout();
    }

    // Clear IndexedDB
    await deleteIndexedDB();

    // Clear rest of localStorage (except our flags if we just set them)
    const itemsToKeep = [AUTH_RELOAD_FLAG];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !itemsToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    }

    const hasFlag = hasValidAuthReloadFlag();

    if (!hasFlag) {
      setAuthReloadFlag();
    }

    if (forceReload || !hasFlag) {
      window.location.reload();
    }
  } catch (error) {
    console.error('Failed to logout:', error);
  } finally {
    isLoggingOut = false;
  }
};

export const useLogout = () => {
  const { t } = useTranslation();

  const [modal, contextHolder] = Modal.useModal();

  const handleLogout = () => {
    modal.confirm?.({
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      title: t('settings.account.logoutConfirmation.title'),
      content: t('settings.account.logoutConfirmation.message'),
      centered: true,
      async onOk() {
        await logout({ callRemoteLogout: true, forceReload: true });
      },
    });
  };

  return {
    handleLogout,
    contextHolder,
  };
};
