import { Button, Popover } from 'antd';
import { IconClose } from '@arco-design/web-react/icon';
import { useTranslation } from 'react-i18next';
import { getNodeIcon } from './utils/icon';
import { NodeItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import cn from 'classnames';
import { ContextPreview } from './context-preview';
import { useCallback } from 'react';
import { Message } from '@arco-design/web-react';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { useNodeSelection } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-selection';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';

export const ContextItem = ({
  item,
  isLimit,
  isActive,
  disabled,
  onRemove,
  canNotRemove,
}: {
  canNotRemove?: boolean;
  item: NodeItem;
  isActive: boolean;
  isLimit?: boolean;
  disabled?: boolean;
  onRemove?: (item: NodeItem) => void;
}) => {
  const { t } = useTranslation();
  const { data } = item ?? {};
  const icon = getNodeIcon(item?.type);
  const { setSelectedNode } = useNodeSelection();
  const { nodes } = useCanvasData();
  const { setNodeCenter } = useNodePosition();

  const handleItemClick = useCallback(
    async (item: CanvasNode<any>) => {
      setNodeCenter(item.id);
      const isSelectionNode = item.data?.metadata?.sourceType?.includes('Selection');

      if (isSelectionNode) {
        const sourceEntityId = item.data?.metadata?.sourceEntityId;
        const sourceEntityType = item.data?.metadata?.sourceEntityType;

        if (!sourceEntityId || !sourceEntityType) {
          console.warn('Missing source entity information for selection node');
          return;
        }

        const sourceNode = nodes.find(
          (node) => node.data?.entityId === sourceEntityId && node.type === sourceEntityType,
        );

        if (!sourceNode) {
          Message.warning({
            content: t('canvas.contextManager.nodeNotFound'),
          });
          return;
        }

        setSelectedNode(sourceNode);
      } else {
        setSelectedNode(item);
      }
    },
    [nodes, setSelectedNode, t],
  );

  const content = <ContextPreview item={item} />;

  const isSelection = item?.data?.metadata?.sourceType?.toLowerCase()?.includes('selection');
  const sourceType = isSelection ? 'selection' : item?.type;

  return (
    <Popover
      arrow={false}
      content={content}
      trigger="hover"
      mouseEnterDelay={0.5}
      mouseLeaveDelay={0.1}
      overlayInnerStyle={{ padding: 0 }}
      overlayClassName="context-preview-popover rounded-lg"
    >
      <Button
        className={cn(
          'max-w-40 h-6 px-1 flex items-center border border-gray-200 rounded transition-all duration-300',
          {
            'border-green-500': isActive,
            'border-red-300 bg-red-50 text-red-500': isLimit,
            'bg-gray-100 border-gray-200': disabled,
            'border-dashed': item?.isPreview,
          },
        )}
        onClick={() => handleItemClick?.(item)}
      >
        <div className="h-[18px] flex items-center w-full text-xs">
          <span className="flex items-center flex-shrink-0 mr-1">{icon}</span>
          <span
            className={cn('flex-1 whitespace-nowrap overflow-hidden text-ellipsis min-w-0 mr-1', {
              'text-gray-300': disabled,
              'text-red-500': isLimit,
            })}
            title={data?.title ?? ''}
          >
            {data?.title}
          </span>
          <span className="item-type text-gray-500 mr-1">
            {item.isCurrentContext ? t('copilot.contextItem.current') : ''}
            {t(`copilot.contextItem.${sourceType}`)}
          </span>
          {!canNotRemove && (
            <IconClose
              className={cn('flex-shrink-0 text-xs cursor-pointer', {
                'text-gray-300': disabled,
                'text-red-500': isLimit,
              })}
              onClick={(e) => {
                e.stopPropagation();
                onRemove?.(item);
              }}
            />
          )}
        </div>
      </Button>
    </Popover>
  );
};
