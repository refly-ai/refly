import { useState } from 'react';
import { RiDeleteBinLine, RiMoreFill } from 'react-icons/ri';
import { TbEdit } from 'react-icons/tb';
import { Dropdown, Menu, Button, Popconfirm, Message } from '@arco-design/web-react';

import { Canvas, Project, Resource, BindProjectResourceRequest } from '@refly/openapi-schema';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

import { useTranslation } from 'react-i18next';
import { useImportProjectModal } from '@refly-packages/ai-workspace-common/stores/import-project-modal';
import { IconCopy } from '@arco-design/web-react/icon';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { useHandleRecents } from '@refly-packages/ai-workspace-common/hooks/use-handle-rencents';
import { useProjectTabs } from '@refly-packages/ai-workspace-common/hooks/use-project-tabs';
import { useEditorStoreShallow } from '@refly-packages/ai-workspace-common/stores/editor';
const iconStyle = {
  marginRight: 8,
  fontSize: 16,
  transform: 'translateY(3px)',
};

type positionType = 'left' | 'tr' | 'br' | 'tl' | 'bl' | 'top' | 'bottom' | 'right' | 'lb' | 'rb' | 'lt' | 'rt';

interface DropListProps {
  type: string;
  canCopy?: boolean;
  position?: positionType;
  handleCancel: (e: any) => void;
  handleDeleteClick: (e: any) => Promise<void>;
  handlEditProject?: (e: any) => void;
  getPopupContainer?: () => HTMLElement;
}

const DropList = (props: DropListProps) => {
  const { handleCancel, handleDeleteClick, handlEditProject, type, getPopupContainer, position, canCopy } = props;
  const currentCanvas = useCanvasStoreShallow((state) => state.currentCanvas);
  const editorData = useEditorStoreShallow((state) => state.editorMap[currentCanvas?.canvasId]);

  const { t } = useTranslation();

  return (
    <Menu onClick={(e) => e.stopPropagation()}>
      {type === 'project' && (
        <Menu.Item key="edit">
          <div onClick={(e) => handlEditProject(e)}>
            <TbEdit style={iconStyle} />
            {t('workspace.deleteDropdownMenu.edit')}
          </div>
        </Menu.Item>
      )}

      {canCopy && (
        <Menu.Item key="copy">
          <div
            onClick={(e) => {
              e.stopPropagation();
              const editor = editorData?.instance;
              if (editor) {
                const markdown = editor.storage.markdown.getMarkdown();
                copyToClipboard(markdown);
                Message.success({ content: t('contentDetail.item.copySuccess') });
              }
            }}
          >
            <IconCopy style={iconStyle} />
            {t('contentDetail.item.copyContent')}
          </div>
        </Menu.Item>
      )}

      <Menu.Item key="delete">
        <Popconfirm
          focusLock
          getPopupContainer={getPopupContainer}
          title={t(`common.deleteConfirmMessage`)}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          position={position || 'br'}
          onOk={handleDeleteClick}
          onCancel={handleCancel}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <RiDeleteBinLine style={iconStyle} />
            {t('workspace.deleteDropdownMenu.delete')}
          </div>
        </Popconfirm>
      </Menu.Item>
    </Menu>
  );
};

// Base interface for common props
interface BaseDropdownMenuProps {
  postDeleteList?: (canvas: Canvas | Project | Resource | BindProjectResourceRequest[]) => void;
  getPopupContainer?: () => HTMLElement;
  deleteConfirmPosition?: positionType;
  canCopy?: boolean;
}

type DeleteDropdownMenuProps =
  | (BaseDropdownMenuProps & {
      type: 'canvas';
      data: Canvas;
    })
  | (BaseDropdownMenuProps & {
      type: 'project';
      data: Project;
    })
  | (BaseDropdownMenuProps & {
      type: 'resource';
      data: Resource;
    })
  | (BaseDropdownMenuProps & {
      type: 'resourceCollection';
      data: BindProjectResourceRequest[];
    });

export const DeleteDropdownMenu = (props: DeleteDropdownMenuProps) => {
  const { type, data, postDeleteList, getPopupContainer, deleteConfirmPosition, canCopy } = props;
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();

  const importProjectModal = useImportProjectModal();
  const { deleteRecentProject } = useHandleRecents();
  const { handleDeleteTab } = useProjectTabs();

  const handleDeleteClick = async (e: MouseEvent) => {
    e.stopPropagation();
    let resultError: unknown;
    if (type === 'canvas') {
      const { error } = await getClient().deleteCanvas({ body: { canvasId: data.canvasId } });
      resultError = error;
      if (!resultError) {
        handleDeleteTab(data.projectId, data.canvasId);
      }
    }
    if (type === 'project') {
      const { error } = await getClient().deleteProject({ body: { projectId: data.projectId } });
      resultError = error;
      if (!resultError) {
        deleteRecentProject(data.projectId);
      }
    }
    if (type === 'resource') {
      const { error } = await getClient().deleteResource({ body: { resourceId: data.resourceId } });
      resultError = error;
    }
    if (type === 'resourceCollection') {
      const { error } = await getClient().bindProjectResources({ body: data });
      resultError = error;
    }

    setPopupVisible(false);

    if (resultError) {
      Message.error({ content: t('workspace.deleteDropdownMenu.failed') });
    } else {
      Message.success({ content: t('workspace.deleteDropdownMenu.successful') });
    }

    if (postDeleteList) {
      postDeleteList(data);
    }
  };

  const handleCancel = (e: MouseEvent) => {
    e.stopPropagation();
    setPopupVisible(false);
  };

  const handlEditProject = (e: MouseEvent) => {
    e.stopPropagation();
    importProjectModal.setShowNewProjectModal(true);
    importProjectModal.setEditProject(data as Project);
  };

  const handleIconClick = (e) => {
    e.stopPropagation();
    setPopupVisible(!popupVisible);
  };

  const droplist = DropList({
    canCopy,
    type,
    position: deleteConfirmPosition,
    handleCancel,
    handleDeleteClick,
    handlEditProject,
    getPopupContainer,
  });

  return (
    <Dropdown
      position="br"
      popupVisible={popupVisible}
      droplist={droplist}
      triggerProps={{ onClickOutside: () => setPopupVisible(false) }}
      getPopupContainer={getPopupContainer}
    >
      <Button
        icon={<RiMoreFill style={{ fontSize: 16 }} />}
        type="text"
        onClick={(e) => handleIconClick(e)}
        className="text-gray-500 delete-button"
      ></Button>
    </Dropdown>
  );
};
