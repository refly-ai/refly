import { FC, useCallback, useMemo, useState, memo } from 'react';
import { Button, Dropdown, Modal, message } from 'antd';
import type { MenuProps } from 'antd';
import { TFunction } from 'i18next';
import {
  FileText,
  Sparkles,
  Wrench,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  X,
  Cpu,
  Code2,
  Globe,
  FilePlus,
  Trash2,
  Target,
  GripVertical,
} from 'lucide-react';
import { NODE_COLORS } from '../nodes/shared/colors';
import { CanvasNode } from '@refly/canvas-common';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import {
  IconDocument,
  IconPin,
  IconResponse,
  IconUnpin,
  IconDeleteFile,
  IconDownloadFile,
  IconCodeArtifact,
  IconWebsite,
  IconWideMode,
  IconResource,
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
import { NodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/skill-response';
import { NodeHeader as CommonNodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-header';
import { useExportDocument } from '@refly-packages/ai-workspace-common/hooks/use-export-document';
import { useDebouncedCallback } from 'use-debounce';

// Get icon component based on node type and metadata
const getNodeIcon = (node: CanvasNode<any>) => {
  switch (node.type) {
    case 'document':
      return IconDocument;
    case 'resource':
      return IconResource;
    case 'skillResponse':
      return IconResponse;
    case 'toolResponse':
      return IconResponse;
    case 'codeArtifact':
      return IconCodeArtifact;
    case 'website':
      return IconWebsite;
    case 'skill':
      switch (node.data?.metadata?.skillType) {
        case 'prompt':
        case 'prompt-struct':
          return Cpu;
        case 'code':
          return Code2;
        case 'http':
          return Globe;
        default:
          return Sparkles;
      }
    case 'tool':
      return Wrench;
    default:
      return FileText;
  }
};

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
    const IconComponent = getNodeIcon(node);
    const nodeColor = NODE_COLORS[node.type];

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
        content: t(`canvas.nodeActions.${node.type}DeleteConfirm`, {
          title: node.data?.title || t('common.untitled'),
        }),
        okText: t('common.delete'),
        cancelText: t('common.cancel'),
        okButtonProps: { danger: true },
        cancelButtonProps: { className: 'hover:!border-[#00968F] hover:!text-[#00968F] ' },
        onOk: () => {
          node.type === 'document'
            ? deleteDocument(node.data?.entityId)
            : deleteResource(node.data?.entityId);
          deleteNode(node);
        },
      });
    }, [node, deleteResource, deleteDocument, deleteNode, t]);

    const handleAddToContext = useCallback(() => {
      addToContext({
        type: node.type,
        title: node.data?.title,
        entityId: node.data?.entityId,
        metadata: node.data?.metadata,
      });
    }, [node, addToContext]);

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
        const content = await exportDocument(node.data?.entityId, type);
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
        a.download = `${node.data?.title || t('common.untitled')}.${extension}`;
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

    const { canvasId, readonly } = useCanvasContext();
    const updateNodePreviewTitle = useUpdateNodeTitle();

    const { pinNode, unpinNode, isNodePinned } = useNodePreviewControl({ canvasId });
    const isPinned = isNodePinned(node.id);

    const handlePin = useCallback(() => {
      if (isPinned) {
        unpinNode(node);
      } else {
        pinNode(node);
      }
    }, [isPinned, pinNode, unpinNode, node]);

    const { setNodeCenter } = useNodePosition();

    const canDownload = useMemo(() => {
      const metadata = node.data?.metadata || {};
      const { resourceType } = metadata;
      return node.type === 'resource' && resourceType === 'file';
    }, [node]);

    const handleDownload = useCallback(async () => {
      const { data } = await getClient().listResources({
        query: {
          resourceId: node.data?.entityId,
        },
      });
      if (data.data?.[0]) {
        downloadFile(data.data[0]);
      }
    }, [node, downloadFile]);

    const centerNodeConfig = {
      key: 'centerNode',
      label: (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Target className="w-4 h-4 flex-shrink-0" />
          {t('canvas.nodeActions.centerNode')}
        </div>
      ),
      onClick: () => setNodeCenter(node.id, true),
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
        canDownload && {
          key: 'downloadFile',
          label: (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <IconDownloadFile className="w-4 h-4 flex-shrink-0" />
              {t('canvas.nodeActions.downloadFile')}
            </div>
          ),
          onClick: handleDownload,
        },
        node.type === 'document' && {
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
          onClick: () => deleteNode(node),
          className: 'hover:bg-red-50',
        },
        node.type === 'document' && {
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
        node.type === 'resource' && {
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
      node,
      handleAddToContext,
      canDownload,
      handleDownload,
      deleteNode,
      handleDeleteFile,
    ]);

    const handleTitleUpdate = (newTitle: string) => {
      if (newTitle === node.data?.title) {
        return;
      }
      updateNodePreviewTitle(newTitle, node.data.entityId, node.id, node.type);
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
            {node.type === 'skillResponse' ? (
              <NodeHeader
                className="!mb-0"
                source="skillResponsePreview"
                query={node.data?.title || ''}
                disabled={readonly}
                showIcon
                updateTitle={handleTitleUpdate}
              />
            ) : (
              <CommonNodeHeader
                source="preview"
                title={getNodeTitle(node, t)}
                fixedTitle={getNodeFixedTitle(node, t)}
                Icon={IconComponent}
                iconBgColor={nodeColor}
                canEdit={node.type !== 'document' && !readonly}
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
            dropdownRender={(menu) => (
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
