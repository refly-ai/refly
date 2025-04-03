import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  useSearchStore,
  useSearchStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/search';
import { useDebouncedCallback } from 'use-debounce';

import './index.scss';
import { Home } from './home';
import { DataList } from './data-list';

// request
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { SearchDomain, SearchResult } from '@refly/openapi-schema';
import { RenderItem } from '@refly-packages/ai-workspace-common/components/search/types';
import classNames from 'classnames';

import { useTranslation } from 'react-i18next';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import {
  IconCanvas,
  IconDocument,
  IconResource,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';

export interface SearchProps extends React.ComponentProps<'div'> {
  showList?: boolean;
  onClickOutside?: () => void;
  onSearchValueChange?: (value: string) => void;
}

export const Search = (props: SearchProps) => {
  const { showList, onClickOutside, onSearchValueChange, ...divProps } = props;

  const navigate = useNavigate();
  const { addNode } = useAddNode();

  const ref = React.useRef<HTMLDivElement | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [value, setValue] = React.useState('');
  const searchStore = useSearchStoreShallow((state) => ({
    pages: state.pages,
    setPages: state.setPages,
    setSearchedRes: state.setSearchedRes,
    setIsSearchOpen: state.setIsSearchOpen,
    searchedCanvases: state.searchedCanvases,
    searchedDocuments: state.searchedDocuments,
    searchedResources: state.searchedResources,
  }));
  const [displayMode, setDisplayMode] = useState<'search' | 'list'>('list');
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const { t } = useTranslation();

  const pages = searchStore.pages;
  const setPages = searchStore.setPages;
  const activePage = pages[pages.length - 1];
  const isHome = activePage === 'home';

  const popPage = useCallback(() => {
    const { pages } = useSearchStore.getState();
    const x = [...pages];
    x.splice(-1, 1);
    setPages(x);
  }, [setPages]);

  function bounce() {
    if (ref.current) {
      ref.current.style.transform = 'scale(0.96)';
      setTimeout(() => {
        if (ref.current) {
          ref.current.style.transform = '';
        }

        setSearchValue('');
      }, 100);
    }
  }

  const getMappedPageToDomain = (activePage: string) => {
    switch (activePage) {
      case 'home':
        return '';
      case 'note':
        return 'canvas';
      case 'readSesources':
        return 'resource';
      default:
        return '';
    }
  };

  const handleBigSearchValueChange = (searchVal: string, activePage: string) => {
    const domain = getMappedPageToDomain(activePage);

    // when searchVal is empty, get the normal list content
    if (!searchVal) {
      setDisplayMode('list');
      debouncedSearch({
        searchVal: '',
        domains: domain ? [domain as SearchDomain] : undefined,
      });
    } else {
      // when searchVal is not empty, get the search content
      setDisplayMode('search');
      debouncedSearch({
        searchVal,
        domains: domain ? [domain as SearchDomain] : undefined,
      });
    }
  };

  const [loading, setLoading] = useState(false);

  const debouncedSearch = useDebouncedCallback(
    async ({ searchVal, domains }: { searchVal: string; domains?: Array<SearchDomain> }) => {
      setLoading(true);

      const { data, error } = await getClient().search({
        body: {
          query: searchVal,
          domains: domains,
        },
      });
      setLoading(false);

      if (error || !data?.success) {
        return;
      }

      const resData = data?.data || [];

      const canvases = resData.filter((item) => item?.domain === 'canvas') || [];
      const resources = resData.filter((item) => item?.domain === 'resource') || [];
      const documents = resData.filter((item) => item?.domain === 'document') || [];

      searchStore.setSearchedRes({
        canvases,
        resources,
        documents,
      });
    },
    200,
  );

  useEffect(() => {
    inputRef?.current?.focus();

    handleBigSearchValueChange('', activePage);
  }, [activePage]);

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      // Click was outside the component
      if (ref.current && !ref.current.contains(event.target) && onClickOutside) {
        onClickOutside();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const renderData: RenderItem[] = [
    {
      domain: 'canvas',
      heading: t('loggedHomePage.quickSearch.canvas'),
      action: false,
      data: searchStore.searchedCanvases || [],
      actionHeading: {
        create: t('loggedHomePage.quickSearch.newCanvas'),
      },
      icon: <IconCanvas style={{ fontSize: 12 }} />,
      onItemClick: (item: SearchResult) => {
        searchStore.setIsSearchOpen(false);
        navigate(`/canvas/${item.id}`);
      },
    },
    {
      domain: 'document',
      heading: t('loggedHomePage.quickSearch.document'),
      action: false,
      actionHeading: {
        create: t('loggedHomePage.quickSearch.newDocument'),
      },
      data: searchStore.searchedDocuments || [],
      icon: <IconDocument style={{ fontSize: 12 }} />,
      onItemClick: (item: SearchResult) => {
        searchStore.setIsSearchOpen(false);
        addNode({
          type: 'document',
          data: {
            entityId: item.id,
            title: item.title,
            contentPreview: item.contentPreview,
          },
        });
      },
    },
    {
      domain: 'resource',
      heading: t('loggedHomePage.quickSearch.resource'),
      action: false,
      actionHeading: {
        create: t('loggedHomePage.quickSearch.newResource'),
      },
      data: searchStore.searchedResources || [],
      icon: <IconResource style={{ fontSize: 12 }} />,
      onItemClick: (item: SearchResult) => {
        searchStore.setIsSearchOpen(false);
        addNode({
          type: 'resource',
          data: {
            entityId: item.id,
            title: item.title,
            contentPreview: item.contentPreview,
          },
        });
      },
    },
  ];

  const getRenderData = (domain: string) => {
    return renderData?.find((item) => item.domain === domain);
  };

  const getInputPlaceholder = (domain: string) => {
    if (domain === 'home') {
      return t('loggedHomePage.quickSearch.placeholderForHome');
    }
    if (domain === 'skill-execute') {
      return t('loggedHomePage.quickSearch.placeholderForSkillExecute');
    }
    const data = getRenderData(domain);
    return t('loggedHomePage.quickSearch.placeholderForWeblink', { domain: data?.heading });
  };

  return (
    <div {...divProps} className={classNames('vercel', divProps.className)}>
      <Command
        value={value}
        onValueChange={setValue}
        ref={ref}
        filter={() => {
          return 1; // we can safely rely on the server filter
        }}
        className={classNames(showList ? 'search-active' : '')}
        onKeyDownCapture={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' && !isComposing) {
            bounce();
          }

          if (isHome || searchValue.length) {
            return;
          }

          if (e.key === 'Backspace') {
            e.preventDefault();
            popPage();
            bounce();
          }
        }}
      >
        <div>
          {pages.map((p) => (
            <div key={p} cmdk-vercel-badge="">
              {p}
            </div>
          ))}
        </div>
        <Command.Input
          autoFocus
          ref={inputRef}
          value={searchValue}
          placeholder={getInputPlaceholder(activePage)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionUpdate={() => {}}
          onCompositionEnd={() => setIsComposing(false)}
          onValueChange={(val) => {
            if (onSearchValueChange) {
              onSearchValueChange(val);
            }
            setSearchValue(val);
            handleBigSearchValueChange(val, activePage);
          }}
        />
        {showList && (
          <Spin spinning={loading} className="w-full h-full">
            <Command.List>
              <Command.Empty>No results found.</Command.Empty>
              {activePage === 'home' && (
                <Home
                  key={'search'}
                  displayMode={displayMode}
                  pages={pages}
                  setPages={(pages: string[]) => setPages(pages)}
                  data={renderData}
                  activeValue={value}
                  setValue={setValue}
                />
              )}
              {activePage !== 'home' && activePage !== 'skill-execute' ? (
                <DataList
                  key="data-list"
                  displayMode={displayMode}
                  {...getRenderData(activePage)}
                  activeValue={value}
                  setValue={setValue}
                />
              ) : null}
            </Command.List>
          </Spin>
        )}
      </Command>
    </div>
  );
};
