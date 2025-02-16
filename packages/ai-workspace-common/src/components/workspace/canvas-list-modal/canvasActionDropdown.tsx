import { useEffect, useState } from 'react';
import { Button, Dropdown, DropdownProps, MenuProps, Modal, Checkbox, CheckboxProps } from 'antd';
import {
  IconMoreHorizontal,
  IconDelete,
  IconEdit,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useDeleteCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-canvas';
import { useTranslation } from 'react-i18next';
import { CanvasRename } from '@refly-packages/ai-workspace-common/components/canvas/top-toolbar/canvas-rename';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useUpdateCanvas } from '@refly-packages/ai-workspace-common/queries';
import { IoAlertCircle } from 'react-icons/io5';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';

interface CanvasActionDropdown {
  canvasId: string;
  canvasName: string;
  btnSize?: 'small' | 'large';
  updateShowStatus?: (canvasId: string | null) => void;
  afterDelete?: () => void;
  afterRename?: (newTitle: string, canvasId: string) => void;
}

export const CanvasActionDropdown = (props: CanvasActionDropdown) => {
  const {
    canvasId,
    canvasName,
    btnSize = 'small',
    updateShowStatus,
    afterDelete,
    afterRename,
  } = props;
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();
  const { deleteCanvas } = useDeleteCanvas();
  const { mutate: updateCanvas } = useUpdateCanvas();
  const { updateCanvasTitle } = useSiderStoreShallow((state) => ({
    updateCanvasTitle: state.updateCanvasTitle,
  }));
  const { refetchUsage } = useSubscriptionUsage();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteFile, setIsDeleteFile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const onChange: CheckboxProps['onChange'] = (e) => {
    setIsDeleteFile(e.target.checked);
  };

  const handleDelete = async () => {
    if (isLoading) return;
    try {
      setIsLoading(true);
      const success = await deleteCanvas(canvasId, isDeleteFile);
      setPopupVisible(false);
      if (success) {
        setIsDeleteModalOpen(false);
        afterDelete?.();
        refetchUsage();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const items: MenuProps['items'] = [
    {
      label: (
        <div
          className="flex items-center"
          onClick={(e) => {
            e.stopPropagation();
            setIsModalOpen(true);
            setPopupVisible(false);
          }}
        >
          <IconEdit size={16} className="mr-2" />
          {t('canvas.toolbar.rename')}
        </div>
      ),
      key: 'rename',
    },
    {
      label: (
        <div
          className="flex items-center text-red-600"
          onClick={() => {
            setIsDeleteModalOpen(true);
            setPopupVisible(false);
          }}
        >
          <IconDelete size={16} className="mr-2" />
          {t('canvas.toolbar.deleteCanvas')}
        </div>
      ),
      key: 'delete',
    },
  ];

  const handleOpenChange: DropdownProps['onOpenChange'] = (open: boolean, info: any) => {
    if (info.source === 'trigger') {
      setPopupVisible(open);
    }
  };

  const handleModalOk = (newTitle: string) => {
    if (newTitle?.trim()) {
      updateCanvas({ body: { canvasId, title: newTitle } });
      updateCanvasTitle(canvasId, newTitle);
      setIsModalOpen(false);
      afterRename?.(newTitle, canvasId);
    }
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
  };

  useEffect(() => {
    if (popupVisible) {
      updateShowStatus?.(canvasId);
    } else {
      updateShowStatus?.(null);
    }
    return () => {
      setIsDeleteFile(false);
    };
  }, [popupVisible]);

  return (
    <>
      <Dropdown
        trigger={['click']}
        open={popupVisible}
        onOpenChange={handleOpenChange}
        menu={{
          items,
        }}
      >
        <Button
          size={btnSize}
          onClick={(e) => e.stopPropagation()}
          type="text"
          icon={<IconMoreHorizontal />}
        />
      </Dropdown>

      <div onClick={(e) => e.stopPropagation()}>
        <CanvasRename
          canvasId={canvasId}
          canvasTitle={canvasName}
          isModalOpen={isModalOpen}
          handleModalOk={handleModalOk}
          handleModalCancel={handleModalCancel}
        />
      </div>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <IoAlertCircle size={26} className="mr-2 text-[#faad14]" />
            {t('common.deleteConfirmMessage')}
          </div>
        }
        centered
        width={416}
        open={isDeleteModalOpen}
        onOk={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true, loading: isLoading }}
        destroyOnClose
        closeIcon={null}
        confirmLoading={isLoading}
      >
        <div className="pl-10">
          <div className="mb-2">
            {t('workspace.deleteDropdownMenu.deleteConfirmForCanvas', {
              canvas: canvasName || t('common.untitled'),
            })}
          </div>
          <Checkbox onChange={onChange} className="mb-2 text-[13px]">
            {t('canvas.toolbar.deleteCanvasFile')}
          </Checkbox>
        </div>
      </Modal>
    </>
  );
};
