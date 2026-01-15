import { useTranslation } from 'react-i18next';
import { Modal } from 'antd';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { ensureIndexedDbSupport } from '@refly-packages/ai-workspace-common/utils/indexeddb';
import { isPublicAccessPageByPath } from '@refly-packages/ai-workspace-common/hooks/use-is-share-page';
import { useUserStoreShallow } from '@refly/stores';
import { authChannel } from '@refly-packages/ai-workspace-common/utils/auth-channel';

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

// Add flag to track logout status
let isLoggingOut = false;

export const logout = async ({
  callRemoteLogout,
  resetUserState,
  navigate,
}: {
  callRemoteLogout?: boolean;
  resetUserState?: () => void;
  navigate?: (path: string) => void;
} = {}) => {
  // Return early if already logging out
  if (isLoggingOut) {
    console.log('Logout already in progress');
    return;
  }

  try {
    isLoggingOut = true;

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

    // Call logout api to clear cookies and revoke refresh token
    if (callRemoteLogout) {
      await getClient().logout();
    }

    // Reset user state in store
    resetUserState?.();

    // Broadcast logout event to other tabs
    authChannel.broadcast({ type: 'logout' });
    authChannel.updateCurrentUid(null);

    // Clear IndexedDB
    await deleteIndexedDB();

    // Clear localStorage
    localStorage.clear();
  } catch (error) {
    console.error('Failed to logout:', error);
  } finally {
    isLoggingOut = false;
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
