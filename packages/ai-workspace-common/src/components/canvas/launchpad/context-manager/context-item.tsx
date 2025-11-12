import { Popover } from 'antd';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from '@xyflow/react';
import { IContextItem } from '@refly/common-types';
import cn from 'classnames';
import { ContextPreview } from './context-preview';
import { useCallback, useMemo } from 'react';
import { message } from 'antd';
import { useNodeSelection } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-selection';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { CanvasNode } from '@refly/canvas-common';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import './index.scss';
import { Close } from 'refly-icons';
import { NODE_COLORS } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useFetchDriveFiles } from '@refly-packages/ai-workspace-common/hooks/use-fetch-resources';

export const ContextItem = ({
  item,
  isLimit,
  isActive,
  onRemove,
  canNotRemove,
}: {
  canNotRemove?: boolean;
  item: IContextItem;
  isActive: boolean;
  isLimit?: boolean;
  onRemove?: (item: IContextItem) => void;
}) => {
  const { t } = useTranslation();
  const { readonly } = useCanvasContext();
  const { title, entityId, selection, type } = item ?? {};
  const { setSelectedNode } = useNodeSelection();
  const { getNodes, getNode } = useReactFlow();
  const { setNodeCenter } = useNodePosition();
  const { canvasId } = useGetProjectCanvasId();
  const { handleNodePreview } = useNodePreviewControl({ canvasId });
  const { data: resourcesData } = useFetchDriveFiles();

  const node = useMemo(() => {
    const nodes = getNodes();
    return nodes.find((node) => node.data?.entityId === entityId) as CanvasNode<any>;
  }, [getNodes, entityId]);

  const finalTitle = useMemo(() => {
    if (type === 'resource') {
      const resource = resourcesData?.find((resource) => resource.resourceId === entityId);
      return resource?.title || title || t('common.untitled');
    }
    const nodeTitle = getNode(node?.id)?.data?.title;
    const stringifiedNodeTitle = nodeTitle != null ? String(nodeTitle) : null;
    return stringifiedNodeTitle || title || t(`canvas.nodeTypes.${type}`);
  }, [node?.id, getNode, title, type, t, resourcesData, entityId]);

  const handleItemClick = useCallback(() => {
    const nodes = getNodes();
    const currentNode = nodes.find((node) => node.data?.entityId === entityId) as CanvasNode<any>;

    if (!currentNode) {
      if (type === 'resource') {
        // Create a fake resource node for preview
        const fakeResourceNode: CanvasNode = {
          id: `preview-resource-${entityId}`,
          type: 'resource',
          position: { x: 0, y: 0 },
          data: {
            title: finalTitle,
            entityId,
            contentPreview: '',
            metadata: {
              resourceType: item.metadata?.resourceType,
              resourceMeta: item.metadata?.resourceMeta,
            },
          },
        };

        handleNodePreview(fakeResourceNode);
      }
      return;
    }

    setNodeCenter(currentNode.id);

    if (selection) {
      const sourceEntityId = selection.sourceEntityId;
      const sourceEntityType = selection.sourceEntityType;

      if (!sourceEntityId || !sourceEntityType) {
        console.warn('Missing source entity information for selection node');
        return;
      }

      const sourceNode = nodes.find(
        (node) => node.data?.entityId === sourceEntityId && node.type === sourceEntityType,
      );

      if (!sourceNode) {
        message.warning({
          content: t('canvas.contextManager.nodeNotFound'),
        });
        return;
      }

      setSelectedNode(sourceNode);
    } else {
      setSelectedNode(currentNode as CanvasNode<any>);
    }
  }, [
    entityId,
    type,
    finalTitle,
    item.metadata,
    selection,
    setSelectedNode,
    setNodeCenter,
    getNodes,
    t,
    handleNodePreview,
  ]);

  const content = <ContextPreview item={item} />;

  return (
    <Popover
      arrow={false}
      content={content}
      placement="top"
      trigger="hover"
      mouseEnterDelay={0.5}
      mouseLeaveDelay={0.1}
      styles={{ body: { padding: 0 } }}
      classNames={{ root: 'context-preview-popover rounded-lg' }}
      overlayClassName="context-preview-popover"
    >
      <div
        className={cn(
          'flex items-center py-0.5 px-1 gap-1 bg-refly-tertiary-default hover:bg-refly-tertiary-hover border-[0.5px] border-solid border-refly-Card-Border rounded-[4px] box-border h-5',
          {
            'border-refly-primary-default': isActive,
            'bg-refly-Colorful-red-light': isLimit,
          },
        )}
        onClick={() => handleItemClick()}
      >
        <NodeIcon
          className="!w-4 !h-4"
          type={type}
          small
          url={node?.data?.metadata?.imageUrl as string}
          resourceType={node?.data?.metadata?.resourceType ?? item.metadata?.resourceType}
          resourceMeta={node?.data?.metadata?.resourceMeta ?? item.metadata?.resourceMeta}
          iconSize={16}
          iconColor={NODE_COLORS[type]}
          filled={false}
        />
        <div
          className={cn('text-xs text-refly-text-0 max-w-[100px] truncate leading-4', {
            'text-refly-func-danger-default': isLimit,
          })}
        >
          {finalTitle}
        </div>
        {!canNotRemove && !readonly && (
          <Close
            size={14}
            color={isLimit ? 'var(--refly-func-danger-default)' : 'var(--refly-text-1)'}
            className="cursor-pointer flex-shrink-0 hover:text-refly-text-0"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.(item);
            }}
          />
        )}
      </div>
    </Popover>
  );
};
