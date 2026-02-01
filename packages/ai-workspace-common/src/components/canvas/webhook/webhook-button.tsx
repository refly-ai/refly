import { memo, useState, lazy, Suspense } from 'react';
import { Button, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { LuWebhook } from 'react-icons/lu';

// Lazy load WebhookConfigModal to reduce initial bundle size
const WebhookConfigModal = lazy(() =>
  import('./webhook-config-modal').then((m) => ({
    default: m.WebhookConfigModal,
  })),
);

interface WebhookButtonProps {
  canvasId: string;
}

export const WebhookButton = memo(({ canvasId }: WebhookButtonProps) => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Tooltip title={t('webhook.integration')}>
        <Button icon={<LuWebhook size={16} />} onClick={() => setModalOpen(true)}>
          {t('webhook.integration')}
        </Button>
      </Tooltip>

      {modalOpen && (
        <Suspense fallback={null}>
          <WebhookConfigModal
            canvasId={canvasId}
            open={modalOpen}
            onClose={() => setModalOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
});

WebhookButton.displayName = 'WebhookButton';
