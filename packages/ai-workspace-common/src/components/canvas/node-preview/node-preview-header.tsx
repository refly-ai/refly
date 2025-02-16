import { FC, useCallback, useMemo } from 'react';
import { Button, Dropdown, Modal } from 'antd';
import type { MenuProps } from 'antd';
import { TFunction } from 'i18next';
import {
  FileText,
  Sparkles,
  Wrench,
  Maximize2,
  MoreHorizontal,
  X,
  Cpu,
  Code2,
  Globe,
  FilePlus,
  Trash2,
  Target,
} from 'lucide-react';
import { NODE_COLORS } from '../nodes/shared/colors';
import { CanvasNode } from '../nodes/shared/types';
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
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { HiOutlineSquare3Stack3D } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-preview-control';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useDeleteDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-document';
import { useDeleteResource } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-resource';
import { useDownloadFile } from '@refly-packages/ai-workspace-common/hooks/use-download-file';
// Get icon component based on node type and metadata
const getNodeIcon = (node: CanvasNode<any>) => {
  switch (node.type) {
    case 'document':
      return IconDocument;
    case 'resource':
      return HiOutlineSquare3Stack3D;
    case 'skillResponse':
      return IconResponse;
    case 'toolResponse':
      return IconResponse;
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
const getNodeTitle = (node: CanvasNode<any>, t: TFunction) => {
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
    default:
      return 'Unknown Node';
  }
};

interface NodePreviewHeaderProps {
  node: CanvasNode<any>;
  onClose: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
}

export const NodePreviewHeader: FC<NodePreviewHeaderProps> = ({
  node,
  onClose,
  onMaximize,
  isMaximized = false,
}) => {
  const { t } = useTranslation();
  const IconComponent = getNodeIcon(node);
  const nodeColor = NODE_COLORS[node.type];
  const nodeTitle = getNodeTitle(node, t);

  const { addToContext } = useAddToContext();

  const { deleteNode } = useDeleteNode();
  const { deleteResource } = useDeleteResource();
  const { deleteDocument } = useDeleteDocument();
  const { downloadFile } = useDownloadFile();

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

  const { canvasId } = useCanvasContext();
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
  const canExport = useMemo(() => {
    const metadata = node.data?.metadata || {};
    const { rawFileKey, resourceType } = metadata;
    return node.type === 'resource' && rawFileKey && resourceType === 'file';
  }, [node]);

  const handleExport = useCallback(() => {
    downloadFile(node.data?.metadata?.rawFileKey);
  }, [node]);

  // Define dropdown menu items
  const menuItems: MenuProps['items'] = [
    {
      key: 'centerNode',
      label: (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Target className="w-4 h-4 flex-shrink-0" />
          {t('canvas.nodeActions.centerNode')}
        </div>
      ),
      onClick: () => setNodeCenter(node.id, true),
    },
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
    canExport && {
      key: 'export',
      label: (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <IconDownloadFile className="w-4 h-4 flex-shrink-0" />
          {t('canvas.nodeActions.downloadFile')}
        </div>
      ),
      onClick: handleExport,
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

  return (
    <div className="flex justify-between items-center py-2 px-4 border-b border-[#EAECF0]">
      {/* Left: Icon and Title */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: nodeColor }}
        >
          <IconComponent className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-semibold text-gray-900">{nodeTitle}</span>
      </div>

      {/* Right: Action Buttons */}
      <div className="flex items-center gap-1">
        {onMaximize && (
          <Button
            type="text"
            className={`p-1.5 hover:bg-gray-100 ${isMaximized ? 'text-primary-600' : 'text-gray-500'}`}
            onClick={() => onMaximize()}
          >
            <Maximize2 className="w-4 h-4" />
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
};
