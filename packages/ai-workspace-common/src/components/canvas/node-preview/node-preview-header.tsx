import { FC, useCallback, useMemo, useState, memo } from 'react';
import { Button, Dropdown, Modal, message } from 'antd';
import type { MenuProps } from 'antd';
import { TFunction } from 'i18next';
import {
  Maximize2,
  Minimize2,
  MoreHorizontal,
  X,
  FilePlus,
  Trash2,
  Target,
  GripVertical,
} from 'lucide-react';
import { CanvasNode } from '@refly/canvas-common';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import {
  IconPin,
  IconUnpin,
  IconDeleteFile,
  IconDownloadFile,
  IconWideMode,
  IconExitWideMode,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useTranslation } from 'react-i18next';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-preview-control';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useDeleteDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-document';
import { useDeleteResource } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-resource';
import { useDownloadFile } from '@refly-packages/ai-workspace-common/hooks/use-download-file';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useUpdateNodeTitle } from '@refly-packages/ai-workspace-common/hooks/use-update-node-title';
import { NodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-header';
import { SkillResponseNodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/skill-response-node-header';
import { useExportDocument } from '@refly-packages/ai-workspace-common/hooks/use-export-document';
import { useDebouncedCallback } from 'use-debounce';
import { useCanvasStoreShallow } from '@refly/stores';
import { CanvasNodeType } from '@refly/openapi-schema';

// Get node title based on node type and metadata
const getNodeFixedTitle = (node: CanvasNode<any>, t: TFunction) => {
  switch (node.type) {
    case 'document':
      return t('canvas.nodeTypes.document');
    case 'resource':
      return t(`resourceType.${node.data?.metadata?.resourceType || 'weblink'}`);
    case 'skillResponse':
      return t('canvas.nodeTypes.skillResponse');
    case 'toolResponse':
      return t('canvas.nodeTypes.toolResponse');
    case 'skill':
      return t('canvas.nodeTypes.skill');
    case 'memo':
      return t('canvas.nodeTypes.memo');
    case 'codeArtifact':
      return t('canvas.nodeTypes.codeArtifact');
    case 'website':
      return t('canvas.nodeTypes.website');
    default:
      return 'Unknown Node';
  }
};

const getNodeTitle = (node: CanvasNode<any>, t: TFunction) => {
  switch (node.type) {
    case 'document':
      return t('canvas.nodeTypes.document');
    case 'toolResponse':
      return t('canvas.nodeTypes.toolResponse');
    case 'skill':
      return t('canvas.nodeTypes.skill');
    case 'memo':
      return t('canvas.nodeTypes.memo');
    default:
      return node.data?.title;
  }
};

interface NodePreviewHeaderProps {
  node: CanvasNode<any>;
  onClose: () => void;
  onMaximize?: () => void;
  onWideMode?: () => void;
  isMaximized?: boolean;
  isWideMode?: boolean;
  dragHandleProps?: any;
  isDragging?: boolean;
}

export const NodePreviewHeader: FC<NodePreviewHeaderProps> = memo(
  ({
    node,
    onClose,
    onMaximize,
    onWideMode,
    isMaximized = false,
    isWideMode = false,
    dragHandleProps,
    isDragging = false,
  }) => {
    const { t } = useTranslation();
    const { canvasId, readonly } = useCanvasContext();

    // Get the latest node data from the store
    const nodeFromStore = useCanvasStoreShallow((state) => {
      const nodePreviews = state.config[canvasId]?.nodePreviews || [];
      return nodePreviews.find((p) => p?.id === node.id);
    });

    const currentNode = nodeFromStore || node;

    const { addToContext } = useAddToContext();

    const { deleteNode } = useDeleteNode();
    const { deleteResource } = useDeleteResource();
    const { deleteDocument } = useDeleteDocument();
    const { downloadFile } = useDownloadFile();
    const { exportDocument } = useExportDocument();
    const [isExporting, setIsExporting] = useState(false);
    const [_popupVisible, setPopupVisible] = useState(false);

    const handleDeleteFile = useCallback(() => {
      Modal.confirm({
        centered: true,
        title: t('common.deleteConfirmMessage'),
        content: t(`canvas.nodeActions.${currentNode.type}DeleteConfirm`, {
          title: currentNode.data?.title || t('common.untitled'),
        }),
        okText: t('common.delete'),
        cancelText: t('common.cancel'),
        okButtonProps: { danger: true },
        cancelButtonProps: { className: 'hover:!border-[#0E9F77] hover:!text-[#0E9F77] ' },
        onOk: () => {
          currentNode.type === 'document'
            ? deleteDocument(currentNode.data?.entityId)
            : deleteResource(currentNode.data?.entityId);
          deleteNode(currentNode);
        },
      });
    }, [currentNode, deleteResource, deleteDocument, deleteNode, t]);

    const handleAddToContext = useCallback(() => {
      addToContext({
        type: currentNode.type as CanvasNodeType,
        title: currentNode.data?.title,
        entityId: currentNode.data?.entityId,
        metadata: currentNode.data?.metadata,
      });
    }, [currentNode, addToContext]);

    const handleExportDocument = useDebouncedCallback(async (type: 'markdown' | 'docx' | 'pdf') => {
      if (isExporting) return;

      try {
        setIsExporting(true);
        let mimeType = '';
        let extension = '';

        // 添加加载提示
        const loadingMessage = message.loading({
          content: t('workspace.exporting'),
          duration: 0,
        });
        const content = await exportDocument(currentNode.data?.entityId, type);
        // 关闭加载提示
        loadingMessage();

        switch (type) {
          case 'markdown':
            mimeType = 'text/markdown';
            extension = 'md';
            break;
          case 'docx':
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            extension = 'docx';
            break;
          case 'pdf':
            mimeType = 'application/pdf';
            extension = 'pdf';
            break;
        }

        // 创建Blob对象
        const blob = new Blob([content], { type: mimeType });
        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentNode.data?.title || t('common.untitled')}.${extension}`;
        document.body.appendChild(a);
        a.click();

        // 清理
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        message.success(t('workspace.exportSuccess'));
      } catch (error) {
        console.error('Export error:', error);
        message.error(t('workspace.exportFailed'));
      } finally {
        setIsExporting(false);
        setPopupVisible(false);
      }
    }, 300);

    const updateNodePreviewTitle = useUpdateNodeTitle();

    const { pinNode, unpinNode, isNodePinned } = useNodePreviewControl({ canvasId });
    const isPinned = isNodePinned(currentNode.id);

    const handlePin = useCallback(() => {
      if (isPinned) {
        unpinNode(currentNode);
      } else {
        pinNode(currentNode);
      }
    }, [isPinned, pinNode, unpinNode, currentNode]);

    const { setNodeCenter } = useNodePosition();

    const canDownload = useMemo(() => {
      const metadata = currentNode.data?.metadata || {};
      const { resourceType } = metadata;
      return currentNode.type === 'resource' && resourceType === 'file';
    }, [currentNode]);

    const handleDownload = useCallback(async () => {
      const { data } = await getClient().listResources({
        query: {
          resourceId: currentNode.data?.entityId,
        },
      });
      if (data?.data?.[0]) {
        downloadFile(data.data[0]);
      }
    }, [currentNode, downloadFile]);

    const centerNodeConfig = {
      key: 'centerNode',
      label: (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Target className="w-4 h-4 flex-shrink-0" />
          {t('canvas.nodeActions.centerNode')}
        </div>
      ),
      onClick: () => setNodeCenter(currentNode.id, true),
    };

    // Define dropdown menu items
    const menuItems: MenuProps['items'] = useMemo(() => {
      // If readonly is true, only show centerNode option
      if (readonly) {
        return [centerNodeConfig];
      }

      // Otherwise show all options
      return [
        centerNodeConfig,
        {
          key: 'addToContext',
          label: (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <FilePlus className="w-4 h-4 flex-shrink-0" />
              {t('canvas.nodeActions.addToContext')}
            </div>
          ),
          onClick: handleAddToContext,
        },
        ...(canDownload
          ? [
              {
                key: 'downloadFile',
                label: (
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <IconDownloadFile className="w-4 h-4 flex-shrink-0" />
                    {t('canvas.nodeActions.downloadFile')}
                  </div>
                ),
                onClick: handleDownload,
              },
            ]
          : []),
        ...(currentNode.type === 'document'
          ? [
              {
                key: 'exportDocument',
                label: (
                  <div className="flex items-center flex-grow">
                    <IconDownloadFile size={16} className="mr-2" />
                    {t('workspace.exportAs')}
                  </div>
                ),
                children: [
                  {
                    key: 'exportDocumentToMarkdown',
                    label: t('workspace.exportDocumentToMarkdown'),
                    onClick: () => handleExportDocument('markdown'),
                  },
                  {
                    key: 'exportDocumentToDocx',
                    label: t('workspace.exportDocumentToDocx'),
                    onClick: () => handleExportDocument('docx'),
                  },
                  {
                    key: 'exportDocumentToPdf',
                    label: t('workspace.exportDocumentToPdf'),
                    onClick: () => handleExportDocument('pdf'),
                  },
                ],
              },
            ]
          : []),
        {
          type: 'divider',
        },
        {
          key: 'delete',
          label: (
            <div className="flex items-center gap-2 text-red-600 whitespace-nowrap">
              <Trash2 className="w-4 h-4 flex-shrink-0" />
              {t('canvas.nodeActions.delete')}
            </div>
          ),
          onClick: () => deleteNode(currentNode),
          className: 'hover:bg-red-50',
        },
        ...(currentNode.type === 'document'
          ? [
              {
                key: 'deleteFile',
                label: (
                  <div className="flex items-center gap-2 text-red-600 whitespace-nowrap">
                    <IconDeleteFile className="w-4 h-4 flex-shrink-0" />
                    <span>{t('canvas.nodeActions.deleteDocument')}</span>
                  </div>
                ),
                onClick: () => {
                  handleDeleteFile();
                },
                className: 'hover:bg-red-50',
              },
            ]
          : []),
        currentNode.type === 'resource' && {
          key: 'deleteFile',
          label: (
            <div className="flex items-center gap-2 text-red-600 whitespace-nowrap">
              <IconDeleteFile className="w-4 h-4 flex-shrink-0" />
              <span>{t('canvas.nodeActions.deleteResource')}</span>
            </div>
          ),
          onClick: () => {
            handleDeleteFile();
          },
          className: 'hover:bg-red-50',
        },
      ];
    }, [
      readonly,
      t,
      setNodeCenter,
      currentNode,
      handleAddToContext,
      canDownload,
      handleDownload,
      deleteNode,
      handleDeleteFile,
    ]);

    const handleTitleUpdate = (newTitle: string) => {
      if (newTitle === currentNode.data?.title) {
        return;
      }
      updateNodePreviewTitle(
        newTitle,
        currentNode.data.entityId,
        currentNode.id,
        currentNode.type as CanvasNodeType,
      );
    };

    return (
      <div
        className={`flex justify-between items-center py-2 px-4 border-b border-[#EAECF0] ${isDragging ? 'bg-gray-50' : ''} relative`}
      >
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 -translate-y-3 w-10 h-5 flex items-center justify-center cursor-move text-gray-300 hover:text-gray-500 bg-white border border-gray-100 rounded-b-md z-10 transition-colors duration-150 opacity-0 hover:opacity-100"
          >
            <GripVertical className="w-3 h-3 rotate-90" />
          </div>
        )}
        {/* Left: Icon and Title */}
        <div className="flex items-center gap-2 flex-grow overflow-hidden">
          <div className="flex-grow overflow-hidden">
            {currentNode.type === 'skillResponse' ? (
              <SkillResponseNodeHeader
                nodeId={currentNode.id}
                entityId={currentNode.data?.entityId}
                title={
                  currentNode.data?.editedTitle ||
                  currentNode.data?.title ||
                  getNodeTitle(currentNode, t)
                }
                readonly={readonly}
                source="preview"
                className="!mb-0"
              />
            ) : (
              <NodeHeader
                nodeType={currentNode.type as CanvasNodeType}
                title={
                  currentNode.data?.editedTitle ||
                  currentNode.data?.title ||
                  getNodeTitle(currentNode, t)
                }
                fixedTitle={getNodeFixedTitle(currentNode, t)}
                resourceType={currentNode.data?.metadata?.resourceType}
                resourceMeta={currentNode.data?.metadata?.resourceMeta}
                source="preview"
                className="!mb-0"
                canEdit={currentNode.type !== 'document' && !readonly}
                disabled={readonly}
                updateTitle={handleTitleUpdate}
              />
            )}
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onWideMode && (
            <Button
              type="text"
              className={`p-1.5 hover:bg-gray-100 ${isWideMode ? 'text-primary-600' : 'text-gray-500'}`}
              onClick={() => onWideMode()}
            >
              {isWideMode ? (
                <IconExitWideMode className="w-4 h-4" />
              ) : (
                <IconWideMode className="w-4 h-4" />
              )}
            </Button>
          )}
          {onMaximize && (
            <Button
              type="text"
              className={`p-1.5 hover:bg-gray-100 ${isMaximized ? 'text-primary-600' : 'text-gray-500'}`}
              onClick={() => onMaximize()}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          )}
          <Button
            type="text"
            className={`p-1.5 hover:bg-gray-100 ${isPinned ? 'text-primary-600' : 'text-gray-500'}`}
            onClick={() => handlePin()}
          >
            {isPinned ? <IconUnpin className="w-4 h-4" /> : <IconPin className="w-4 h-4" />}
          </Button>
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            placement="bottomRight"
            overlayClassName="min-w-[160px] w-max"
            getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
            popupRender={(menu) => (
              <div className="min-w-[160px] bg-white rounded-lg border-[0.5px] border-[rgba(0,0,0,0.03)] shadow-lg">
                {menu}
              </div>
            )}
          >
            <Button type="text" className="p-1.5 hover:bg-gray-100 text-gray-500">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </Dropdown>
          <Button type="text" className="p-1.5 hover:bg-gray-100 text-gray-500" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  },
);

NodePreviewHeader.displayName = 'NodePreviewHeader';
