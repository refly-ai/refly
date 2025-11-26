import { useEffect, useCallback, useMemo, memo } from 'react';
import { Empty, Button } from 'antd';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Spinner } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { useTranslation } from 'react-i18next';
import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useCanvasTemplateModal } from '@refly/stores';
import { TemplateCard } from './template-card';
import { TemplateCardSkeleton } from './template-card-skeleton';

import cn from 'classnames';

// Marketplace link
const MARKETPLACE_LINK = 'https://refly.ai/workflow-marketplace';

// Custom EndMessage component for template list
const EndMessage = memo(() => {
  const { t } = useTranslation();

  const handleGoToMarketplace = useCallback(() => {
    window.open(MARKETPLACE_LINK, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <p className="text-sm text-refly-text-1 text-center mb-6">
        {t('frontPage.template.endMessage.title')}
      </p>
      <Button
        type="text"
        size="large"
        onClick={handleGoToMarketplace}
        className="rounded-2xl bg-transparent border
        border-refly-primary-default !text-refly-primary-default
        font-semibold px-8 py-6 h-10 hover:bg-refly-fill-hover
        hover:border-refly-primary-hover hover:text-refly-primary-hover"
      >
        {t('frontPage.template.endMessage.goToMarketplace')}
      </Button>
    </div>
  );
});

EndMessage.displayName = 'EndMessage';

interface TemplateListProps {
  source: 'front-page' | 'template-library';
  language: string;
  categoryId: string;
  searchQuery?: string;
  scrollableTargetId: string;
  className?: string;
  gridCols?: string;
}

export const TemplateList = ({
  source,
  language,
  categoryId,
  searchQuery,
  scrollableTargetId,
  className,
  gridCols,
}: TemplateListProps) => {
  const gridClassName =
    gridCols || 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2';
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
          scope: categoryId === 'my-templates' ? 'private' : 'public',
          searchQuery,
          ...queryPayload,
        },
      });
      return res?.data ?? { success: true, data: [] };
    },
    pageSize: 20,
    dependencies: [language, categoryId, searchQuery],
  });

  useEffect(() => {
    if (source === 'front-page') return;
    visible ? reload() : setDataList([]);
  }, [visible]);

  const templateCards = useMemo(() => {
    return dataList?.map((item) => <TemplateCard key={item.templateId} template={item} />);
  }, [dataList]);

  const handleLoadMore = useCallback(() => {
    if (!isRequesting && hasMore) {
      loadMore();
    }
  }, [isRequesting, hasMore, loadMore]);

  const emptyState = (
    <div className="mt-8 h-full flex items-center justify-center">
      <Empty description={t('template.emptyList')} />
    </div>
  );

  return (
    <div
      id={source === 'front-page' ? scrollableTargetId : undefined}
      className={cn('w-full h-full overflow-y-auto bg-gray-100 p-4 dark:bg-gray-700', className)}
    >
      {isRequesting && dataList.length === 0 ? (
        <div className={cn('grid', gridClassName)}>
          {Array.from({ length: 20 }).map((_, index) => (
            <TemplateCardSkeleton key={index} />
          ))}
        </div>
      ) : dataList.length > 0 ? (
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
            <div className={cn('grid', gridClassName)}>{templateCards}</div>
          </InfiniteScroll>
        </div>
      ) : (
        emptyState
      )}
    </div>
  );
};
