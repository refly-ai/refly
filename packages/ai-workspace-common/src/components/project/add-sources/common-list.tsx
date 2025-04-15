import { useFetchDataList } from '@refly-packages/ai-workspace-common/hooks/use-fetch-data-list';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Checkbox } from 'antd';
import React from 'react';
import { SelectedItems } from './index';
import { useTranslation } from 'react-i18next';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Spinner } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { EndMessage } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';

export type FetchDataFn = (queryPayload: { pageSize: number; page: number }) => Promise<{
  data?: any[];
  success: boolean;
}>;

export interface CommonListItem {
  id: string;
  title?: string;
}

interface CommonListProps {
  visible: boolean;
  selectedItems: SelectedItems[];
  existingItems: string[];
  onSelectedItemsChange: (selectedItems: SelectedItems[]) => void;
  fetchData: FetchDataFn;
  entityType: 'document' | 'resource' | 'canvas';
  scrollableId: string;
  idField: string;
}

const CommonListComponent = ({
  visible,
  selectedItems,
  onSelectedItemsChange,
  existingItems,
  fetchData,
  entityType,
  scrollableId,
  idField,
}: CommonListProps) => {
  const { t } = useTranslation();
  const [checkedValues, setCheckedValues] = useState<string[]>([]);

  const { dataList, loadMore, reload, hasMore, isRequesting, setDataList } = useFetchDataList({
    fetchData,
    pageSize: 20,
  });

  const handleItemSelect = useCallback(
    (ids: string[]) => {
      setCheckedValues(ids);
      onSelectedItemsChange(ids.map((id) => ({ entityType, entityId: id })));
    },
    [onSelectedItemsChange, entityType],
  );

  const listItems = useMemo(() => {
    return (
      <Checkbox.Group
        className="w-full flex flex-col gap-2"
        value={checkedValues}
        options={dataList?.map((item) => ({
          label: item.title || t('common.untitled'),
          value: item[idField],
          disabled: existingItems.includes(item[idField]),
        }))}
        onChange={(values) => {
          handleItemSelect(values as string[]);
        }}
      >
        {dataList?.map((item) => (
          <Checkbox
            value={item[idField]}
            key={item[idField]}
            disabled={existingItems.includes(item[idField])}
          >
            {item.title || t('common.untitled')}
          </Checkbox>
        ))}
      </Checkbox.Group>
    );
  }, [dataList, t, existingItems, handleItemSelect, checkedValues, idField]);

  const emptyState = useMemo(() => {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        {t('common.noData')}
      </div>
    );
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isRequesting && hasMore) {
      loadMore();
    }
  }, [isRequesting, hasMore, loadMore]);

  useEffect(() => {
    const ids = selectedItems?.map((item) => item.entityId) || [];
    setCheckedValues(ids);
  }, [selectedItems]);

  useEffect(() => {
    if (visible) {
      reload();
    } else {
      setCheckedValues([]);
      setDataList([]);
    }
  }, [visible]);

  return (
    <Spin className="w-full h-full" spinning={isRequesting && dataList?.length === 0}>
      <div id={scrollableId} className="source-list w-full overflow-y-auto">
        {dataList?.length > 0 ? (
          <InfiniteScroll
            dataLength={dataList?.length ?? 0}
            next={handleLoadMore}
            hasMore={hasMore}
            loader={<Spinner />}
            endMessage={<EndMessage />}
            scrollableTarget={scrollableId}
          >
            {listItems}
          </InfiniteScroll>
        ) : (
          !isRequesting && emptyState
        )}
      </div>
    </Spin>
  );
};

export const CommonList = React.memo(CommonListComponent);
