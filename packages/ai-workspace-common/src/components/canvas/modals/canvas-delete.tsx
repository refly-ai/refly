import { memo, useState } from 'react';
import { Checkbox, CheckboxProps, Modal } from 'antd';
import { IoAlertCircle } from 'react-icons/io5';
import { useTranslation } from 'react-i18next';
import { useCanvasOperationStoreShallow } from '@refly/stores';
import { useDeleteCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-canvas';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';

export const CanvasDeleteModal = memo(() => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteFile, setIsDeleteFile] = useState(false);
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
  const { getSourceList } = useHandleSiderData();
  const { projectId } = useGetProjectCanvasId();

  const onChange: CheckboxProps['onChange'] = (e) => {
    setIsDeleteFile(e.target.checked);
  };

  const handleDelete = async () => {
    setIsLoading(true);
    const success = await deleteCanvas(canvasId, isDeleteFile);
    setIsLoading(false);

    if (success) {
      // Trigger delete success event with canvas data
      triggerDeleteSuccess({
        canvasId,
        title: canvasTitle,
      } as any);

      reset();
      refetchUsage();
      if (isDeleteFile && projectId) {
        setTimeout(() => {
          getSourceList();
        }, 1000);
      }
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <IoAlertCircle size={26} className="mr-2 text-[#faad14]" />
          {t('common.deleteConfirmMessage')}
        </div>
      }
      centered
      width={416}
      open={modalVisible && modalType === 'delete'}
      onOk={handleDelete}
      onCancel={() => reset()}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      okButtonProps={{ danger: true, loading: isLoading }}
      destroyOnHidden
      closeIcon={null}
      confirmLoading={isLoading}
    >
      <div className="pl-10">
        <div className="mb-2">
          {t('workspace.deleteDropdownMenu.deleteConfirmForCanvas', {
            canvas: canvasTitle || t('common.untitled'),
          })}
        </div>
        <Checkbox onChange={onChange} className="mb-2 text-[13px]">
          {t('canvas.toolbar.deleteCanvasFile')}
        </Checkbox>
      </div>
    </Modal>
  );
});

CanvasDeleteModal.displayName = 'CanvasDeleteModal';
