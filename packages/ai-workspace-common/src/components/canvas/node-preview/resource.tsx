import { memo } from 'react';
import { ResourceView } from '@refly-packages/ai-workspace-common/components/resource-view';
import type { CanvasNode, ResourceNodeMeta } from '@refly/canvas-common';
import { useTranslation } from 'react-i18next';

interface ResourceNodePreviewProps {
  node: CanvasNode<ResourceNodeMeta>;
  resourceId: string;
  hideMeta?: boolean;
}

const ResourceNodePreviewComponent = ({ node, resourceId, hideMeta }: ResourceNodePreviewProps) => {
  const { t } = useTranslation();

  if (!resourceId) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded p-3">
        <span className="text-gray-500">{t('canvas.nodePreview.resource.noContentPreview')}</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="flex-1 pb-4 rounded overflow-y-auto">
        <ResourceView
          resourceId={resourceId}
          nodeId={node.id}
          shareId={node.data?.metadata?.shareId}
          hideMeta={hideMeta}
        />
      </div>
    </div>
  );
};

export const ResourceNodePreview = memo(ResourceNodePreviewComponent);
