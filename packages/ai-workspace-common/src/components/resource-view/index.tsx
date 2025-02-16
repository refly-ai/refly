import { Button, Skeleton, Empty, Alert } from 'antd';
import { useEffect, useState, memo, useCallback } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { IconLoading, IconRefresh } from '@arco-design/web-react/icon';
import { IconQuote } from '@refly-packages/ai-workspace-common/components/common/icon';
import { ResourceIcon } from '@refly-packages/ai-workspace-common/components/common/resourceIcon';
import { genUniqueId } from '@refly-packages/utils/id';
import { SelectionContext } from '@refly-packages/ai-workspace-common/modules/selection-menu/selection-context';
import { useGetResourceDetail } from '@refly-packages/ai-workspace-common/queries';
import { Resource } from '@refly/openapi-schema';

import './index.scss';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useCanvasId } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-id';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';

interface ResourceViewProps {
  resourceId: string;
  nodeId: string;
  deckSize: number;
  setDeckSize: (size: number) => void;
}

const _TopBar = memo(
  ({ deckSize, setDeckSize }: { deckSize: number; setDeckSize: (size: number) => void }) => {
    return (
      <div className="w-[90%] pt-2 pb-2 mx-auto flex justify-end items-center">
        <Button
          type="text"
          size="small"
          style={{ color: deckSize ? 'rgb(var(--primary-6))' : '#000' }}
          icon={<IconQuote />}
          onClick={() => {
            setDeckSize(deckSize ? 0 : 200);
          }}
        />
      </div>
    );
  },
);

const ResourceMeta = memo(
  ({
    resourceDetail,
    isReindexing,
    onReindex,
  }: {
    resourceDetail: Resource;
    isReindexing: boolean;
    onReindex: (resourceId: string) => void;
  }) => {
    const { t, i18n } = useTranslation();
    const language = i18n.languages?.[0];

    return (
      <div className="knowledge-base-resource-meta">
        {['wait_parse', 'parse_failed', 'wait_index', 'index_failed'].includes(
          resourceDetail?.indexStatus,
        ) && (
          <Alert
            className="py-[8px] px-[15px] !items-center"
            style={{ marginBottom: 16 }}
            type={
              ['wait_index', 'wait_parse'].includes(resourceDetail?.indexStatus)
                ? 'warning'
                : 'error'
            }
            showIcon
            icon={
              ['wait_index', 'wait_parse'].includes(resourceDetail?.indexStatus) ? (
                <IconLoading />
              ) : null
            }
            description={
              t(`resource.${resourceDetail?.indexStatus}`) +
              (['wait_index', 'index_failed'].includes(resourceDetail?.indexStatus)
                ? `: ${t(`resource.${resourceDetail?.indexStatus}_tip`)}`
                : '')
            }
            action={
              ['index_failed', 'parse_failed'].includes(resourceDetail?.indexStatus) ? (
                <Button
                  size="small"
                  loading={isReindexing}
                  icon={<IconRefresh />}
                  className="retry-btn"
                  onClick={() => onReindex(resourceDetail.resourceId)}
                >
                  {t('common.retry')}
                </Button>
              ) : null
            }
          />
        )}

        <div className="knowledge-base-directory-site-intro">
          <div className="site-intro-icon flex justify-center items-center">
            <ResourceIcon
              url={resourceDetail?.data?.url}
              resourceType={resourceDetail?.resourceType}
              extension={resourceDetail?.rawFileKey?.split('.').pop()}
              size={24}
            />
          </div>
          <div className="site-intro-content flex flex-col justify-center">
            {resourceDetail?.resourceType === 'file' && resourceDetail?.data?.title && (
              <p className="site-intro-site-name text-gray-700 font-medium">
                {resourceDetail?.data?.title}
              </p>
            )}
            {resourceDetail?.data?.url && (
              <a
                className="site-intro-site-url no-underline text-[#00968F]"
                href={resourceDetail?.data?.url}
                target="_blank"
                rel="noreferrer"
              >
                {resourceDetail?.data?.url}
              </a>
            )}
            {resourceDetail?.createdAt && (
              <p className="site-intro-site-name text-gray-400">
                {time(resourceDetail?.createdAt, language as LOCALE)
                  .utc()
                  .fromNow()}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.resourceDetail?.resourceId === nextProps.resourceDetail?.resourceId &&
      prevProps.resourceDetail?.indexStatus === nextProps.resourceDetail?.indexStatus &&
      prevProps.isReindexing === nextProps.isReindexing
    );
  },
);

const ResourceContent = memo(
  ({
    resourceDetail,
    resourceId,
  }: {
    resourceDetail: Resource;
    resourceId: string;
  }) => {
    const buildContextItem = useCallback(
      (text: string) => {
        return {
          type: 'resourceSelection',
          entityId: genUniqueId(),
          title: text.slice(0, 50),
          selection: {
            content: text,
            sourceTitle: resourceDetail.title,
            sourceEntityId: resourceDetail.resourceId,
            sourceEntityType: 'resource',
          },
        } as IContextItem;
      },
      [resourceDetail],
    );

    const getSourceNode = useCallback(() => {
      return {
        type: 'resource' as const,
        entityId: resourceId,
      };
    }, [resourceId]);

    return (
      <div className={classNames(`knowledge-base-resource-content resource-content-${resourceId}`)}>
        <div className="knowledge-base-resource-content-title">{resourceDetail?.title}</div>
        <Markdown content={resourceDetail?.content || ''} className="text-base" />
        <SelectionContext
          containerClass={`resource-content-${resourceId}`}
          getContextItem={buildContextItem}
          getSourceNode={getSourceNode}
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.resourceDetail?.resourceId === nextProps.resourceDetail?.resourceId &&
      prevProps.resourceDetail?.content === nextProps.resourceDetail?.content
    );
  },
);

export const ResourceView = memo(
  (props: ResourceViewProps) => {
    const { resourceId, nodeId } = props;
    const { t } = useTranslation();
    const [isReindexing, setIsReindexing] = useState(false);
    const { updateNodePreviewRawFileKey } = useCanvasStoreShallow((state) => ({
      updateNodePreviewRawFileKey: state.updateNodePreviewRawFileKey,
    }));
    const canvasId = useCanvasId();
    const {
      data,
      refetch: refetchResourceDetail,
      isLoading,
    } = useGetResourceDetail({ query: { resourceId } }, null, {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    });
    const { data: resourceDetail } = data || {};

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
      if (['wait_parse', 'wait_index'].includes(resourceDetail?.indexStatus)) {
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

    useEffect(() => {
      if (resourceDetail?.resourceType === 'file' && resourceDetail?.rawFileKey) {
        updateNodePreviewRawFileKey(canvasId, nodeId, resourceDetail?.rawFileKey);
      }
    }, [resourceDetail, canvasId, nodeId, resourceId, updateNodePreviewRawFileKey]);

    if (!resourceId) {
      return (
        <div className="w-full h-full flex justify-center items-center">
          <Empty description={t('common.empty')} />
        </div>
      );
    }

    return (
      <div className="knowledge-base-resource-detail-container pt-[16px]">
        <div className="knowledge-base-resource-detail-body">
          {isLoading ? (
            <div className="knowledge-base-resource-skeleton">
              <Skeleton active style={{ marginTop: 24 }} />
              <Skeleton active style={{ marginTop: 24 }} />
              <Skeleton active style={{ marginTop: 24 }} />
              <Skeleton active style={{ marginTop: 24 }} />
            </div>
          ) : (
            <>
              <ResourceMeta
                resourceDetail={resourceDetail}
                isReindexing={isReindexing}
                onReindex={handleReindexResource}
              />
              <ResourceContent resourceDetail={resourceDetail} resourceId={resourceId} />
            </>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.resourceId === nextProps.resourceId,
);
