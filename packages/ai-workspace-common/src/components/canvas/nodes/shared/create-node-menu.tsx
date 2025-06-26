import { FC, memo, useCallback, useMemo, useState } from 'react';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { CanvasNodeType } from '@refly/openapi-schema';
import { IconAskAI, IconMemo } from '@refly-packages/ai-workspace-common/components/common/icon';
import { FilePlus } from 'lucide-react';
import { GrClone } from 'react-icons/gr';
import {
  nodeActionEmitter,
  createNodeEventName,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { message } from 'antd';
import { HoverCard } from '@refly-packages/ai-workspace-common/components/hover-card';
import { useHoverCard } from '@refly-packages/ai-workspace-common/hooks/use-hover-card';
import { useCreateMemo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-memo';
import { useReactFlow } from '@xyflow/react';
import { useGetNodeContent } from '@refly-packages/ai-workspace-common/hooks/canvas/use-get-node-content';
import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';

interface CreateNodeMenuProps {
  nodeId: string;
  nodeType: CanvasNodeType;
  dragCreateInfo?: NodeDragCreateInfo;
  onClose?: () => void;
}

interface MenuItem {
  key: string;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  loading?: boolean;
  primary?: boolean;
  hoverContent?: {
    title: string;
    description: string;
    videoUrl?: string;
  };
}

export const CreateNodeMenu: FC<CreateNodeMenuProps> = memo(
  ({ nodeId, nodeType, onClose, dragCreateInfo }) => {
    const { t } = useTranslation();

    const { getNode, screenToFlowPosition } = useReactFlow();
    const node = useMemo(() => getNode(nodeId), [nodeId, getNode]);
    const nodeData = useMemo(() => node?.data, [node]);
    const { fetchNodeContent } = useGetNodeContent(node);

    const { hoverCardEnabled } = useHoverCard();
    const { createMemo } = useCreateMemo();
    const [isCreatingDocument, setIsCreatingDocument] = useState(false);
    const [beforeDuplicatingDocument, setBeforeDuplicatingDocument] = useState(false);

    // Calculate position for new nodes based on dragCreateInfo
    const calculateNewNodePosition = useCallback(() => {
      if (dragCreateInfo?.position) {
        // Convert screen coordinates to flow coordinates
        return screenToFlowPosition({
          x: dragCreateInfo.position.x,
          y: dragCreateInfo.position.y,
        });
      }
      return undefined;
    }, [dragCreateInfo, screenToFlowPosition]);

    // Determine connection info based on dragCreateInfo
    const getConnectionInfo = useCallback(() => {
      if (!dragCreateInfo || dragCreateInfo.handleType === 'source') {
        return {
          sourceNode: {
            type: nodeType,
            entityId: nodeData?.entityId as string,
          },
        };
      }
      return {
        targetNode: {
          type: nodeType,
          entityId: nodeData?.entityId as string,
        },
      };
    }, [dragCreateInfo, nodeType, nodeData]);

    const handleAskAI = useCallback(() => {
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'askAI'), { dragCreateInfo });
      onClose?.();
    }, [nodeId, onClose, dragCreateInfo]);

    const handleCreateDocument = useCallback(() => {
      setIsCreatingDocument(true);
      const closeLoading = message.loading(t('canvas.nodeStatus.isCreatingDocument'));
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'createDocument'), { dragCreateInfo });
      nodeActionEmitter.on(createNodeEventName(nodeId, 'createDocument.completed'), () => {
        setIsCreatingDocument(false);
        closeLoading();
      });
      onClose?.();
    }, [nodeId, onClose, t, dragCreateInfo]);

    const handleCreateMemo = useCallback(() => {
      const position = calculateNewNodePosition();
      const connectionInfo = getConnectionInfo();

      createMemo({
        content: '',
        position,
        ...connectionInfo,
      });
      onClose?.();
    }, [nodeType, createMemo, onClose, calculateNewNodePosition, getConnectionInfo, nodeData]);

    const handleDuplicateDocument = useCallback(async () => {
      setBeforeDuplicatingDocument(true);
      const content = (await fetchNodeContent()) as string;
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'duplicateDocument'), {
        content,
        dragCreateInfo,
      });
      setBeforeDuplicatingDocument(false);
      onClose?.();
    }, [nodeId, fetchNodeContent, onClose, dragCreateInfo]);

    const handleDuplicateMemo = useCallback(() => {
      nodeActionEmitter.emit(createNodeEventName(nodeId, 'duplicate'), { dragCreateInfo });
      onClose?.();
    }, [nodeId, dragCreateInfo, onClose]);

    const askAI = {
      key: 'askAI',
      icon: IconAskAI,
      label: t('canvas.nodeActions.askAI'),
      onClick: handleAskAI,
      primary: true,
      hoverContent: {
        title: t('canvas.nodeActions.askAI'),
        description: t('canvas.nodeActions.askAIDescription'),
        videoUrl: 'https://static.refly.ai/onboarding/nodeAction/nodeAction-askAI.webm',
      },
    };

    const createMemoItem = {
      key: 'createMemo',
      icon: IconMemo,
      label: t('canvas.nodeActions.createMemo'),
      onClick: handleCreateMemo,
      hoverContent: {
        title: t('canvas.nodeActions.createMemo'),
        description: t('canvas.nodeActions.createMemoDescription'),
        videoUrl: 'https://static.refly.ai/onboarding/nodeAction/nodeAction-createEmptyMemo.webm',
      },
    };

    const createDocumentItem = {
      key: 'createDocument',
      icon: FilePlus,
      label: t('canvas.nodeStatus.createDocument'),
      onClick: handleCreateDocument,
      loading: isCreatingDocument,
      hoverContent: {
        title: t('canvas.nodeStatus.createDocument'),
        description: t('canvas.toolbar.createDocumentDescription'),
        videoUrl: 'https://static.refly.ai/onboarding/nodeAction/nodeAction-createDocument.webm',
      },
    };

    const duplicateDocumentItem = {
      key: 'duplicateDocument',
      icon: GrClone,
      label: t('canvas.nodeActions.duplicateDocument'),
      loading: beforeDuplicatingDocument,
      onClick: handleDuplicateDocument,
      hoverContent: {
        title: t('canvas.nodeActions.duplicateDocument'),
        description: t('canvas.nodeActions.duplicateDocumentDescription'),
        videoUrl: 'https://static.refly.ai/onboarding/nodeAction/nodeAction-duplicateDocument.webm',
      },
    };

    const duplicateMemoItem = {
      key: 'duplicateMemo',
      icon: GrClone,
      label: t('canvas.nodeActions.duplicateMemo'),
      onClick: handleDuplicateMemo,
    };

    // Get menu items based on node type
    const getMenuItems = useCallback((): MenuItem[] => {
      switch (nodeType) {
        case 'skillResponse':
          return [askAI, createDocumentItem, createMemoItem];

        case 'skill':
          return [createMemoItem];

        case 'document':
          return [askAI, duplicateDocumentItem, createMemoItem];

        case 'resource':
          return [askAI, createDocumentItem, createMemoItem];

        case 'codeArtifact':
        case 'website':
        case 'image':
          return [askAI, createMemoItem];

        case 'memo':
          return [askAI, createMemoItem, duplicateMemoItem];

        case 'group':
          return [askAI, createMemoItem];

        default:
          return [];
      }
    }, [
      nodeType,
      askAI,
      createDocumentItem,
      createMemoItem,
      duplicateDocumentItem,
      duplicateMemoItem,
    ]);

    const menuItems = getMenuItems();

    return (
      <div className="bg-white rounded-lg shadow-lg p-2 border border-[rgba(0,0,0,0.06)] relative dark:bg-gray-900 dark:border-gray-700">
        {menuItems.map((item) => {
          const button = (
            <Button
              key={item.key}
              className={`
              w-full
              h-7
              flex
              items-center
              px-2
              rounded
              text-sm
              transition-colors
              text-gray-700 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-200 dark:hover:bg-gray-900 dark:hover:text-gray-200
              ${item.primary ? '!text-primary-600 hover:bg-primary-50' : ''}
              ${item.loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
              type="text"
              icon={<item.icon className="w-4 h-4 flex items-center justify-center" />}
              loading={item.loading}
              onClick={item.onClick}
            >
              <span className="flex-1 text-left truncate">{item.label}</span>
            </Button>
          );

          return (
            <div key={item.key}>
              {item.hoverContent && hoverCardEnabled ? (
                <HoverCard
                  title={item.hoverContent.title}
                  description={item.hoverContent.description}
                  videoUrl={item.hoverContent.videoUrl}
                  placement="right"
                >
                  {button}
                </HoverCard>
              ) : (
                button
              )}
            </div>
          );
        })}
      </div>
    );
  },
);
