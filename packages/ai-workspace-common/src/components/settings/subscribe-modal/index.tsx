import { Modal } from 'antd';

// styles
import './index.scss';
import { useTranslation } from 'react-i18next';
import { useSubscriptionStoreShallow } from '@refly-packages/ai-workspace-common/stores/subscription';
import { PriceContent } from './priceContent';
import { IconSubscription } from '@refly-packages/ai-workspace-common/components/common/icon';

export const SubscribeModal = () => {
  const { t } = useTranslation();
  const { subscribeModalVisible: visible, setSubscribeModalVisible: setVisible } =
    useSubscriptionStoreShallow((state) => ({
      subscribeModalVisible: state.subscribeModalVisible,
      setSubscribeModalVisible: state.setSubscribeModalVisible,
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
      onCancel={() => setVisible(false)}
    >
      <div className="w-full h-full overflow-auto flex flex-col items-center gap-3">
        <div className="font-bold text-3xl m-auto flex items-center gap-2">
          <IconSubscription /> {t('settings.subscription.subscribe.title')}
        </div>
        <PriceContent source="modal" />
      </div>
    </Modal>
  );
};
