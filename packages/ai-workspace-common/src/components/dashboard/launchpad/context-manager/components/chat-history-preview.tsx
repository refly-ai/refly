import React, { useMemo } from 'react';
import { Timeline } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  IconResponse,
  IconResponseFilled,
  IconThreadHistory,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { getResultDisplayContent } from '@refly-packages/ai-workspace-common/components/common/result-display';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { useNodeSelection } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-selection';
import {
  CanvasNode,
  ResponseNodeMeta,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { useFindThreadHistory } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-thread-history';

// Define props interface
interface ChatHistoryProps {
  item: IContextItem;
  onItemClick?: (item: IContextItem) => void;
}

const ChatHistoryItem = ({ node }: { node: CanvasNode<ResponseNodeMeta> }) => {
  const { setNodeCenter } = useNodePosition();
  const { setSelectedNode } = useNodeSelection();

  const handleItemClick = (node: CanvasNode<ResponseNodeMeta>, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!node) return;

    setNodeCenter(node.id);
    setSelectedNode(node as CanvasNode<any>);
  };

  return (
    <div
      key={`${node.id}`}
      className={cn(
        'm-1 py-0.5 px-2 rounded-lg cursor-pointer border-gray-100 hover:bg-gray-100',
        {},
      )}
      onClick={(e) => handleItemClick(node, e)}
    >
      <div className="text-gray-800 font-medium flex items-center justify-between text-[13px] whitespace-nowrap overflow-hidden">
        <div className="max-w-[200px] truncate">{node.data?.title}</div>
      </div>
      <div className="text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis text-xs">
        {getResultDisplayContent(node.data)}
      </div>
    </div>
  );
};

export const ChatHistoryPreview: React.FC<ChatHistoryProps> = ({ item }) => {
  const { t } = useTranslation();

  const findThreadHistory = useFindThreadHistory();

  const historyNodes = useMemo(() => {
    return findThreadHistory({ resultId: item?.entityId });
  }, [findThreadHistory, item?.entityId]);

  return (
    <div className="w-72 p-3 pb-0 rounded-lg max-h-[400px] overflow-y-auto">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-slate-500 shadow-lg flex items-center justify-center flex-shrink-0">
          <IconThreadHistory className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-medium leading-normal truncate">
          {t('copilot.contextItem.threadHistory')}
        </span>
      </div>
      <div className="ml-1 mt-5">
        <Timeline
          className="[&_.ant-timeline-item]:p-0 [&_.ant-timeline-item-content]:ms-3"
          items={historyNodes.map((node, index) => ({
            dot:
              index === historyNodes.length - 1 ? (
                <IconResponseFilled className="h-4 w-4 text-gray-500" />
              ) : (
                <IconResponse className="h-4 w-4 text-gray-500" />
              ),
            children: <ChatHistoryItem node={node} />,
          }))}
        />
      </div>
    </div>
  );
};
