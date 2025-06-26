import { Button, Popover } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from '@xyflow/react';
import { getContextItemIcon } from './utils/icon';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import cn from 'classnames';
import { ContextPreview } from './context-preview';
import { useCallback } from 'react';
import { message } from 'antd';
import { useNodeSelection } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-selection';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

export const ContextItem = ({
  item,
  isLimit,
  isActive,
  disabled,
  onRemove,
  canNotRemove,
}: {
  canNotRemove?: boolean;
  item: IContextItem;
  isActive: boolean;
  isLimit?: boolean;
  disabled?: boolean;
  onRemove?: (item: IContextItem) => void;
}) => {
  const { t } = useTranslation();
  const { readonly } = useCanvasContext();
  const { title, entityId, selection, metadata, type } = item ?? {};
  const icon = getContextItemIcon(item.type, null, { withHistory: metadata?.withHistory });
  const { setSelectedNode } = useNodeSelection();
  const { getNodes } = useReactFlow();
  const { setNodeCenter } = useNodePosition();

  const handleItemClick = useCallback(async () => {
    const nodes = getNodes();
    const node = nodes.find((node) => node.data?.entityId === entityId);

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
      overlayInnerStyle={{ padding: 0 }}
      overlayClassName="context-preview-popover rounded-lg"
    >
      <Button
        className={cn(
          'max-w-40 h-6 px-1 flex items-center border border-gray-200 dark:border-gray-700 rounded transition-all duration-300',
          {
            'border-green-500': isActive,
            'border-red-300 bg-red-50 text-red-500': isLimit,
            'bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700': disabled,
          },
        )}
        onClick={() => handleItemClick()}
      >
        <div className="h-[18px] flex items-center w-full text-xs">
          <span className="flex items-center flex-shrink-0 mr-1">{icon}</span>
          <span
            className={cn(
              'flex-1 whitespace-nowrap overflow-hidden text-ellipsis min-w-0 mr-1 text-gray-600 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-300',
              {
                'text-gray-300': disabled,
                'text-red-500': isLimit,
              },
            )}
          >
            {title || t(`canvas.nodeTypes.${type}`)}
          </span>
          {!canNotRemove && !readonly && (
            <CloseOutlined
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
