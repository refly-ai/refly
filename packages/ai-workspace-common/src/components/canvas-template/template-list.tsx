import { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { Empty, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useCanvasTemplateModal } from '@refly/stores';
import { TemplateCard } from './template-card';
import { TemplateCardSkeleton } from './template-card-skeleton';

import cn from 'classnames';

const MAX_DISPLAY_COUNT = 12;

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
  const [displayDataList, setDisplayDataList] = useState<any[]>([]);
  const [isFading, setIsFading] = useState(false);
  const prevCategoryIdRef = useRef(categoryId);

  const { dataList, reload, isRequesting, setDataList } = useFetchDataList({
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

  // Handle smooth transition when category changes
  useEffect(() => {
    const categoryChanged = prevCategoryIdRef.current !== categoryId;

    if (categoryChanged && prevCategoryIdRef.current && displayDataList.length > 0) {
      // Category changed and we have existing data, wait for new data to load
      if (dataList.length > 0 && !isRequesting) {
        // New data is ready, start fade out
        setIsFading(true);
        // After fade out, update display data and fade in
        const timer = setTimeout(() => {
          setDisplayDataList(dataList);
          setIsFading(false);
          prevCategoryIdRef.current = categoryId;
        }, 200);
        return () => clearTimeout(timer);
      }
      // If still loading, keep old data visible (don't update displayDataList)
    } else if (!categoryChanged) {
      // Category hasn't changed, update display data normally
      if (dataList.length > 0 || (dataList.length === 0 && !isRequesting)) {
        setDisplayDataList(dataList);
        setIsFading(false);
      }
    } else {
      // Initial load or no previous category
      if (dataList.length > 0 || (dataList.length === 0 && !isRequesting)) {
        setDisplayDataList(dataList);
        prevCategoryIdRef.current = categoryId;
        setIsFading(false);
      }
    }
  }, [categoryId, dataList, isRequesting, displayDataList.length]);

  useEffect(() => {
    if (source === 'front-page') return;
    visible ? reload() : setDataList([]);
  }, [visible]);

  // Limit display to MAX_DISPLAY_COUNT templates
  const displayedTemplates = useMemo(() => {
    return displayDataList?.slice(0, MAX_DISPLAY_COUNT) ?? [];
  }, [displayDataList]);

  const hasMoreTemplates = useMemo(() => {
    return (displayDataList?.length ?? 0) > MAX_DISPLAY_COUNT;
  }, [displayDataList]);

  const templateCards = useMemo(() => {
    return displayedTemplates?.map((item) => (
      <TemplateCard key={item.templateId} template={item} />
    ));
  }, [displayedTemplates]);

  const emptyState = (
    <div className="mt-8 h-full flex items-center justify-center">
      <Empty description={t('template.emptyList')} />
    </div>
  );

  const handleGoToMarketplace = useCallback(() => {
    window.open('/workflow-marketplace', '_blank');
  }, []);

  const viewMoreSection = (
    <div className="flex flex-col items-center gap-4 mt-[50px]">
      <div className="text-base text-center text-refly-text-0 font-normal leading-[26px]">
        {t('template.notFoundQuestion')}
      </div>
      <Button
        type="default"
        className="!bg-refly-bg-content-z2 !border-refly-primary-default !text-refly-primary-default !border-[0.5px] !font-medium hover:!border-refly-primary-default hover:!text-refly-primary-default hover:!bg-refly-bg-content-z2 rounded-lg px-3 py-2.5"
        onClick={handleGoToMarketplace}
      >
        {t('template.goToMarketplace')}
      </Button>
    </div>
  );

  return (
    <div
      id={source === 'front-page' ? scrollableTargetId : undefined}
      className={cn('w-full h-full overflow-y-auto bg-gray-100 p-4 dark:bg-gray-700', className)}
    >
      {isRequesting && displayDataList.length === 0 ? (
        <div className={cn('grid', gridClassName)}>
          {Array.from({ length: 20 }).map((_, index) => (
            <TemplateCardSkeleton key={index} />
          ))}
        </div>
      ) : displayDataList.length > 0 ? (
        <div
          id={source === 'template-library' ? scrollableTargetId : undefined}
          className={cn(
            'w-full h-full overflow-y-auto transition-opacity duration-300 ease-in-out',
            isFading ? 'opacity-0' : 'opacity-100',
          )}
        >
          <div className={cn('grid', gridClassName)}>{templateCards}</div>
          {hasMoreTemplates && viewMoreSection}
        </div>
      ) : (
        emptyState
      )}
    </div>
  );
};
