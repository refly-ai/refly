import { memo, FC, useCallback } from 'react';
import { Button, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSubscriptionStoreShallow } from '@refly/stores';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { getAvailableFileCount } from '@refly/utils/quota';
import { logEvent } from '@refly/telemetry-web';

interface StorageLimitProps {
  showProjectSelect?: boolean;
  resourceCount: number;
  projectId?: string;
  onSelectProject?: (projectId: string) => void;
}

export const StorageLimit: FC<StorageLimitProps> = memo(({ resourceCount }) => {
  const { t } = useTranslation();
  const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
  }));

  const handleUpgrade = useCallback(() => {
    logEvent('subscription::upgrade_click', 'storage_limit');
    setSubscribeModalVisible(true);
  }, [setSubscribeModalVisible]);

  const { storageUsage } = useSubscriptionUsage();
  const canImportCount = getAvailableFileCount(storageUsage);
  const storageLimitTip = () => {
    if (canImportCount <= 0) {
      return t('resource.import.storageLimited');
    }
    if (resourceCount > 0 && canImportCount < resourceCount) {
      return t('resource.import.storagePartialLimited', { count: canImportCount });
    }
  };

  return storageLimitTip() ? (
    <div className="flex items-center whitespace-nowrap text-md">
      <Alert
        message={storageLimitTip()}
        type="warning"
        showIcon
        action={
          <Button
            type="text"
            size="small"
            className="!text-refly-primary-default ml-2 font-bold"
            onClick={handleUpgrade}
          >
            {t('resource.import.upgrade')}
          </Button>
        }
      />
    </div>
  ) : null;
});
