import { memo, useState } from 'react';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCanvasOperationStoreShallow } from '@refly/stores';
import { useDeleteCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-canvas';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';

export const CanvasDeleteModal = memo(() => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const { canvasId, canvasTitle, modalVisible, modalType, reset, triggerDeleteSuccess } =
    useCanvasOperationStoreShallow((state) => ({
      canvasId: state.canvasId,
      canvasTitle: state.canvasTitle,
      modalVisible: state.modalVisible,
      modalType: state.modalType,
      reset: state.reset,
      triggerDeleteSuccess: state.triggerDeleteSuccess,
    }));
  const { deleteCanvas } = useDeleteCanvas();
  const { refetchUsage } = useSubscriptionUsage();

  const handleDelete = async () => {
    setIsLoading(true);
    const success = await deleteCanvas(canvasId, true);
    setIsLoading(false);

    if (success) {
      // Trigger delete success event with canvas data
      triggerDeleteSuccess({
        canvasId,
        title: canvasTitle,
      } as any);

      reset();
      refetchUsage();
    }
  };

  return (
    <Modal
      title={t('common.deleteConfirmMessage')}
      centered
      width={416}
      open={modalVisible && modalType === 'delete'}
      onOk={handleDelete}
      onCancel={() => reset()}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      okButtonProps={{ loading: isLoading }}
      destroyOnHidden
      closeIcon={null}
      confirmLoading={isLoading}
    >
      <div>
        <div className="mb-2">
          {t('workspace.deleteDropdownMenu.deleteConfirmForCanvas', {
            canvas: canvasTitle || t('common.untitled'),
          })}
        </div>
      </div>
    </Modal>
  );
});

CanvasDeleteModal.displayName = 'CanvasDeleteModal';
