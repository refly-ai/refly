import { memo, useMemo, useState, useCallback } from 'react';
import { Button, Row, Col } from 'antd';
import { useTranslation } from 'react-i18next';
import { logEvent } from '@refly/telemetry-web';

import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { IconSubscription } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Checked } from 'refly-icons';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useUserStoreShallow, useAuthStoreShallow } from '@refly/stores';

interface CreditPackOption {
  id: string;
  price: string;
  credits: string;
}

interface CreditPackCardProps {
  pack: CreditPackOption;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const CreditPackCard = memo(({ pack, isSelected, onSelect }: CreditPackCardProps) => {
  const handleClick = useCallback(() => {
    onSelect(pack.id);
  }, [pack.id, onSelect]);

  return (
    <div
      className={`
        relative flex items-center justify-between p-4 px-5 bg-white 
        rounded-xl cursor-pointer transition-all duration-200 min-h-[72px]
        ${
          isSelected
            ? 'border-2 border-[#0E9F77] shadow-[0px_2px_12px_rgba(14,159,119,0.15)]'
            : 'border-[1.5px] border-gray-200 hover:border-[#0E9F77] hover:shadow-[0px_2px_8px_rgba(14,159,119,0.1)]'
        }
      `}
      onClick={handleClick}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900 leading-none">{pack.price}</span>
        <span className="text-sm font-normal text-gray-500 leading-none">{pack.credits}</span>
      </div>
      {isSelected && (
        <div className="absolute -top-[-12px] -right-[-16px] w-4 h-4 bg-[#0E9F77] rounded-full flex items-center justify-center">
          <Checked size={12} color="#fff" />
        </div>
      )}
    </div>
  );
});

CreditPackCard.displayName = 'CreditPackCard';

interface FeatureItemProps {
  feature: string;
}

const FeatureItem = memo(({ feature }: FeatureItemProps) => {
  const parts = feature.split('\n');
  const title = parts[0];
  const description = parts.length > 1 ? parts.slice(1).join('\n') : null;

  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <Checked size={16} color="#0E9F77" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-gray-900 leading-5">{title}</span>
        {description && (
          <span className="text-[13px] font-normal text-gray-500 leading-[18px]">
            {description}
          </span>
        )}
      </div>
    </div>
  );
});

FeatureItem.displayName = 'FeatureItem';

export interface CreditPacksModalProps {
  onCancel?: () => void;
  onSuccess?: () => void;
}

export const CreditPacksModal = memo(({ onCancel, onSuccess }: CreditPacksModalProps) => {
  const { t } = useTranslation('ui');
  const [selectedPackId, setSelectedPackId] = useState<string>('credit_pack_100');
  const [isLoading, setIsLoading] = useState(false);

  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  // Credit pack options data - arranged in 2x2 grid order (row by row)
  const creditPackOptions: CreditPackOption[] = useMemo(
    () => [
      {
        id: 'credit_pack_100',
        price: t('subscription.creditPacks.credit_pack_100.price'),
        credits: t('subscription.creditPacks.credit_pack_100.credits'),
      },
      {
        id: 'credit_pack_1000',
        price: t('subscription.creditPacks.credit_pack_1000.price'),
        credits: t('subscription.creditPacks.credit_pack_1000.credits'),
      },
      {
        id: 'credit_pack_500',
        price: t('subscription.creditPacks.credit_pack_500.price'),
        credits: t('subscription.creditPacks.credit_pack_500.credits'),
      },
      {
        id: 'credit_pack_2000',
        price: t('subscription.creditPacks.credit_pack_2000.price'),
        credits: t('subscription.creditPacks.credit_pack_2000.credits'),
      },
    ],
    [t],
  );

  // Features list
  const features = useMemo(() => {
    return (t('subscription.creditPacks.features', { returnObjects: true }) as string[]) ?? [];
  }, [t]);

  const handleSelectPack = useCallback((packId: string) => {
    setSelectedPackId(packId);
  }, []);

  const handleBuyNow = useCallback(async () => {
    if (isLoading) return;

    // Track credit pack purchase click event
    logEvent('subscription::credit_pack_modal_click', 'settings', {
      pack_id: selectedPackId,
    });

    if (!isLogin) {
      setLoginModalOpen(true);
      return;
    }

    setIsLoading(true);
    try {
      const res = await getClient().createCreditPackCheckoutSession({
        body: {
          packId: selectedPackId,
        },
      });
      if (res.data?.data?.url) {
        window.location.href = res.data.data.url;
        onSuccess?.();
      }
    } catch (error) {
      console.error('Failed to create credit pack checkout session:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isLogin, selectedPackId, setLoginModalOpen, onSuccess]);

  const handleCancel = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  return (
    <div
      className="w-[532px] max-w-full p-6 box-border rounded-2xl shadow-[0px_4px_24px_rgba(0,0,0,0.08)]"
      style={{
        background: 'linear-gradient(180deg, #FEC04C30, rgba(255, 255, 255, 0) 50%), #ffffff',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <IconSubscription className="w-6 h-6 text-gray-900" />
        <span className="text-xl font-semibold text-gray-900 leading-7">
          {t('subscription.creditPacks.title')}
        </span>
      </div>

      {/* Credit pack options - 2x2 grid */}
      <Row gutter={[12, 12]} className="mb-6">
        {creditPackOptions.map((pack) => (
          <Col span={12} key={pack.id}>
            <CreditPackCard
              pack={pack}
              isSelected={selectedPackId === pack.id}
              onSelect={handleSelectPack}
            />
          </Col>
        ))}
      </Row>

      {/* Features list */}
      <div className="py-5 border-t border-black/[0.06] flex flex-col gap-4">
        {features.map((feature, index) => (
          <FeatureItem key={index} feature={feature} />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-4 border-t border-black/[0.06]">
        <Button
          className="flex-1 h-11 text-sm font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:!bg-gray-50 hover:!border-gray-300 hover:!text-gray-900"
          onClick={handleCancel}
        >
          {t('subscription.creditPacks.cancel')}
        </Button>
        <Button
          type="primary"
          className="flex-1 h-11 text-sm font-semibold rounded-lg bg-gray-900 border-none text-white hover:!bg-gray-800"
          onClick={handleBuyNow}
          loading={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Spin size="small" />
              <span>{t('common.loading')}</span>
            </div>
          ) : (
            t('subscription.creditPacks.buyNow')
          )}
        </Button>
      </div>
    </div>
  );
});

CreditPacksModal.displayName = 'CreditPacksModal';

export default CreditPacksModal;
