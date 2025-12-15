import { Modal } from 'antd';
import { logEvent } from '@refly/telemetry-web';
// styles
import './index.scss';
import { useSiderStoreShallow, useSubscriptionStoreShallow } from '@refly/stores';
import { PricingModal } from './pricing-modal';
import { useEffect } from 'react';

export const SubscribeModal = () => {
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

  useEffect(() => {
    if (visible) {
      logEvent('enter_pricing_page', 'settings');
    }
  }, [visible]);

  const handleCancel = () => {
    setVisible(false);
    // Only reopen SettingModal if SubscribeModal was opened from it
    if (openedFromSettings) {
      setShowSettingModal(true);
      setOpenedFromSettings(false); // Reset the flag
    }
    logEvent('subscription::price_table_close', 'settings');
  };

  return (
    <Modal
      width={600}
      centered
      open={visible}
      footer={null}
      closable={true}
      onCancel={handleCancel}
      className="subscribe-modal-new"
      styles={{
        content: {
          padding: 0,
          background: 'transparent',
          boxShadow: 'none',
        },
        body: {
          padding: 0,
        },
      }}
    >
      <PricingModal mode="modal" onCancel={handleCancel} />
    </Modal>
  );
};
