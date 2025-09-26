import { useEffect, useCallback, useMemo } from 'react';
import { Empty } from 'antd';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import InfiniteScroll from 'react-infinite-scroll-component';
import {
  Spinner,
  EndMessage,
} from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { useTranslation } from 'react-i18next';
import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useCanvasTemplateModal } from '@refly/stores';
import { useDebouncedCallback } from 'use-debounce';
import { TemplateCard } from './template-card';

import cn from 'classnames';

interface TemplateListProps {
  source: 'front-page' | 'template-library';
  language: string;
  categoryId: string;
  searchQuery?: string;
  scrollableTargetId: string;
  className?: string;
}

export const TemplateList = ({
  source,
  language,
  categoryId,
  searchQuery,
  scrollableTargetId,
  className,
}: TemplateListProps) => {
  const { t } = useTranslation();
  const { visible } = useCanvasTemplateModal((state) => ({
    visible: state.visible,
  }));
  const { dataList, loadMore, reload, hasMore, isRequesting, setDataList } = useFetchDataList({
    fetchData: async (queryPayload) => {
      const res = await getClient().listCanvasTemplates({
        query: {
          language,
          categoryId: categoryId === 'my-templates' ? undefined : categoryId,
          scope: categoryId === 'my-templates' ? 'private' : 'private',
          ...queryPayload,
        },
      });
      return res?.data ?? { success: true, data: [] };
    },
    pageSize: 12,
  });

  useEffect(() => {
    if (!visible && source === 'template-library') return;
    reload();
  }, [language, categoryId]);

  useEffect(() => {
    if (source === 'front-page') return;
    visible ? reload() : setDataList([]);
  }, [visible]);

  const debounced = useDebouncedCallback(() => {
    reload();
  }, 300);

  useEffect(() => {
    debounced();
  }, [searchQuery]);

  const templateCards = useMemo(() => {
    return dataList?.map((item) => <TemplateCard key={item.templateId} template={item} />);
  }, [dataList]);

  const handleLoadMore = useCallback(() => {
    if (!isRequesting && hasMore) {
      loadMore();
    }
  }, [isRequesting, hasMore, loadMore]);

  const emptyState = (
    <div className="h-full flex items-center justify-center">
      <Empty description={t('template.emptyList')} />
    </div>
  );

  return (
    <div
      id={source === 'front-page' ? scrollableTargetId : undefined}
      className={cn('w-full h-full overflow-y-auto bg-gray-100 p-4 dark:bg-gray-700', className)}
    >
      <Spin className="spin" spinning={isRequesting && dataList.length === 0}>
        {dataList.length > 0 ? (
          <div
            id={source === 'template-library' ? scrollableTargetId : undefined}
            className="w-full h-full overflow-y-auto"
          >
            <InfiniteScroll
              dataLength={dataList.length}
              next={handleLoadMore}
              hasMore={hasMore}
              loader={<Spinner />}
              endMessage={<EndMessage />}
              scrollableTarget={scrollableTargetId}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {templateCards}
              </div>
            </InfiniteScroll>
          </div>
        ) : (
          !isRequesting && emptyState
        )}
      </Spin>
    </div>
  );
};
