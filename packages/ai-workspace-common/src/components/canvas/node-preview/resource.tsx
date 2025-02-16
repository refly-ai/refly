import { useState, memo } from 'react';
import { ResourceView } from '@refly-packages/ai-workspace-common/components/resource-view';

interface ResourceNodePreviewProps {
  resourceId?: string;
  nodeId: string;
}

const ResourceNodePreviewComponent = ({ resourceId, nodeId }: ResourceNodePreviewProps) => {
  const [deckSize, setDeckSize] = useState<number>(0);

  if (!resourceId) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded p-3">
        <span className="text-gray-500">No resource selected</span>
      </div>
    );
  }

  return (
    <div className="h-full bg-white rounded">
      <ResourceView
        resourceId={resourceId}
        deckSize={deckSize}
        setDeckSize={setDeckSize}
        nodeId={nodeId}
      />
    </div>
  );
};

export const ResourceNodePreview = memo(
  ResourceNodePreviewComponent,
  (prevProps, nextProps) => prevProps.resourceId === nextProps.resourceId,
);
