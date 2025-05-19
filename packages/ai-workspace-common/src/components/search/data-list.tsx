import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useSearchStore } from '@refly-packages/ai-workspace-common/stores/search';
import { IconFolderAdd } from '@arco-design/web-react/icon';

import './index.scss';
import { Button } from '@arco-design/web-react';
import { Item } from './item';

// request
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { SearchResult } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';

export function DataList({
  domain,
  heading,
  icon,
  data,
  activeValue,
  displayMode,
  setValue,
  onItemClick,
  onCreateClick,
}: {
  domain: string;
  heading: string;
  data: SearchResult[];
  icon: React.ReactNode;
  activeValue: string;
  displayMode: 'list' | 'search';
  setValue: (val: string) => void;
  onItemClick?: (item: SearchResult) => void;
  onCreateClick?: () => void;
}) {
  const [stateDataList, setStateDataList] = useState<SearchResult[]>(data || []);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const { t } = useTranslation();

  const searchStore = useSearchStore();

  const fetchNewData = async (
    queryPayload: any,
  ): Promise<{ success: boolean; data?: SearchResult[] }> => {
    if (domain === 'skill') {
      return { success: true, data: [] };
    }
    if (domain === 'canvas') {
      const res = await getClient().listCanvases({
        query: {
          ...queryPayload,
        },
      });

      if (!res?.data?.success) return { success: false };
      const data = res?.data?.data?.map((item) => {
        return {
          id: item?.canvasId,
          title: item?.title,
          metadata: {},
        } as SearchResult;
      });

      return { success: true, data };
    }
    if (domain === 'readResources') {
      const res = await getClient().listResources({
        query: {
          ...queryPayload,
        },
      });

      if (!res?.data?.success) return { success: false };
      const data = res?.data?.data?.map((item) => {
        return {
          id: item?.resourceId,
          title: item?.title,
          domain: 'resource',
          snippets: [{ text: `${item?.content?.slice(0, 30)}...` }],
          metadata: {
            resourceType: 'weblink',
          },
        } as SearchResult;
      });

      return { success: true, data };
    }
  };

  const loadMore = async (currentPage?: number) => {
    if (isRequesting || !hasMore) return;

    // 获取数据
    const queryPayload = {
      pageSize: 10,
      page: currentPage + 1,
    };

    // 更新页码
    setCurrentPage(currentPage + 1);
    setIsRequesting(true);

    const res = await fetchNewData(queryPayload);

    if (!res?.success) {
      setIsRequesting(false);

      return;
    }

    // 处理分页
    if (res?.data?.length < 10) {
      setHasMore(false);
    }

    console.log('res', res);
    setStateDataList([...stateDataList, ...(res?.data || [])]);
    setIsRequesting(false);
  };

  useEffect(() => {
    setStateDataList(data);
  }, [data]);
  useEffect(() => {
    setValue(`create${domain}`);
  }, [domain, setValue]);

  return (
    <>
      <Command.Group
        heading={t('knowledgeBase.quickSearch.suggest')}
        className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 mb-2"
      >
        <Item
          value={`create${domain}`}
          keywords={[`create${domain}`]}
          onSelect={() => onCreateClick?.()}
          activeValue={activeValue}
        >
          <IconFolderAdd style={{ fontSize: 12 }} />
          {t('knowledgeBase.quickSearch.new', { domain })}
        </Item>
      </Command.Group>
      <Command.Group
        heading={heading}
        className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 mb-2"
      >
        {stateDataList?.map((item, index) => (
          <Item
            key={index}
            value={`${domain}-${index}-${item?.title}-${item?.snippets?.[0]?.text || ''}`}
            activeValue={activeValue}
            onSelect={() => {
              onItemClick?.(item);
              searchStore.setIsSearchOpen(false);
            }}
          >
            {icon}
            <div className="search-res-container max-w-[calc(100%-60px)]">
              <p
                className="search-res-title text-gray-900 dark:text-gray-100 text-sm font-medium break-words"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: trust server highlights
                dangerouslySetInnerHTML={{ __html: item?.highlightedTitle }}
              />
              {item?.snippets?.length > 0 && (
                <p
                  className="search-res-desc text-gray-500 dark:text-gray-400 text-xs mt-1 break-words"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: trust server highlights
                  dangerouslySetInnerHTML={{ __html: item?.snippets?.[0]?.highlightedText || '' }}
                />
              )}
            </div>
          </Item>
        ))}
      </Command.Group>
      {hasMore && displayMode === 'list' ? (
        <div className="flex justify-center w-full py-2">
          <Button
            type="text"
            loading={isRequesting}
            onClick={() => loadMore(currentPage)}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {t('common.loadMore')}
          </Button>
        </div>
      ) : null}
    </>
  );
}
