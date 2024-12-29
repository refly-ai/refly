import { Button, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { FC, useCallback, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  IconRerun,
  IconDelete,
  IconAskAI,
  IconLoading,
  IconRun,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { FileInput, MessageSquareDiff, FilePlus } from 'lucide-react';
import { addPinnedNodeEmitter } from '@refly-packages/ai-workspace-common/events/addPinnedNode';
import { nodeActionEmitter, createNodeEventName } from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useDocumentStoreShallow } from '@refly-packages/ai-workspace-common/stores/document';
import { genSkillID } from '@refly-packages/utils/id';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';

interface MenuItem {
  key: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  loading?: boolean;
  danger?: boolean;
  type: 'button' | 'divider';
  disabled?: boolean;
}

interface NodeActionMenuProps {
  nodeId: string;
  nodeType: CanvasNodeType;
  onClose?: () => void;
  isProcessing?: boolean;
  isCompleted?: boolean;
  isCreatingDocument?: boolean;
}

export const NodeActionMenu: FC<NodeActionMenuProps> = ({ nodeId, nodeType, onClose }) => {
  const { t } = useTranslation();
  const { getNode } = useReactFlow();
  const { canvasId } = useCanvasContext();
  const { addNode } = useAddNode(canvasId);

  const { activeDocumentId } = useDocumentStoreShallow((state) => ({
    activeDocumentId: state.activeDocumentId,
  }));

  const node = useMemo(() => getNode(nodeId) as CanvasNode, [nodeId, getNode]);
  const nodeData = useMemo(() => node?.data, [node]);

  // console.log('nodeactionmenu', nodeId);

  const addPinnedNode = useCanvasStoreShallow(useCallback((state) => state.addPinnedNode, []));

  const handleAskAI = useCallback(() => {
    const node = getNode(nodeId) as CanvasNode;
    addNode(
      {
        type: 'skill',
        data: {
          title: 'Skill',
          entityId: genSkillID(),
          metadata: {
            contextNodeIds: [nodeId],
          },
        },
      },
      [{ type: node.type, entityId: node.data.entityId }],
    );
    onClose?.();
  }, [nodeId]);

  const handleRun = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'run'));
    onClose?.();
  }, [nodeId]);

  const handleRerun = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'rerun'));
    onClose?.();
  }, [nodeId]);

  const handleDelete = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'delete'));
    onClose?.();
  }, [nodeId]);

  const handleAddToContext = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'addToContext'));
    onClose?.();
  }, [nodeId]);

  const handleCreateDocument = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'createDocument'));
    onClose?.();
  }, [nodeId]);

  const handleInsertToDoc = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'insertToDoc'), {
      content: nodeData?.contentPreview,
    });
    onClose?.();
  }, [nodeId, nodeData?.contentPreview]);

  const handlePreview = useCallback(() => {
    addPinnedNode(canvasId, node);
    addPinnedNodeEmitter.emit('addPinnedNode', { id: nodeId, canvasId });
    onClose?.();
  }, [node, nodeId, canvasId]);

  const getMenuItems = (): MenuItem[] => {
    const baseItems: MenuItem[] = [
      {
        key: 'askAI',
        icon: IconAskAI,
        label: t('canvas.nodeActions.askAI'),
        onClick: handleAskAI,
        type: 'button' as const,
      },
      { key: 'divider-1', type: 'divider' } as MenuItem,
    ];

    const nodeTypeItems: Record<string, MenuItem[]> = {
      document: [
        {
          key: 'addToContext',
          icon: MessageSquareDiff,
          label: t('canvas.nodeActions.addToContext'),
          onClick: handleAddToContext,
          type: 'button' as const,
        },
      ],
      resource: [
        {
          key: 'addToContext',
          icon: MessageSquareDiff,
          label: t('canvas.nodeActions.addToContext'),
          onClick: handleAddToContext,
          type: 'button' as const,
        },
      ],
      memo: [
        {
          key: 'addToContext',
          icon: MessageSquareDiff,
          label: t('canvas.nodeActions.addToContext'),
          onClick: handleAddToContext,
          type: 'button' as const,
        },
        {
          key: 'insertToDoc',
          icon: FileInput,
          label: t('canvas.nodeActions.insertToDoc'),
          onClick: handleInsertToDoc,
          type: 'button' as const,
        },
      ],
      skill: [
        {
          key: 'run',
          icon: IconRun,
          label: t('canvas.nodeActions.run'),
          onClick: handleRun,
          type: 'button' as const,
        },
      ],
      skillResponse: [
        {
          key: 'rerun',
          icon: IconRerun,
          label: t('canvas.nodeActions.rerun'),
          onClick: handleRerun,
          type: 'button' as const,
        },
        {
          key: 'insertToDoc',
          icon: FileInput,
          label: t('canvas.nodeActions.insertToDoc'),
          onClick: handleInsertToDoc,
          type: 'button' as const,
          disabled: !activeDocumentId,
        },
        {
          key: 'addToContext',
          icon: MessageSquareDiff,
          label: t('canvas.nodeActions.addToContext'),
          onClick: handleAddToContext,
          type: 'button' as const,
        },
        nodeData?.contentPreview
          ? {
              key: 'createDocument',
              icon: FilePlus,
              label: t('canvas.nodeStatus.createDocument'),
              onClick: handleCreateDocument,
              type: 'button' as const,
            }
          : null,
      ].filter(Boolean),
    };

    const deleteItem: MenuItem = {
      key: 'delete',
      icon: IconDelete,
      label: t('canvas.nodeActions.delete'),
      onClick: handleDelete,
      danger: true,
      type: 'button' as const,
    };

    return [
      ...(nodeType !== 'memo' && nodeType !== 'skill' ? baseItems : []),
      ...(nodeTypeItems[nodeType] || []),
      { key: 'divider-2', type: 'divider' } as MenuItem,
      deleteItem,
    ];
  };

  const menuItems = useMemo(
    () => getMenuItems(),
    [
      nodeType,
      nodeData?.contentPreview,
      handleRerun,
      handleDelete,
      handleAddToContext,
      handleCreateDocument,
      handleInsertToDoc,
      handlePreview,
      t,
    ],
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-2 w-[200px] border border-[rgba(0,0,0,0.06)]">
      {menuItems.map((item) => {
        if (item.type === 'divider') {
          return <Divider key={item.key} className="my-1 h-[1px] bg-gray-100" />;
        }

        return (
          <Button
            key={item.key}
            className={`
              w-full
              h-8
              flex
              items-center
              gap-2
              px-2
              rounded
              text-sm
              transition-colors
              ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}
              ${item.loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            type="text"
            loading={item.loading}
            onClick={item.onClick}
            disabled={item.disabled}
          >
            {item.loading ? <IconLoading className="w-4 h-4" /> : <item.icon className="w-4 h-4" />}
            <span className="flex-1 text-left truncate">{item.label}</span>
          </Button>
        );
      })}
    </div>
  );
};
