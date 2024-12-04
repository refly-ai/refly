import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { IconLoading, IconRefresh } from '@arco-design/web-react/icon';
import { IconQuote } from '@refly-packages/ai-workspace-common/components/common/icon';

// 自定义样式
import './index.scss';
import { Skeleton, Empty, Alert } from 'antd';
import { Button } from 'antd';
// 请求
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

import { useEffect, useState } from 'react';

// content selector
import '@refly-packages/ai-workspace-common/modules/content-selector/styles/content-selector.scss';
import classNames from 'classnames';
import { useContentSelectorStoreShallow } from '@refly-packages/ai-workspace-common/modules/content-selector/stores/content-selector';
import { useTranslation } from 'react-i18next';

import { useSelectedMark } from '@refly-packages/ai-workspace-common/modules/content-selector/hooks/use-selected-mark';
import { ResourceIcon } from '@refly-packages/ai-workspace-common/components/common/resourceIcon';
import { useContextPanelStore } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { genUniqueId } from '@refly-packages/utils/id';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { SelectionContext } from '@refly-packages/ai-workspace-common/components/selection-context';
import { useGetResourceDetail } from '@refly-packages/ai-workspace-common/queries';

interface ResourceViewProps {
  resourceId: string;
  deckSize: number;
  setDeckSize: (size: number) => void;
}

export const ResourceView = (props: ResourceViewProps) => {
  const { resourceId, deckSize, setDeckSize } = props;

  const { t } = useTranslation();

  const { data, refetch: refetchResourceDetail, isLoading } = useGetResourceDetail({ query: { resourceId } });
  const { data: resourceDetail } = data || {};

  const { showContentSelector, scope } = useContentSelectorStoreShallow((state) => ({
    showContentSelector: state.showContentSelector,
    scope: state.scope,
  }));

  const [isReindexing, setIsReindexing] = useState(false);
  const handleReindexResource = async (resourceId: string) => {
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
  };

  const { handleInitContentSelectorListener } = useSelectedMark();

  const { addContextItem } = useContextPanelStore((state) => ({
    addContextItem: state.addContextItem,
  }));

  const buildNodeData = (text: string) => {
    const id = genUniqueId();

    const node: CanvasNode = {
      id,
      type: 'resource',
      position: { x: 0, y: 0 },
      data: {
        entityId: resourceDetail.resourceId ?? '',
        title: resourceDetail.title ?? 'Selected Content',
        metadata: {
          contentPreview: text,
          selectedContent: text,
          xPath: id,
          sourceEntityId: resourceDetail.resourceId ?? '',
          sourceEntityType: 'resource',
          sourceType: 'resourceSelection',
        },
      },
    };

    return node;
  };

  // 初始化块选择
  // useEffect(() => {
  //   setDeckSize(0);
  //   if (resource.loading) {
  //     return;
  //   }
  //   const remove = initMessageListener();
  //   handleInitContentSelectorListener();
  //   return () => {
  //     remove();
  //   };
  // }, [resourceId, resource.loading]);

  // refresh every 2 seconds if resource is waiting to be parsed or indexed
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
  }, [resourceDetail?.indexStatus]);

  const TopBar = () => {
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
        ></Button>
      </div>
    );
  };

  return (
    <div className="knowledge-base-resource-detail-container pt-[16px]">
      {resourceId ? (
        <div className="knowledge-base-resource-detail-body">
          {isLoading ? (
            <div className="knowledge-base-resource-skeleton">
              <Skeleton active style={{ marginTop: 24 }}></Skeleton>
              <Skeleton active style={{ marginTop: 24 }}></Skeleton>
              <Skeleton active style={{ marginTop: 24 }}></Skeleton>
              <Skeleton active style={{ marginTop: 24 }}></Skeleton>
            </div>
          ) : (
            <>
              {/* <TopBar /> */}
              <div className="knowledge-base-resource-meta">
                {['wait_parse', 'parse_failed', 'wait_index', 'index_failed'].includes(resourceDetail?.indexStatus) && (
                  <Alert
                    className="py-[8px] px-[15px] !items-center"
                    style={{ marginBottom: 16 }}
                    type={['wait_index', 'wait_parse'].includes(resourceDetail?.indexStatus) ? 'warning' : 'error'}
                    showIcon
                    icon={['wait_index', 'wait_parse'].includes(resourceDetail?.indexStatus) ? <IconLoading /> : null}
                    description={
                      t(`resource.${resourceDetail?.indexStatus}`) +
                      (['wait_index', 'index_failed'].includes(resourceDetail?.indexStatus)
                        ? ': ' + t(`resource.${resourceDetail?.indexStatus}_tip`)
                        : '')
                    }
                    action={
                      ['index_failed', 'parse_failed'].includes(resourceDetail?.indexStatus) ? (
                        <Button
                          size="small"
                          loading={isReindexing}
                          icon={<IconRefresh />}
                          className="retry-btn"
                          onClick={() => handleReindexResource(resourceId)}
                        >
                          {t('common.retry')}
                        </Button>
                      ) : null
                    }
                  />
                )}

                <div className="knowledge-base-directory-site-intro">
                  <div className="site-intro-icon">
                    <ResourceIcon
                      url={resourceDetail?.data?.url}
                      resourceType={resourceDetail?.resourceType}
                      size={24}
                    />
                  </div>
                  <div className="site-intro-content">
                    <p className="site-intro-site-name">{resourceDetail?.data?.title}</p>
                    <a className="site-intro-site-url" href={resourceDetail?.data?.url} target="_blank">
                      {resourceDetail?.data?.url}
                    </a>
                  </div>
                </div>
                {/* {resourceDetail && <LabelGroup entityId={resourceDetail.resourceId} entityType={'resource'} />} */}
              </div>
              <div
                className={classNames(`knowledge-base-resource-content resource-content-${resourceId}`, {
                  'refly-selector-mode-active': showContentSelector,
                  'refly-block-selector-mode': scope === 'block',
                  'refly-inline-selector-mode': scope === 'inline',
                })}
              >
                {/* {initContentSelectorElem()} */}
                <div className="knowledge-base-resource-content-title">{resourceDetail?.title}</div>
                <Markdown content={resourceDetail?.content || ''}></Markdown>
                <SelectionContext
                  containerClass={`resource-content-${resourceId}`}
                  getNodeData={(text) => buildNodeData(text)}
                ></SelectionContext>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="w-full h-full flex justify-center items-center">
          <Empty description={t('common.empty')} />
        </div>
      )}
    </div>
  );
};
