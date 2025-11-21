import { memo, useState, useCallback } from 'react';
import { Button, Dropdown, DropdownProps, MenuProps, message, Tooltip } from 'antd';
import { More } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { useCanvasOperationStoreShallow } from '@refly/stores';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import './index.scss';
import { Canvas } from '@refly/openapi-schema';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';

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
  const [copyLinkLoading, setCopyLinkLoading] = useState(false);
  const [copyTemplateLinkLoading, setCopyTemplateLinkLoading] = useState(false);

  const { duplicateCanvas, loading: duplicateLoading } = useDuplicateCanvas();

  const { openRenameModal, openDeleteModal } = useCanvasOperationStoreShallow((state) => ({
    openRenameModal: state.openRenameModal,
    openDeleteModal: state.openDeleteModal,
  }));

  // Check if workflow is shared
  const isShared = workflow.shareRecord?.shareId;

  // Get workflow app info directly from canvas
  const workflowAppLink = workflow.workflowApp?.shareId
    ? getShareLink('workflowApp', workflow.workflowApp.shareId)
    : '';
  const isTemplatePublished = !!workflow.workflowApp?.shareId;

  // Handle copy link
  const handleCopyLink = useCallback(async () => {
    try {
      setCopyLinkLoading(true);
      const shareId = workflow.shareRecord?.shareId;
      if (!shareId) {
        message.error(t('workflowList.copyLinkFailed', { title: workflow.title }));
        return;
      }

      const shareLink = getShareLink('canvas', shareId);
      await navigator.clipboard.writeText(shareLink);
      message.success(t('workflowList.copyLinkSuccess'));
    } catch (error) {
      console.error('Failed to copy link:', error);
      message.error(t('workflowList.copyLinkFailed', { title: workflow.title }));
    } finally {
      setCopyLinkLoading(false);
    }
    setPopupVisible(false);
  }, [workflow, t]);

  // Handle copy template link
  const handleCopyTemplateLink = useCallback(async () => {
    try {
      setCopyTemplateLinkLoading(true);
      if (!workflowAppLink) {
        message.error(t('workflowList.templateLinkFailed', { title: workflow.title }));
        return;
      }

      await navigator.clipboard.writeText(workflowAppLink);
      message.success(t('workflowList.templateLinkCopied'));
    } catch (error) {
      console.error('Failed to copy template link:', error);
      message.error(t('workflowList.templateLinkFailed', { title: workflow.title }));
    } finally {
      setCopyTemplateLinkLoading(false);
    }
    setPopupVisible(false);
  }, [workflowAppLink, workflow.title, t]);

  const hideDropdown = useCallback(() => {
    setPopupVisible(false);
  }, [setPopupVisible]);

  const handleDuplicate = useCallback(() => {
    duplicateCanvas({
      canvasId: workflow.canvasId,
      title: workflow.title,
      isCopy: true,
      onSuccess: hideDropdown,
    });
  }, [workflow.canvasId, workflow.title, duplicateCanvas, hideDropdown]);

  const items: MenuProps['items'] = [
    {
      label: (
        <div
          className="flex items-center gap-1 w-28"
          onClick={(e) => {
            e.stopPropagation();
            openRenameModal(workflow.canvasId, workflow.title, onRenameSuccess);
            setPopupVisible(false);
          }}
        >
          {t('canvas.toolbar.rename')}
        </div>
      ),
      key: 'rename',
    },
    {
      label: (
        <div
          className="flex items-center gap-1 w-28"
          onClick={(e) => {
            e.stopPropagation();
            handleDuplicate();
          }}
        >
          {t('canvas.toolbar.duplicate')}
          <Spin spinning={duplicateLoading} size="small" className="text-refly-text-3" />
        </div>
      ),
      key: 'duplicate',
      disabled: duplicateLoading,
    },
    {
      label: (
        <Tooltip
          title={!isShared ? t('workflowList.copyLinkTooltip') : undefined}
          placement="right"
        >
          <div
            className={`flex items-center gap-1 w-28 ${!isShared ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!isShared) return;
              handleCopyLink();
            }}
          >
            <Spin spinning={copyLinkLoading} size="small" className="text-refly-text-3" />
            {t('workflowList.copyLink')}
          </div>
        </Tooltip>
      ),
      key: 'copyLink',
      disabled: !isShared || copyLinkLoading,
    },
    {
      label: (
        <Tooltip
          title={!isTemplatePublished ? t('workflowList.templateNotPublishedTooltip') : undefined}
          placement="right"
        >
          <div
            className={`flex items-center gap-1 w-28 ${!isTemplatePublished ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!isTemplatePublished) return;
              handleCopyTemplateLink();
            }}
          >
            <Spin spinning={copyTemplateLinkLoading} size="small" className="text-refly-text-3" />
            {t('workflowList.templateLink')}
          </div>
        </Tooltip>
      ),
      key: 'copyTemplateLink',
      disabled: !isTemplatePublished || copyTemplateLinkLoading,
    },
    {
      label: (
        <div
          className="flex items-center text-refly-func-danger-default gap-1 w-28"
          onClick={(e) => {
            e.stopPropagation();
            openDeleteModal(workflow.canvasId, workflow.title, onDeleteSuccess);
            setPopupVisible(false);
          }}
        >
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
