import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useTranslation } from 'react-i18next';
import { Input, Button, Empty } from 'antd';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { Search, Sort, SortAsc } from 'refly-icons';
import {
  EndMessage,
  Spinner,
} from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import InfiniteScroll from 'react-infinite-scroll-component';
import { AppCard } from './app-card';
import './index.scss';
import { ListOrder } from '@refly/openapi-schema';
import { useDebouncedCallback } from 'use-debounce';
import { TemplateCardSkeleton } from '../canvas-template/template-card-skeleton';
import { SettingItem } from '@refly-packages/ai-workspace-common/components/canvas/front-page';

export const AppManager = () => {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = useState('');
  const [orderType, setOrderType] = useState<ListOrder>('creationDesc');

  const { setDataList, loadMore, reload, dataList, hasMore, isRequesting } = useFetchDataList({
    fetchData: async (queryPayload) => {
      const res = await getClient().listWorkflowApps({
        query: {
          ...queryPayload,
          order: orderType,
          keyword: debouncedSearchValue?.trim() || undefined,
        },
      });
      return res?.data ?? { success: true, data: [] };
    },
    pageSize: 20,
    dependencies: [orderType, debouncedSearchValue],
  });

  // Debounce search value changes
  const debouncedSetSearchValue = useDebouncedCallback((value: string) => {
    setDebouncedSearchValue(value);
  }, 300);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value);
      debouncedSetSearchValue(value);
    },
    [debouncedSetSearchValue],
  );

  const handleOrderType = useCallback(() => {
    setOrderType(orderType === 'creationAsc' ? 'creationDesc' : 'creationAsc');
  }, [orderType]);

  const appCards = useMemo(() => {
    return dataList?.map((item) => (
      <AppCard
        key={item.appId}
        data={item}
        onDelete={() => setDataList(dataList.filter((n) => n.appId !== item.appId))}
      />
    ));
  }, [dataList, setDataList]);

  useEffect(() => {
    reload();
  }, []);

  const emptyState = (
    <div className="h-full flex items-center justify-center">
      <Empty
        description={
          <div className="text-refly-text-2 leading-5 text-sm">
            {searchValue ? t('appManager.noSearchResults') : t('appManager.noApps')}
          </div>
        }
        image={EmptyImage}
        imageStyle={{ width: 180, height: 180 }}
      />
    </div>
  );

  return (
    <div className="app-manager-list w-full h-full flex flex-col overflow-hidden rounded-xl border border-solid border-refly-Card-Border bg-refly-bg-main-z1">
      {/* Header */}
      <div className="flex items-center justify-between p-4 gap-2">
        <div className="text-[16px] font-semibold">{t('appManager.title')}</div>

        {/* Search and Actions Bar */}
        <div className="flex items-center justify-between gap-3">
          <Input
            placeholder={t('appManager.searchApps')}
            suffix={<Search size={16} color="var(--refly-text-2)" />}
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="max-w-md"
            allowClear
          />

          <Button
            className="flex-shrink-0 w-8 h-8 p-0 flex items-center justify-center"
            onClick={handleOrderType}
          >
            {orderType === 'creationAsc' ? (
              <SortAsc size={20} color="var(--refly-text-0)" />
            ) : (
              <Sort size={20} color="var(--refly-text-0)" />
            )}
          </Button>
          <div className="group relative">
            <SettingItem showName={false} avatarAlign={'right'} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden pb-6 px-4">
        {isRequesting && dataList.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 20 }).map((_, index) => (
              <TemplateCardSkeleton key={index} className="!m-0" />
            ))}
          </div>
        ) : (
          <div id="workflowAppScrollableDiv" className="w-full h-full overflow-y-auto">
            {dataList.length > 0 ? (
              <InfiniteScroll
                dataLength={dataList.length}
                next={loadMore}
                hasMore={hasMore}
                loader={isRequesting ? <Spinner /> : null}
                endMessage={<EndMessage />}
                scrollableTarget="workflowAppScrollableDiv"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {appCards}
                </div>
              </InfiniteScroll>
            ) : (
              emptyState
            )}
          </div>
        )}
      </div>
    </div>
  );
};
