import { memo } from 'react';
import type { ModelInfo } from '@refly/openapi-schema';
import { ModelIcon } from '@lobehub/icons';

interface MediaActionContainerProps {
  modelInfo?: ModelInfo | null;
}

const MediaActionContainerComponent = ({ modelInfo }: MediaActionContainerProps) => {
  return (
    <div
      className="border-[1px] border-solid border-b-0 border-x-0 border-refly-Card-Border pt-3"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {modelInfo ? (
        <div className="w-full px-3 pt-3 rounded-b-xl flex items-center text-refly-text-1 text-xs gap-1 pb-3">
          <ModelIcon size={16} model={modelInfo.name} type="color" />
          <div className="flex-1 truncate">{modelInfo.label}</div>
        </div>
      ) : null}
    </div>
  );
};

export const MediaActionContainer = memo(MediaActionContainerComponent);

MediaActionContainer.displayName = 'MediaActionContainer';

export default MediaActionContainer;
