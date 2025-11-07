import { Button, Skeleton, Empty, Result } from 'antd';
import { useEffect, useState, memo, useCallback, useMemo } from 'react';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { ReloadOutlined } from '@ant-design/icons';
import { IconSubscription } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useGetResourceDetail } from '@refly-packages/ai-workspace-common/queries';
import { IndexError, Resource } from '@refly/openapi-schema';
import { ResourceContent } from './resource-content';
import { ResourceMeta } from './resource-meta';

import './index.scss';
import { useSubscriptionStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { logEvent } from '@refly/telemetry-web';

interface ResourceViewProps {
  resourceId: string;
  shareId?: string;
  nodeId: string;
  hideMeta?: boolean;
}

const genIndexErrorSubTitle = (indexError: IndexError, t: TFunction) => {
  if (indexError?.type === 'pageLimitExceeded') {
    return t('resource.pageLimitExceeded', {
      numPages: indexError.metadata?.numPages,
      used: indexError.metadata?.pageUsed,
      limit: indexError.metadata?.pageLimit,
    });
  }
  return t('resource.unknownError');
};

export const ResourceView = memo(
  (props: ResourceViewProps) => {
    const { resourceId, shareId, hideMeta } = props;
    const { readonly } = useCanvasContext();
    const { t } = useTranslation();
    const [isReindexing, setIsReindexing] = useState(false);
    const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
      setSubscribeModalVisible: state.setSubscribeModalVisible,
    }));

    const {
      data,
      refetch: refetchResourceDetail,
      isLoading,
    } = useGetResourceDetail({ query: { resourceId } }, undefined, {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      enabled: !shareId,
    });
    const { data: shareData } = useFetchShareData<Resource>(shareId);
    const resourceDetail = useMemo(() => shareData || data?.data || null, [shareData, data]);
    const indexStatus = resourceDetail?.indexStatus ?? 'finish';

    const handleReindexResource = useCallback(
      async (resourceId: string) => {
        if (!resourceId || isReindexing) return;

        setIsReindexing(true);
        const { data, error } = await getClient().reindexResource({
          body: {
            resourceIds: [resourceId],
          },
        });
        setIsReindexing(false);

        if (error || !data?.success) {
          return;
        }
        refetchResourceDetail();
      },
      [isReindexing, refetchResourceDetail],
    );

    useEffect(() => {
      let intervalId: NodeJS.Timeout;
      if (['wait_parse', 'wait_index'].includes(indexStatus)) {
        intervalId = setInterval(() => {
          refetchResourceDetail();
        }, 2000);
      }
      return () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }, [resourceDetail?.indexStatus, refetchResourceDetail]);

    const handleClickUpgrade = useCallback(() => {
      logEvent('subscription::upgrade_click', 'parse_page_limit_exceeded');
      setSubscribeModalVisible(true);
    }, [setSubscribeModalVisible]);

    if (!resourceId) {
      return (
        <div className="w-full h-full flex justify-center items-center">
          <Empty description={t('common.empty')} />
        </div>
      );
    }

    return (
      <div className="knowledge-base-resource-detail-container p-3">
        {isLoading || !resourceDetail ? (
          <div className="knowledge-base-resource-skeleton">
            <Skeleton active style={{ marginTop: 24 }} />
            <Skeleton active style={{ marginTop: 24 }} />
            <Skeleton active style={{ marginTop: 24 }} />
            <Skeleton active style={{ marginTop: 24 }} />
          </div>
        ) : (
          <>
            {!hideMeta && (
              <ResourceMeta
                resourceDetail={resourceDetail}
                isReindexing={isReindexing}
                onReindex={handleReindexResource}
              />
            )}
            {resourceDetail?.indexStatus === 'parse_failed' ? (
              <div className="w-full h-full flex justify-center items-center">
                <Result
                  status="500"
                  title={t('resource.parse_failed')}
                  subTitle={genIndexErrorSubTitle(resourceDetail?.indexError ?? {}, t)}
                  extra={
                    !readonly && (
                      <div className="flex justify-center items-center gap-2">
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => handleReindexResource(resourceId)}
                        >
                          {t('common.retry')}
                        </Button>
                        {resourceDetail?.indexError?.type === 'pageLimitExceeded' && (
                          <Button
                            type="primary"
                            icon={<IconSubscription />}
                            onClick={handleClickUpgrade}
                          >
                            {t('common.upgradeSubscription')}
                          </Button>
                        )}
                      </div>
                    )
                  }
                />
              </div>
            ) : (
              <ResourceContent resourceDetail={resourceDetail} resourceId={resourceId} />
            )}
          </>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.resourceId === nextProps.resourceId,
);
