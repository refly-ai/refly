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
  const { getNodes } = useReactFlow();
  const { setNodeCenter } = useNodePosition();
  const nodes = getNodes();

  const node = useMemo(() => {
    return nodes.find((node) => node.data?.entityId === entityId) as CanvasNode<any>;
  }, [nodes, entityId]);

  const handleItemClick = useCallback(async () => {
    if (!node) {
      return;
    }

    setNodeCenter(node.id);

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
      setSelectedNode(node as CanvasNode<any>);
    }
  }, [entityId, selection, setSelectedNode, setNodeCenter, getNodes, t]);

  const content = <ContextPreview item={item} />;

  return (
    <Popover
      arrow={false}
      content={content}
      trigger="hover"
      mouseEnterDelay={0.5}
      mouseLeaveDelay={0.1}
      styles={{ body: { padding: 0 } }}
      classNames={{ root: 'context-preview-popover rounded-lg' }}
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
          resourceType={node?.data?.metadata?.resourceType}
          resourceMeta={node?.data?.metadata?.resourceMeta}
          iconSize={16}
          iconColor={NODE_COLORS[type]}
          filled={false}
        />
        <div
          className={cn('text-xs text-refly-text-0 max-w-[100px] truncate leading-4', {
            'text-refly-func-danger-default': isLimit,
          })}
        >
          {title || t(`canvas.nodeTypes.${type}`)}
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
