import { memo, useMemo } from 'react';
import { type NodeRelation } from './ArtifactRenderer';
import { useGetResourceDetail } from '@refly-packages/ai-workspace-common/queries';
import { Skeleton } from 'antd';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';

const ResourceRenderer = memo(
  ({
    node,
    isFullscreen = false,
    isMinimap = false,
  }: {
    node: NodeRelation;
    isFullscreen?: boolean;
    isMinimap?: boolean;
  }) => {
    const resourceId = node.nodeData?.entityId ?? '';
    const { shareId } = node.nodeData?.metadata || {};
    const { data: shareData, loading: isShareLoading } = useFetchShareData(shareId);
    const { data, isLoading: isRemoteLoading } = useGetResourceDetail(
      { query: { resourceId } },
      undefined,
      {
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        enabled: Boolean(!shareId && !!node.nodeData?.entityId),
      },
    );
    const resourceDetail = useMemo(() => shareData || data?.data || null, [shareData, data]);
    const isLoading = isRemoteLoading || isShareLoading;

    return (
      <div
        className={`h-full bg-white dark:bg-gray-900 ${!isFullscreen ? 'rounded' : 'w-full'} ${
          isMinimap ? 'p-1' : ''
        }`}
      >
        <div className="h-full w-full overflow-auto">
          {isLoading ? (
            <Skeleton active style={{ marginTop: 24 }} />
          ) : (
            <Markdown
              content={resourceDetail?.content || ''}
              className="text-base p-4 dark:text-gray-200"
            />
          )}
        </div>
      </div>
    );
  },
);

export { ResourceRenderer };
