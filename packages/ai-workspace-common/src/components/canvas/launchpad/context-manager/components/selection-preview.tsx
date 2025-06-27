import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { IContextItem } from '@refly/common-types';
import { IconQuote } from '@refly-packages/ai-workspace-common/components/common/icon';
import { getContextItemIcon } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager/utils/icon';
import { LuChevronRight } from 'react-icons/lu';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { useNodeSelection } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-selection';
import { CanvasNode } from '@refly/canvas-common';

interface SelectionPreviewProps {
  item: IContextItem;
}

export const SelectionPreview: React.FC<SelectionPreviewProps> = ({ item }) => {
  const { t } = useTranslation();
  const { selection } = item;
  const { getNodes } = useReactFlow();
  const { setNodeCenter } = useNodePosition();
  const { setSelectedNode } = useNodeSelection();

  const handleSourceClick = useCallback(async () => {
    const node = getNodes().find((node) => node.data?.entityId === selection?.sourceEntityId);

    if (!node) {
      return;
    }

    setNodeCenter(node.id);
    setSelectedNode(node as CanvasNode<any>);
  }, [selection, getNodes, setNodeCenter, setSelectedNode]);

  return (
    <div className="w-64 p-3 rounded-lg max-h-[400px] overflow-y-auto flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-gray-700 shadow-lg flex items-center justify-center flex-shrink-0">
          <IconQuote className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-medium leading-normal truncate">
          {t('copilot.contextItem.quote')}
        </span>
      </div>
      <div
        className="
          px-2 
          py-1 
          text-xs 
          text-gray-500 
          border 
          border-solid 
          border-gray-200 
          rounded-lg 
          flex 
          justify-between 
          items-center 
          gap-2 
          cursor-pointer 
          hover:bg-gray-50
        "
        onClick={(e) => {
          e.stopPropagation();
          handleSourceClick();
        }}
      >
        <div className="flex items-center gap-2">
          {getContextItemIcon(selection?.sourceEntityType)}
          <span className="text-gray-500">{selection?.sourceTitle}</span>
        </div>
        <LuChevronRight className="w-4 h-4 text-gray-300" />
      </div>
      <div className="text-xs">{selection?.content}</div>
    </div>
  );
};
