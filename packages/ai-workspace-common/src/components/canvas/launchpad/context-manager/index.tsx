import { useMemo, useState } from 'react';
import { ContextItem } from './context-item';

import { AddBaseMarkContext } from './components/add-base-mark-context';
import { mapSelectionTypeToContentList } from './utils/contentListSelection';
import { FilterErrorInfo, NodeItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useReactFlow } from '@xyflow/react';

interface ContextManagerProps {
  contextItems: NodeItem[];
  setContextItems: (items: NodeItem[]) => void;
  filterErrorInfo?: FilterErrorInfo;
}

export const ContextManager = ({ contextItems, setContextItems, filterErrorInfo }: ContextManagerProps) => {
  const { getNode } = useReactFlow();
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const itemSelected = useMemo(() => {
    return new Map(contextItems.map((item) => [item.id, getNode(item.id)?.selected]));
  }, [contextItems]);

  const handleRemoveItem = (item: NodeItem) => {
    setContextItems(contextItems.filter((contextItem) => contextItem.id !== item.id));

    if (activeItemId === item.id) {
      setActiveItemId(null);
    }
  };

  return (
    <div className="flex flex-col h-full p-2 px-3">
      <div className="flex flex-col">
        <div className="flex flex-wrap content-start gap-1 w-full">
          <AddBaseMarkContext contextItems={contextItems} setContextItems={setContextItems} />
          {contextItems?.map((item) => (
            <ContextItem
              key={item?.id}
              item={item}
              isLimit={!!filterErrorInfo?.[mapSelectionTypeToContentList(item?.type)]}
              isActive={itemSelected.get(item.id)}
              onRemove={handleRemoveItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
