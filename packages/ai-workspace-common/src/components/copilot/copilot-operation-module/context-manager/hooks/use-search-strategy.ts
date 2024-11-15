import { useState } from 'react';
import { useSearchStore } from '@refly-packages/ai-workspace-common/stores/search';
import { useShareStore, useShareStoreShallow } from '@refly-packages/ai-workspace-common/stores/share';
import { MessageIntentSource } from '@refly-packages/ai-workspace-common/types/copilot';
import { defaultFilter } from '@refly-packages/ai-workspace-common/components/search/cmdk/filter';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useDebouncedCallback } from 'use-debounce';
import { SearchDomain, SearchResult, SkillMeta } from '@refly/openapi-schema';
import { Button, Message, Spin } from '@arco-design/web-react';
import { getRuntime } from '@refly-packages/ai-workspace-common/utils/env';
import { BaseMarkType, frontendBaseMarkTypes, backendBaseMarkTypes, Mark } from '@refly/common-types';

// hooks
import { useLoadExtensionWeblinkData } from './use-load-weblink-data.extension';

interface UseSearchStrategyProps {
  limit?: number;
  source: MessageIntentSource;
  onLoadingChange?: (loading: boolean) => void;
}

interface ScoredMark extends Mark {
  score?: number;
}

const mapSearchResultToMark = (searchResult: SearchResult): Mark => {
  const newMark: Mark = {
    id: searchResult.id,
    entityId: searchResult.id,
    type: searchResult.domain,
    data: (searchResult?.snippets?.map((snippet) => snippet.text) || []).join('\n'),
    title: searchResult.title,
    metadata: searchResult.metadata,
  };

  return newMark;
};

export const useSearchStrategy = ({ limit = 5, source, onLoadingChange }: UseSearchStrategyProps) => {
  const [displayMode, setDisplayMode] = useState<'search' | 'list'>('list');
  const searchStore = useSearchStore();

  const isWeb = getRuntime() === 'web';

  // handle extension weblink
  const { loadExtensionWeblinkData } = useLoadExtensionWeblinkData();

  const handleShareModeSearch = useDebouncedCallback((searchVal: string) => {
    const { availableMarks } = useShareStore.getState();
    setDisplayMode('search');

    let sortedMarks: ScoredMark[];

    if (searchVal) {
      // 计算每个 mark 的分数并排序
      sortedMarks = availableMarks
        .map((mark) => ({
          ...mark,
          score: defaultFilter(mark.title, searchVal, searchVal.toLowerCase().split(/\s+/)),
        }))
        .sort((a, b) => {
          // 首先按分数降序排列
          const scoreDiff = (b.score || 0) - (a.score || 0);
          if (scoreDiff !== 0) return scoreDiff;

          // 分数相同时，按标题字母顺序排列
          return a.title.localeCompare(b.title);
        })
        // 过滤掉分数为 0 的结果
        .filter((mark) => mark.score && mark.score > 0);
    } else {
      // 如果没有搜索词，保持原有顺序
      sortedMarks = availableMarks;
    }

    searchStore.setNoCategoryBigSearchRes(sortedMarks);
  }, 200);

  const debouncedSearch = useDebouncedCallback(
    async ({ searchVal, domains }: { searchVal: string; domains?: Array<SearchDomain> }) => {
      onLoadingChange(true);

      const { data, error } = await getClient().search({
        body: {
          query: searchVal,
          domains: domains,
          limit,
        },
      });

      onLoadingChange(false);

      if (error) {
        Message.error(String(error));
        return;
      }

      const resData = data?.data || [];
      let marks = resData.map(mapSearchResultToMark);

      if (!isWeb) {
        const { success, data: extensionWeblinkData } = await loadExtensionWeblinkData();
        if (success) {
          const filteredExtensionWeblinks = extensionWeblinkData.filter((item) => {
            const res = defaultFilter(item.title, searchVal, searchVal.toLowerCase().split(/\s+/));
            return res;
          });
          marks = [...marks, ...filteredExtensionWeblinks];
        }
      }

      // notes
      // 将 SearchResult 转换为 Mark

      searchStore.setNoCategoryBigSearchRes(marks);
    },
    200,
  );

  const handleNormalSearch = (searchVal: string, domain: BaseMarkType) => {
    // searchVal 为空的时候获取正常列表的内容
    if (!searchVal) {
      setDisplayMode('list');

      if (backendBaseMarkTypes.includes(domain)) {
        debouncedSearch({
          searchVal: '',
          domains: (domain ? [domain] : undefined) as SearchDomain[],
        });
      } else if (frontendBaseMarkTypes.includes(domain)) {
        // TODO: 兼容 all 和 extensionWeblink 的场景
        if (domain === 'all') {
          debouncedSearch({
            searchVal: '',
            domains: backendBaseMarkTypes as SearchDomain[],
          });
        }
      }
    } else {
      // searchVal 不为空的时候获取搜索的内容
      setDisplayMode('search');

      if (backendBaseMarkTypes.includes(domain)) {
        debouncedSearch({
          searchVal: searchVal,
          domains: (domain ? [domain] : undefined) as SearchDomain[],
        });
      } else if (frontendBaseMarkTypes.includes(domain)) {
        // TODO: 兼容 all 和 extensionWeblink 的场景
        if (domain === 'all') {
          debouncedSearch({
            searchVal,
            domains: backendBaseMarkTypes as SearchDomain[],
          });
        }
      }
    }
  };

  const handleSearch = (searchVal: string, domain: BaseMarkType = 'all') => {
    if (source === MessageIntentSource.Share) {
      handleShareModeSearch(searchVal);
    } else {
      handleNormalSearch(searchVal, domain);
    }
  };

  return {
    displayMode,
    handleSearch,
  };
};
