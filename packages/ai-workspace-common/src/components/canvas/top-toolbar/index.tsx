import React, { useEffect } from 'react';
import {
  Button,
  Divider,
  Tooltip,
  Avatar,
  Dropdown,
  MenuProps,
  Popconfirm,
  DropdownProps,
  Input,
  Modal,
  Skeleton,
} from 'antd';
import { useSiderStore, useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { useTranslation } from 'react-i18next';
import { FC, useState } from 'react';

import { PiShootingStar } from 'react-icons/pi';
import { MdOutlineHideImage } from 'react-icons/md';
import { AiOutlineMenuFold, AiOutlineMenuUnfold } from 'react-icons/ai';
import {
  IconCanvas,
  IconEdit,
  IconDelete,
  IconMoreHorizontal,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import SiderPopover from '../../../../../../apps/web/src/pages/sider-popover';
import { BsLayoutWtf } from 'react-icons/bs';
import { useCanvasControl } from '@refly-packages/ai-workspace-common/hooks/use-canvas-control';
import Logo from '../../../../../../apps/web/src/assets/logo.svg';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useDeleteCanvas } from '@refly-packages/ai-workspace-common/hooks/use-delete-canvas';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { LuCheck, LuX } from 'react-icons/lu';
import { useUpdateCanvas } from '@refly-packages/ai-workspace-common/queries/queries';

interface TopToolbarProps {
  canvasId: string;
}

export const TopToolbar: FC<TopToolbarProps> = ({ canvasId }) => {
  const { t } = useTranslation();
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  const { provider } = useCanvasContext();
  const ydoc = provider?.document;
  const canvasTitle = ydoc?.getText('title');

  // const { onLayout } = useCanvasControl();
  const { showPreview, setShowPreview } = useCanvasStoreShallow((state) => ({
    showPreview: state.showPreview,
    setShowPreview: state.setShowPreview,
  }));
  const { deleteCanvas } = useDeleteCanvas();

  const [editedTitle, setEditedTitle] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleEditClick = () => {
    setEditedTitle(canvasTitle?.toJSON() ?? '');
    setIsModalOpen(true);
  };

  const { mutate, status } = useUpdateCanvas();
  const setCanvasList = useSiderStoreShallow((state) => state.setCanvasList);

  useEffect(() => {
    if (provider?.status === 'connected') {
      const { canvasList } = useSiderStore.getState();
      setCanvasList(
        canvasList.map((canvas) => (canvas.id === canvasId ? { ...canvas, name: canvasTitle?.toJSON() } : canvas)),
      );
    }
  }, [canvasId, provider?.status, canvasTitle?.toJSON()]);

  const handleModalOk = () => {
    if (ydoc && editedTitle?.trim()) {
      ydoc.transact(() => {
        canvasTitle?.delete(0, canvasTitle?.length ?? 0);
        canvasTitle?.insert(0, editedTitle);
      });
      mutate({ body: { canvasId, title: editedTitle } }, { onSuccess: () => setIsModalOpen(false) });
    }
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
  };

  const ActionDropdown = () => {
    const [popupVisible, setPopupVisible] = useState(false);

    const handleDelete = async () => {
      await deleteCanvas(canvasId);
    };

    const items: MenuProps['items'] = [
      {
        label: (
          <Popconfirm
            title={t('workspace.deleteDropdownMenu.deleteConfirmForCanvas')}
            onConfirm={handleDelete}
            onCancel={() => setPopupVisible(false)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <div className="flex items-center text-red-600">
              <IconDelete size={16} className="mr-2" />
              {t('workspace.deleteDropdownMenu.delete')}
            </div>
          </Popconfirm>
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
        trigger={['click']}
        open={popupVisible}
        onOpenChange={handleOpenChange}
        menu={{
          items,
        }}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center h-9 bg-[#ffffff] rounded-lg px-2 border border-solid border-1 border-[#EAECF0] box-shadow-[0px_2px_6px_0px_rgba(0,0,0,0.1)]">
            <Button type="text" icon={<IconMoreHorizontal />} className="w-8 h-6 flex items-center justify-center" />
          </div>
        </div>
      </Dropdown>
    );
  };

  return (
    <div
      className={`absolute h-16 top-0 left-0 right-0  box-border flex justify-between items-center py-2 px-4 pr-0 z-10 bg-transparent ${
        collapse ? 'w-[calc(100vw-12px)]' : 'w-[calc(100vw-232px)]'
      }`}
    >
      <div className="flex items-center">
        {collapse ? (
          <>
            <SiderPopover>
              <Button
                type="text"
                icon={<AiOutlineMenuUnfold size={20} />}
                onClick={() => {
                  setCollapse(!collapse);
                }}
              />
            </SiderPopover>
            <Divider type="vertical" className="pr-[4px]" />
            <div className="flex items-center justify-center">
              <Avatar size={32} src={Logo} />
              <span className="text-sm font-bold ml-2">Refly</span>
            </div>
          </>
        ) : (
          <Button
            type="text"
            icon={<AiOutlineMenuFold size={20} />}
            onClick={() => {
              setCollapse(!collapse);
            }}
          />
        )}
        <Divider type="vertical" className="pr-[4px]" />
        <div
          className="group flex items-center gap-2 text-sm font-bold text-gray-500 cursor-pointer hover:text-gray-700"
          onClick={handleEditClick}
        >
          <IconCanvas />
          {provider.status === 'connecting' ? (
            <Skeleton className="w-28" active paragraph={false} />
          ) : (
            canvasTitle?.toJSON() || t('common.untitled')
          )}
          <IconEdit className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <Modal
          centered
          title={t('canvas.toolbar.editTitle')}
          open={isModalOpen}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          confirmLoading={status === 'pending'}
          onOk={handleModalOk}
          onCancel={handleModalCancel}
          okButtonProps={{ disabled: !editedTitle?.trim() }}
        >
          <Input
            autoFocus
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            placeholder={t('canvas.toolbar.editTitlePlaceholder')}
            onPressEnter={handleModalOk}
          />
        </Modal>
        {/* <Divider type="vertical" className="pr-[4px]" />
        <Button type="text" icon={<BsLayoutWtf />} onClick={() => onLayout('LR')}>
          Layout
        </Button> */}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center h-9 bg-[#ffffff] rounded-lg px-2 border border-solid border-1 border-[#EAECF0] box-shadow-[0px_2px_6px_0px_rgba(0,0,0,0.1)]">
          <Button type="text" icon={<PiShootingStar />} className="w-8 h-6 flex items-center justify-center" />
          <Divider type="vertical" />
          <Tooltip title={t(`canvas.toolbar.${showPreview ? 'hidePreview' : 'showPreview'}`)}>
            <Button
              type="text"
              icon={<MdOutlineHideImage style={{ color: showPreview ? '#9CA3AF' : '#000' }} />}
              onClick={() => setShowPreview(!showPreview)}
              className="w-8 h-6 flex items-center justify-center"
            />
          </Tooltip>
        </div>

        <ActionDropdown />
      </div>
    </div>
  );
};
