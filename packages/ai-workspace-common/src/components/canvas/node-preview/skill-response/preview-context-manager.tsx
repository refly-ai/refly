import { IContextItem } from '@refly/common-types';
import { ContextItem } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager/context-item';
import { memo, useMemo } from 'react';
import './index.scss';

interface PreviewContextManagerProps {
  contextItems: IContextItem[];
}

const PreviewContextManagerComponent = (props: PreviewContextManagerProps) => {
  const { contextItems } = props;

  const renderedContextItems = useMemo(
    () =>
      contextItems?.length > 0
        ? contextItems.map((item, index) => (
            <ContextItem
              canNotRemove={true}
              key={`${item.entityId}-${index}`}
              item={item}
              isLimit={false}
              isActive={false}
            />
          ))
        : null,
    [contextItems],
  );

  return (
    <div className="flex flex-col pt-2 pb-0 px-3 launchpad-context-manager">
      <div className="flex flex-col context-content">
        <div className="flex flex-wrap content-start gap-1 w-full context-items-container">
          {renderedContextItems}
        </div>
      </div>
    </div>
  );
};

export const PreviewContextManager = memo(
  PreviewContextManagerComponent,
  (prevProps, nextProps) => {
    return prevProps.contextItems === nextProps.contextItems;
  },
);
