import { Button, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { FC, useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { CanvasNode } from '@refly/canvas-common';
import { Edit, AddContext, InputContext, Delete, AiChat } from 'refly-icons';
import { Ungroup, ChevronDown } from 'lucide-react';
import { locateToNodePreviewEmitter } from '@refly-packages/ai-workspace-common/events/locateToNodePreview';
import {
  nodeActionEmitter,
  createNodeEventName,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useDocumentStoreShallow } from '@refly/stores';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useUngroupNodes } from '@refly-packages/ai-workspace-common/hooks/canvas/use-batch-nodes-selection/use-ungroup-nodes';
import { useNodeCluster } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-cluster';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useGetNodeContent } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-content';

import './index.scss';

interface MenuItem {
  key?: string;
  icon?: React.ElementType;
  label?: string | React.ReactNode;
  onClick?: (e?: React.MouseEvent) => void;
  loading?: boolean;
  danger?: boolean;
  primary?: boolean;
  type?: 'button' | 'divider';
  disabled?: boolean;
}

interface NodeActionMenuProps {
  nodeId: string;
  nodeType: CanvasNodeType;
  onClose?: () => void;
  isProcessing?: boolean;
  isCompleted?: boolean;
  isCreatingDocument?: boolean;
  isMultiSelection?: boolean;
  onHoverCardStateChange?: (isHovered: boolean) => void;
  hasFixedHeight?: boolean;
}

export const NodeActionMenu: FC<NodeActionMenuProps> = ({
  nodeId,
  nodeType,
  onClose,
  isMultiSelection,
  hasFixedHeight = false,
}) => {
  const { t } = useTranslation();
  const { getNode } = useReactFlow();
  const { canvasId } = useCanvasContext();
  const { previewNode } = useNodePreviewControl({ canvasId });

  const { activeDocumentId } = useDocumentStoreShallow((state) => ({
    activeDocumentId: state.activeDocumentId,
  }));

  const node = useMemo(() => getNode(nodeId) as CanvasNode, [nodeId, getNode]);
  const nodeData = useMemo(() => node?.data, [node]);
  const { fetchNodeContent } = useGetNodeContent(node);
  const [localSizeMode, setLocalSizeMode] = useState(
    () => nodeData?.metadata?.sizeMode || 'adaptive',
  );

  useEffect(() => {
    setLocalSizeMode(nodeData?.metadata?.sizeMode || 'adaptive');
  }, [nodeData?.metadata?.sizeMode]);

  const { ungroupNodes } = useUngroupNodes();

  const handleAskAI = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'askAI'));
    onClose?.();
  }, [nodeId, onClose]);

  const handleDelete = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'delete'));
    onClose?.();
  }, [nodeId, onClose]);

  const handleAddToContext = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'addToContext'));
    onClose?.();
  }, [nodeId, onClose]);

  const handleInsertToDoc = useCallback(async () => {
    const content = (await fetchNodeContent()) as string;
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'insertToDoc'), {
      content,
    });
    onClose?.();
  }, [nodeId, fetchNodeContent, onClose]);

  const handlePreview = useCallback(() => {
    previewNode(node);
    locateToNodePreviewEmitter.emit('locateToNodePreview', {
      id: nodeId,
      canvasId,
    });
    onClose?.();
  }, [node, nodeId, canvasId, onClose, previewNode]);

  const handleUngroup = useCallback(() => {
    ungroupNodes(nodeId);
    onClose?.();
  }, [ungroupNodes, nodeId, onClose]);

  const { selectNodeCluster, groupNodeCluster, layoutNodeCluster } = useNodeCluster();

  const handleSelectCluster = useCallback(() => {
    if (nodeType === 'group') {
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'selectCluster'));
    } else {
      selectNodeCluster(nodeId);
    }
    onClose?.();
  }, [nodeId, nodeType, selectNodeCluster, onClose]);

  const handleGroupCluster = useCallback(() => {
    if (nodeType === 'group') {
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'groupCluster'));
    } else {
      groupNodeCluster(nodeId);
    }
    onClose?.();
  }, [nodeId, nodeType, groupNodeCluster, onClose]);

  const handleLayoutCluster = useCallback(() => {
    if (nodeType === 'group') {
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'layoutCluster'));
    } else {
      layoutNodeCluster(nodeId);
    }
    onClose?.();
  }, [nodeId, nodeType, layoutNodeCluster, onClose]);

  const handleEditQuery = useCallback(() => {
    previewNode(node);

    setTimeout(() => {
      locateToNodePreviewEmitter.emit('locateToNodePreview', {
        id: nodeId,
        canvasId,
        type: 'editResponse',
      });
    }, 100);

    onClose?.();
  }, [nodeId, canvasId, node, previewNode, onClose]);

  const getMenuItems = useCallback(
    (activeDocumentId: string): MenuItem[] => {
      if (isMultiSelection) {
        return [
          {
            key: 'askAI',
            icon: AiChat,
            label: t('canvas.nodeActions.askAI'),
            onClick: handleAskAI,
            type: 'button' as const,
            primary: true,
          },
          { key: 'divider-1', type: 'divider' } as MenuItem,
          {
            key: 'addToContext',
            icon: AddContext,
            label: t('canvas.nodeActions.addToContext'),
            onClick: handleAddToContext,
            type: 'button' as const,
          },
          { key: 'divider-2', type: 'divider' } as MenuItem,
          {
            key: 'delete',
            icon: Delete,
            label: t('canvas.nodeActions.delete'),
            onClick: handleDelete,
            danger: true,
            type: 'button' as const,
          },
        ];
      }

      const commonItems: MenuItem[] = [
        ...(nodeType === 'skillResponse'
          ? [
              {
                key: 'editQuery',
                icon: Edit,
                label: t('canvas.nodeActions.editQuery'),
                onClick: handleEditQuery,
                type: 'button' as const,
              },
            ]
          : []),
      ];

      const nodeTypeItems: Record<string, MenuItem[]> = {
        codeArtifact: [
          {
            key: 'insertToDoc',
            icon: InputContext,
            label: t('canvas.nodeActions.insertToDoc'),
            loading: false,
            onClick: handleInsertToDoc,
            type: 'button' as const,
            disabled: !activeDocumentId,
          },
        ],
        group: [
          {
            key: 'ungroup',
            icon: Ungroup,
            label: t('canvas.nodeActions.ungroup'),
            onClick: handleUngroup,
            type: 'button' as const,
          },
        ],
        skillResponse: [
          {
            key: 'insertToDoc',
            icon: InputContext,
            label: t('canvas.nodeActions.insertToDoc'),
            loading: false,
            onClick: handleInsertToDoc,
            type: 'button' as const,
            disabled: !activeDocumentId,
          },
        ].filter(Boolean),
      };

      return [
        ...(nodeType !== 'skill' ? commonItems : []),
        ...(nodeTypeItems[nodeType] || []),
      ].filter(Boolean);
    },
    [
      nodeType,
      nodeData?.contentPreview,
      handleDelete,
      handleAddToContext,
      handlePreview,
      t,
      localSizeMode,
      handleAskAI,
      handleGroupCluster,
      handleLayoutCluster,
      handleEditQuery,
      handleInsertToDoc,
      handleSelectCluster,
      handleUngroup,
      isMultiSelection,
    ],
  );

  const menuItems = useMemo(() => getMenuItems(activeDocumentId), [activeDocumentId, getMenuItems]);

  const contentRef = useRef<HTMLDivElement>(null);
  const [hasMoreContent, setHasMoreContent] = useState(false);

  const checkScrollPosition = useCallback(() => {
    const container = contentRef.current;
    if (container) {
      const { scrollHeight, scrollTop, clientHeight } = container;
      // Check if we're not at the bottom and there's content to scroll
      setHasMoreContent(
        scrollHeight > clientHeight && scrollHeight - scrollTop - clientHeight > 10,
      );
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = contentRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  // Check scroll position on initial render and when content changes
  useEffect(() => {
    checkScrollPosition();
    const container = contentRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollPosition);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScrollPosition);
      }
    };
  }, [checkScrollPosition, menuItems]);

  return (
    menuItems.length > 0 && (
      <div className="rounded-[12px] shadow-lg p-2 w-[200px]">
        <div
          ref={contentRef}
          className={`node-action-menu-content ${hasFixedHeight ? 'max-h-[200px] overflow-y-auto' : ''}`}
        >
          {menuItems.map((item) => {
            if (item?.type === 'divider') {
              return <Divider key={item.key} className="my-1 h-[1px] bg-refly-Card-Border" />;
            }

            const button = (
              <Button
                key={item.key}
                className={`
                w-full
                h-9
                flex
                items-center
                justify-start
                gap-1
                px-1.5
                py-2
                rounded
                text-sm
                transition-colors
                text-refly-text-0
                hover:!bg-refly-tertiary-hover
                ${item.danger ? '!text-refly-func-danger-default' : ''}
                ${item.primary ? '!text-refly-primary-default hover:!bg-refly-primary-hover' : ''}
                ${item.loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${item.disabled ? 'pointer-events-none dark:opacity-30' : ''}
              `}
                type="text"
                loading={item.loading}
                onClick={item.onClick}
                disabled={item.disabled}
              >
                {item.icon ? <item.icon size={18} /> : undefined}
                {item.label}
              </Button>
            );

            return button;
          })}
        </div>
        {hasFixedHeight && hasMoreContent && (
          <div className="scroll-indicator" onClick={scrollToBottom}>
            <ChevronDown className="w-4 h-4 text-gray-800 dark:text-gray-200" />
          </div>
        )}
      </div>
    )
  );
};
