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

// Add flag to track logout status
let isLoggingOut = false;

export const logout = async ({
  callRemoteLogout,
}: {
  callRemoteLogout?: boolean;
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

    // Clear localStorage
    localStorage.clear();

    // Redirect to login page after logout
    window.location.href = '/login';
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
        await logout({ callRemoteLogout: true });
      },
    });
  };

  return {
    handleLogout,
    contextHolder,
  };
};
