import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { logEvent } from '@refly/telemetry-web';
// styles
import './index.scss';
import { useSiderStoreShallow, useSubscriptionStoreShallow } from '@refly/stores';
import { PriceContent } from './priceContent';

export const SubscribeModal = () => {
  const { t } = useTranslation('ui');
  const {
    subscribeModalVisible: visible,
    setSubscribeModalVisible: setVisible,
    openedFromSettings,
    setOpenedFromSettings,
  } = useSubscriptionStoreShallow((state) => ({
    subscribeModalVisible: state.subscribeModalVisible,
    setSubscribeModalVisible: state.setSubscribeModalVisible,
    openedFromSettings: state.openedFromSettings,
    setOpenedFromSettings: state.setOpenedFromSettings,
  }));

  const { setShowSettingModal } = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
  }));

  return (
    <Modal
      width={'100vw'}
      height={'100vh'}
      style={{
        top: 0,
        paddingBottom: 0,
        maxWidth: '100vw',
      }}
      open={visible}
      footer={null}
      className="subscribe-modal !p-0"
      onCancel={() => {
        setVisible(false);
        // Only reopen SettingModal if SubscribeModal was opened from it
        if (openedFromSettings) {
          setShowSettingModal(true);
          setOpenedFromSettings(false); // Reset the flag
        }
        logEvent('subscription::price_table_close', 'settings');
      }}
    >
      <div className="w-full h-full overflow-auto flex flex-col items-center gap-3 py-8">
        <div className="font-bold text-2xl m-auto flex items-center gap-2 text-[color:var(--text-icon-refly-text-0,#1C1F23)] [font-family:'PingFang_SC'] text-[22px] font-semibold leading-8">
          {t('subscription.modalTitle')}
        </div>
        <PriceContent source="modal" />
      </div>
    </Modal>
  );
};
