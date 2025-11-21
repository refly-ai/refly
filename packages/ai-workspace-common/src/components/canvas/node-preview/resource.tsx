import { memo, useMemo } from 'react';
import { ResourceView } from '@refly-packages/ai-workspace-common/components/resource-view';
import { FollowingActions } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/sharedComponents/following-actions';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import type { IContextItem } from '@refly/common-types';
import type { CanvasNode, ResourceNodeMeta } from '@refly/canvas-common';
import { useTranslation } from 'react-i18next';

interface ResourceNodePreviewProps {
  node: CanvasNode<ResourceNodeMeta>;
  resourceId: string;
  hideMeta?: boolean;
}

const ResourceNodePreviewComponent = ({ node, resourceId, hideMeta }: ResourceNodePreviewProps) => {
  const { t } = useTranslation();
  const { readonly } = useCanvasContext();
  const initContextItems: IContextItem[] = useMemo(() => {
    return [
      {
        type: 'resource' as const,
        entityId: node.data?.entityId,
        title: node.data?.title,
        metadata: node.data?.metadata,
      },
    ];
  }, [node.data?.entityId, node.data?.title, node.data?.metadata]);

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
      {!readonly && (
        <div className="py-3 border-[1px] border-solid border-refly-Card-Border border-x-0 border-b-0">
          <FollowingActions
            initContextItems={initContextItems}
            initModelInfo={null}
            nodeId={node.id}
          />
        </div>
      )}
    </div>
  );
};

export const ResourceNodePreview = memo(ResourceNodePreviewComponent);
