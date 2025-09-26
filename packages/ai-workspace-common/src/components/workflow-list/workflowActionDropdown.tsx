import { memo, useState } from 'react';
import { Button, Dropdown, DropdownProps, MenuProps } from 'antd';
import { More, Delete, Copy, Edit } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { useCanvasOperationStoreShallow } from '@refly/stores';
import './index.scss';
import { Canvas } from '@refly/openapi-schema';

interface WorkflowActionDropdown {
  workflow: Canvas;
  children?: React.ReactNode;
  onRenameSuccess?: (workflow: Canvas) => void;
  onDeleteSuccess?: (workflow: Canvas) => void;
}

export const WorkflowActionDropdown = memo((props: WorkflowActionDropdown) => {
  const { workflow, children, onRenameSuccess, onDeleteSuccess } = props;
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);

  const { openRenameModal, openDeleteModal, openDuplicateModal } = useCanvasOperationStoreShallow(
    (state) => ({
      openRenameModal: state.openRenameModal,
      openDeleteModal: state.openDeleteModal,
      openDuplicateModal: state.openDuplicateModal,
    }),
  );

  const items: MenuProps['items'] = [
    {
      label: (
        <div
          className="flex items-center gap-1"
          onClick={(e) => {
            e.stopPropagation();
            openRenameModal(workflow.canvasId, workflow.title, onRenameSuccess);
            setPopupVisible(false);
          }}
        >
          <Edit size={18} />
          {t('canvas.toolbar.rename')}
        </div>
      ),
      key: 'rename',
    },
    {
      label: (
        <div
          className="flex items-center gap-1"
          onClick={(e) => {
            e.stopPropagation();
            openDuplicateModal(workflow.canvasId, workflow.title);
            setPopupVisible(false);
          }}
        >
          <Copy size={18} />
          {t('canvas.toolbar.duplicate')}
        </div>
      ),
      key: 'duplicate',
    },

    {
      label: (
        <div
          className="flex items-center text-refly-func-danger-default gap-1"
          onClick={(e) => {
            e.stopPropagation();
            openDeleteModal(workflow.canvasId, workflow.title, onDeleteSuccess);
            setPopupVisible(false);
          }}
        >
          <Delete size={18} />
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

  return (
    <Dropdown
      overlayClassName="canvas-action-dropdown"
      trigger={['click']}
      open={popupVisible}
      onOpenChange={handleOpenChange}
      menu={{
        items,
      }}
    >
      {children ? (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      ) : (
        <Button
          size="small"
          onClick={(e) => e.stopPropagation()}
          type="text"
          icon={<More size={16} />}
        />
      )}
    </Dropdown>
  );
});

WorkflowActionDropdown.displayName = 'WorkflowActionDropdown';
