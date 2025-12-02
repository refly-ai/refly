import { memo, useCallback } from 'react';
import { Modal, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { LuCoins } from 'react-icons/lu';
import { useSubscriptionStoreShallow } from '@refly/stores';
import { logEvent } from '@refly/telemetry-web';

export const CreditInsufficientModal = memo(() => {
  const { t } = useTranslation();

  const {
    creditInsufficientModalVisible,
    setCreditInsufficientModalVisible,
    setSubscribeModalVisible,
    creditInsufficientMembershipLevel,
  } = useSubscriptionStoreShallow((state) => ({
    creditInsufficientModalVisible: state.creditInsufficientModalVisible,
    setCreditInsufficientModalVisible: state.setCreditInsufficientModalVisible,
    setSubscribeModalVisible: state.setSubscribeModalVisible,
    creditInsufficientMembershipLevel: state.creditInsufficientMembershipLevel,
  }));

  const handleUpgrade = useCallback(() => {
    logEvent('subscription::upgrade_click', 'credit_insufficient_modal');
    setCreditInsufficientModalVisible(false);
    setSubscribeModalVisible(true);
  }, [setCreditInsufficientModalVisible, setSubscribeModalVisible]);

  const displayMembershipLevel =
    creditInsufficientMembershipLevel || t('subscription.planType.free', '免费用户');

  return (
    <Modal
      open={creditInsufficientModalVisible}
      centered
      footer={null}
      width={410}
      onCancel={() => setCreditInsufficientModalVisible(false)}
    >
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-3">
        <div className="flex flex-row items-center">
          <span className="flex items-center justify-center text-3xl text-orange-500">
            <LuCoins />
          </span>
        </div>

        <div className="text-xl font-bold text-center">
          {t('canvas.skillResponse.creditInsufficient.title', '积分不足')}
        </div>

        <div className="text-sm text-gray-500 text-center mt-2">
          {t('canvas.skillResponse.creditInsufficient.description', {
            membershipLevel: displayMembershipLevel,
            defaultValue:
              '您当前订阅方案为 {{membershipLevel}}，积分已不足。升级套餐即可继续使用 Refly 的完整功能。',
          })}
        </div>

        <div className="flex flex-col w-full gap-2 mt-4">
          <Button type="primary" className="w-full" onClick={handleUpgrade}>
            {t('canvas.skillResponse.creditInsufficient.upgradeButton', '立即升级')}
          </Button>

          <Button className="w-full" onClick={() => setCreditInsufficientModalVisible(false)}>
            {t('common.cancel', '取消')}
          </Button>
        </div>
      </div>
    </Modal>
  );
});
