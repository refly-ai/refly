import { useState, memo } from 'react';
import { ResourceView } from '@refly-packages/ai-workspace-common/components/resource-view';
import { CanvasNode, ResourceNodeMeta } from '@refly/canvas-common';

interface ResourceNodePreviewProps {
  node: CanvasNode<ResourceNodeMeta>;
  resourceId: string;
}

const ResourceNodePreviewComponent = ({ node, resourceId }: ResourceNodePreviewProps) => {
  const [deckSize, setDeckSize] = useState<number>(0);

  if (!resourceId) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded p-3">
        <span className="text-gray-500">No resource selected</span>
      </div>
    );
  }

  return (
    <div className="h-full pb-4 bg-white dark:bg-gray-900 rounded">
      <ResourceView
        resourceId={resourceId}
        deckSize={deckSize}
        setDeckSize={setDeckSize}
        nodeId={node.id}
        shareId={node.data?.metadata?.shareId}
      />
    </div>
  );
};

export const ResourceNodePreview = memo(
  ResourceNodePreviewComponent,
  (prevProps, nextProps) => prevProps.resourceId === nextProps.resourceId,
);
