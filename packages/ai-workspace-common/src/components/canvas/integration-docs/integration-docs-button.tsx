import { memo, useState, lazy, Suspense } from 'react';
import { Button, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { LuWebhook } from 'react-icons/lu';

const IntegrationDocsModal = lazy(() =>
  import('./integration-docs-modal').then((m) => ({
    default: m.IntegrationDocsModal,
  })),
);

interface IntegrationDocsButtonProps {
  canvasId: string;
}

export const IntegrationDocsButton = memo(({ canvasId }: IntegrationDocsButtonProps) => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Tooltip title={t('integration.title')}>
        <Button icon={<LuWebhook size={16} />} onClick={() => setModalOpen(true)}>
          {t('integration.title')}
        </Button>
      </Tooltip>

      {modalOpen && (
        <Suspense fallback={null}>
          <IntegrationDocsModal
            canvasId={canvasId}
            open={modalOpen}
            onClose={() => setModalOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
});

IntegrationDocsButton.displayName = 'IntegrationDocsButton';
