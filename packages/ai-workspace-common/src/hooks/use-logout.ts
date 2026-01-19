import { useTranslation } from 'react-i18next';
import { Modal } from 'antd';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { ensureIndexedDbSupport } from '@refly-packages/ai-workspace-common/utils/indexeddb';
import { isPublicAccessPageByPath } from '@refly-packages/ai-workspace-common/hooks/use-is-share-page';
import { useUserStoreShallow } from '@refly/stores';
import { authChannel } from '@refly-packages/ai-workspace-common/utils/auth-channel';
import { resetUserSettingsRequestState } from '@refly-packages/ai-workspace-common/hooks/use-get-user-settings';

// Clear IndexedDB
const deleteIndexedDB = async () => {
  try {
    const canUseIndexedDb = await ensureIndexedDbSupport();
    if (!canUseIndexedDb) {
      return;
    }

    const databases = await window?.indexedDB?.databases?.();
    const databaseList = Array.isArray(databases) ? databases : [];
    for (const db of databaseList) {
      if (!db?.name) {
        continue;
      }
      const deleteRequest = window?.indexedDB?.deleteDatabase?.(db.name ?? '');
      if (!deleteRequest) {
        continue;
      }
      await new Promise<void>((resolve) => {
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
        deleteRequest.onblocked = () => resolve();
      });
    }
  } catch (error) {
    console.error('Failed to clear IndexedDB:', error);
  }
};

export const logout = async ({
  callRemoteLogout,
  resetUserState,
  navigate,
}: {
  callRemoteLogout?: boolean;
  resetUserState?: () => void;
  navigate?: (path: string) => void;
} = {}) => {
  // Note: No lock needed here because:
  // 1. This function is idempotent (safe to call multiple times)
  // 2. Modal confirmation prevents accidental double-clicks
  // 3. Module-level locks cause issues in SPA when components unmount

  try {
    // Strategy: Navigate FIRST, then cleanup
    // This prevents components from making unauthorized requests during cleanup
    const currentPath = window.location.pathname;
    const isPublicPage = isPublicAccessPageByPath(currentPath);

    if (!isPublicPage) {
      // Navigate to login page FIRST (before any cleanup)
      // This unmounts workspace components and prevents them from making requests
      if (navigate) {
        navigate('/login');
        // Give router time to navigate and unmount old components
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else {
        // For hard redirect, do cleanup first since page will reload anyway
        window.location.href = '/login';
        return;
      }
    }

    // Now that we're on login page (or public page), safe to cleanup

    // Broadcast logout event to other tabs FIRST
    // This ensures other tabs know about logout even if subsequent steps fail
    authChannel.broadcast({ type: 'logout' });
    authChannel.updateCurrentUid(null);
    resetUserSettingsRequestState();

    // Call logout api to clear cookies and revoke refresh token
    if (callRemoteLogout) {
      await getClient()
        .logout()
        .catch((err) => {
          // Don't block logout if API call fails (e.g., network error, already logged out)
          console.warn('[Logout] API call failed:', err);
        });
    }

    // Reset user state in store
    resetUserState?.();

    // Clear IndexedDB (non-blocking, errors already handled internally)
    await deleteIndexedDB();

    // Clear localStorage
    localStorage.clear();
  } catch (error) {
    console.error('[Logout] Failed:', error);
  }
};

export const useLogout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { resetState } = useUserStoreShallow((state) => ({
    resetState: state.resetState,
  }));

  const [modal, contextHolder] = Modal.useModal();

  const handleLogout = () => {
    modal.confirm?.({
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      title: t('settings.account.logoutConfirmation.title'),
      content: t('settings.account.logoutConfirmation.message'),
      centered: true,
      onOk() {
        // Don't await logout - let Modal close immediately
        // This prevents the loading spinner from hanging while cleanup happens
        logout({
          callRemoteLogout: true,
          resetUserState: resetState,
          navigate: (path: string) => navigate(path, { replace: true }),
        });
        // Return void to close Modal immediately
      },
    });
  };

  return {
    handleLogout,
    contextHolder,
  };
};
