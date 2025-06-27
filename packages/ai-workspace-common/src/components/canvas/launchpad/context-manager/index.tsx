import { memo, useCallback, useMemo, useState } from 'react';
import { ContextItem } from './context-item';

import { AddBaseMarkContext } from './components/add-base-mark-context';
import { mapSelectionTypeToContentList } from './utils/contentListSelection';
import { IContextItem } from '@refly/common-types';
import { FilterErrorInfo } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useReactFlow } from '@xyflow/react';
import { cn } from '@refly/utils/cn';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

interface ContextManagerProps {
  className?: string;
  contextItems: IContextItem[];
  setContextItems: (items: IContextItem[]) => void;
  filterErrorInfo?: FilterErrorInfo;
}

const ContextManagerComponent = ({
  className,
  contextItems = [],
  setContextItems,
  filterErrorInfo,
}: ContextManagerProps) => {
  const { readonly } = useCanvasContext();
  const { getNodes } = useReactFlow();
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const itemSelected = useMemo(() => {
    const nodes = getNodes();
    const entityIdNodeMap = new Map(
      nodes.filter((node) => node.data?.entityId).map((node) => [node.data?.entityId, node]),
    );
    return new Map(
      contextItems.map((item) => [item.entityId, entityIdNodeMap.get(item.entityId)?.selected]),
    );
  }, [contextItems, getNodes]);

  const handleRemoveItem = useCallback(
    (item: IContextItem) => {
      setContextItems(contextItems.filter((contextItem) => contextItem.entityId !== item.entityId));

      if (activeItemId === item.entityId) {
        setActiveItemId(null);
      }
    },
    [contextItems, setContextItems, activeItemId],
  );

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex flex-wrap content-start gap-1 w-full">
        {!readonly && (
          <AddBaseMarkContext contextItems={contextItems} setContextItems={setContextItems} />
        )}

        {contextItems.filter(Boolean).map((item) => (
          <ContextItem
            key={item.entityId}
            item={item}
            isLimit={!!filterErrorInfo?.[mapSelectionTypeToContentList(item?.type)]}
            isActive={itemSelected.get(item.entityId)}
            onRemove={handleRemoveItem}
          />
        ))}
      </div>
    </div>
  );
};

export const ContextManager = memo(ContextManagerComponent, (prevProps, nextProps) => {
  return (
    prevProps.className === nextProps.className &&
    prevProps.contextItems === nextProps.contextItems &&
    prevProps.filterErrorInfo === nextProps.filterErrorInfo
  );
});

ContextManager.displayName = 'ContextManager';
