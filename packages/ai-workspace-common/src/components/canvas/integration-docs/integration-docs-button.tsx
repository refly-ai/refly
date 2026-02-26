import { memo, useState, lazy, Suspense } from 'react';
import { Button, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { cn } from '@refly/utils/cn';
import { LuPuzzle } from 'react-icons/lu';

const IntegrationDocsModal = lazy(() =>
  import('./integration-docs-modal').then((m) => ({
    default: m.IntegrationDocsModal,
  })),
);

interface IntegrationDocsButtonProps {
  canvasId: string;
  buttonClassName?: string;
  buttonType?: 'default' | 'primary' | 'dashed' | 'link' | 'text';
}

export const IntegrationDocsButton = memo(
  ({ canvasId, buttonClassName, buttonType }: IntegrationDocsButtonProps) => {
    const { t } = useTranslation();
    const [modalOpen, setModalOpen] = useState(false);

    return (
      <>
        <Tooltip title={t('integration.title')}>
          <Button
            onClick={() => setModalOpen(true)}
            type={buttonType}
            className={cn('integration-docs-button', buttonClassName)}
          >
            <LuPuzzle size={16} className="integration-docs-button-icon" />
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
  },
);

IntegrationDocsButton.displayName = 'IntegrationDocsButton';
