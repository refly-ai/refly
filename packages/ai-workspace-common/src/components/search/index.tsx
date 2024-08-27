import React, { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { useSearchStore } from '@refly-packages/ai-workspace-common/stores/search';
import {} from '@heroicons/react/24/outline';
import { IconMessage, IconFile, IconBook, IconEdit, IconRobot } from '@arco-design/web-react/icon';
import { useDebouncedCallback } from 'use-debounce';
import { defaultFilter } from './cmdk/filter';

import './index.scss';
import { Home } from './home';
import { DataList } from './data-list';
import { Skill } from './skill';

// request
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { SearchDomain, SearchResult, SkillMeta } from '@refly/openapi-schema';
import { useKnowledgeBaseJumpNewPath } from '@refly-packages/ai-workspace-common/hooks/use-jump-new-path';
import { useAINote } from '@refly-packages/ai-workspace-common/hooks/use-ai-note';
import { RenderItem } from '@refly-packages/ai-workspace-common/components/search/types';
import classNames from 'classnames';

import { useTranslation } from 'react-i18next';

export interface SearchProps extends React.ComponentProps<'div'> {
  showList?: boolean;
  onClickOutside?: () => void;
  onSearchValueChange?: (value: string) => void;
}

export const Search = (props: SearchProps) => {
  const { showList, onClickOutside, onSearchValueChange, ...divProps } = props;

  const ref = React.useRef<HTMLDivElement | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [value, setValue] = React.useState('');
  const searchStore = useSearchStore();
  const [displayMode, setDisplayMode] = useState<'search' | 'list'>('list');
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const { t } = useTranslation();

  // skill
  const [selectedSkill, setSelectedSkill] = useState<SkillMeta>();
  // notes
  const { handleInitEmptyNote } = useAINote();

  // 整体处理
  const { jumpToKnowledgeBase, jumpToNote, jumpToReadResource, jumpToConv } = useKnowledgeBaseJumpNewPath();

  const pages = searchStore.pages;
  const setPages = searchStore.setPages;
  const activePage = pages[pages.length - 1];
  const isHome = activePage === 'home';

  const popPage = React.useCallback(() => {
    const { pages } = useSearchStore.getState();
    const x = [...pages];
    x.splice(-1, 1);
    setPages(x);
  }, []);

  const onKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (isHome || searchValue.length) {
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        popPage();
      }
    },
    [searchValue.length, isHome, popPage],
  );

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
        return 'note';
      case 'readSesources':
        return 'resource';
      case 'knowledgeBases':
        return 'collection';
      case 'convs':
        return 'conversation';
      case 'skills':
        return 'skill';
      default:
        return '';
    }
  };

  const handleBigSearchValueChange = (searchVal: string, activePage: string) => {
    const domain = getMappedPageToDomain(activePage);
    console.log('activePage:', activePage, domain);

    // searchVal 为空的时候获取正常列表的内容
    if (!searchVal) {
      setDisplayMode('list');
      debouncedSearch({
        searchVal: '',
        domains: domain ? [domain] : undefined,
      });
    } else {
      // searchVal 不为空的时候获取搜索的内容
      setDisplayMode('search');
      debouncedSearch({
        searchVal,
        domains: domain ? [domain] : undefined,
      });
    }
  };

  const debouncedSearch = useDebouncedCallback(
    async ({ searchVal, domains }: { searchVal: string; domains?: Array<SearchDomain> }) => {
      try {
        const res = await getClient().search({
          body: {
            query: searchVal,
            scope: 'user',
            domains: domains,
          },
        });

        const resData = res?.data?.data || [];

        // notes
        const notes = resData.filter((item) => item?.domain === 'note') || [];
        const readResources = resData.filter((item) => item?.domain === 'resource') || [];
        const knowledgeBases = resData.filter((item) => item?.domain === 'collection') || [];
        const convs = resData.filter((item) => item?.domain === 'conversation') || [];
        const skills = resData.filter((item) => item?.domain === 'skill') || [];

        searchStore.setSearchedRes({
          notes,
          readResources,
          knowledgeBases,
          convs,
          skills,
        });
      } catch (err) {
        console.log('big search err: ', err);
      }
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
      domain: 'skill',
      heading: t('loggedHomePage.quickSearch.skill'),
      action: false, // 是否开启 action
      data: searchStore.searchedSkills || [],
      icon: <IconRobot style={{ fontSize: 12 }} />,
      onItemClick: (item: SearchResult) => {
        const skill: SkillMeta = {
          displayName: item?.title,
          tplName: item?.title,
          skillId: item?.id,
        };
        setSelectedSkill(skill);
        setPages([...pages, 'skill-execute']);
      },
    },
    {
      domain: 'note',
      heading: t('loggedHomePage.quickSearch.note'),
      action: true,
      actionHeading: {
        create: t('loggedHomePage.quickSearch.newNote'),
      },
      data: searchStore.searchedNotes || [],
      icon: <IconEdit style={{ fontSize: 12 }} />,
      onItemClick: (item: SearchResult) => {
        jumpToNote({
          noteId: item?.id,
        });
        searchStore.setIsSearchOpen(false);
      },
      onCreateClick: async () => {
        await handleInitEmptyNote('New note');
        searchStore.setIsSearchOpen(false);
      },
    },
    {
      domain: 'readResources',
      heading: t('loggedHomePage.quickSearch.readResource'),
      action: true,
      actionHeading: {
        create: t('loggedHomePage.quickSearch.newReadResource'),
      },
      data: searchStore.searchedReadResources || [],
      icon: <IconBook style={{ fontSize: 12 }} />,
      onItemClick: (item: SearchResult) => {
        jumpToReadResource({
          kbId: item?.metadata?.collectionId,
          resId: item?.id,
        });
        searchStore.setIsSearchOpen(false);
      },
      onCreateClick: async () => {},
    },
    {
      domain: 'knowledgeBases',
      heading: t('loggedHomePage.quickSearch.collection'),
      action: true,
      actionHeading: {
        create: t('loggedHomePage.quickSearch.newCollection'),
      },
      data: searchStore.searchedKnowledgeBases || [],
      icon: <IconFile style={{ fontSize: 12 }} />,
      onItemClick: (item: SearchResult) => {
        jumpToKnowledgeBase({
          kbId: item?.id,
        });
        searchStore.setIsSearchOpen(false);
      },
      onCreateClick: async () => {},
    },
    {
      domain: 'convs',
      heading: t('loggedHomePage.quickSearch.thread'),
      action: true,
      actionHeading: {
        create: t('loggedHomePage.quickSearch.newThread'),
      },
      data: searchStore.searchedConvs || [],
      icon: <IconMessage style={{ fontSize: 12 }} />,
      onItemClick: (item: SearchResult) => {
        jumpToConv({
          convId: item?.id,
        });
        searchStore.setIsSearchOpen(false);
      },
      onCreateClick: async () => {},
    },
  ];
  const getRenderData = (domain: string) => {
    return renderData?.find((item) => item.domain === domain);
  };

  const getInputPlaceholder = (domain: string) => {
    if (domain === 'home') {
      return t('loggedHomePage.quickSearch.placeholderForHome');
    } else if (domain === 'skill-execute') {
      return t('loggedHomePage.quickSearch.placeholderForSkillExecute');
    } else {
      const data = getRenderData(domain);
      return t('loggedHomePage.quickSearch.placeholderForWeblink', { domain: data?.heading });
    }
  };

  return (
    <div {...divProps} className={classNames('vercel', divProps.className)}>
      <Command
        value={value}
        onValueChange={setValue}
        ref={ref}
        filter={(value, search, keywords) => {
          if (value?.startsWith('refly-built-in')) {
            return 1;
          }

          return defaultFilter(value, search, keywords);
        }}
        className={classNames(showList ? 'search-active' : '')}
        onCompositionStart={(e) => console.log('composition start')}
        onCompositionUpdate={(e) => console.log('composition update')}
        onCompositionEnd={(e) => console.log('composition end')}
        onKeyDownCapture={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' && !isComposing) {
            console.log('keydown', searchValue);
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
          onCompositionStart={(e) => {
            setIsComposing(true);
          }}
          onCompositionUpdate={(e) => console.log('composition update')}
          onCompositionEnd={(e) => {
            setIsComposing(false);
          }}
          onValueChange={(val) => {
            if (onSearchValueChange) {
              onSearchValueChange(val);
            }
            setSearchValue(val);
            handleBigSearchValueChange(val, activePage);
          }}
        />
        <Command.List style={{ display: showList ? 'inherit' : 'none' }}>
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
              searchValue={searchValue}
            />
          )}
          {activePage !== 'home' && activePage !== 'skill-execute' ? (
            <DataList
              key="data-list"
              displayMode={displayMode}
              {...getRenderData(activePage)}
              activeValue={value}
              searchValue={searchValue}
              setValue={setValue}
            />
          ) : null}
          {activePage === 'skill-execute' ? (
            <Skill
              key="skill"
              activeValue={value}
              searchValue={searchValue}
              setValue={setValue}
              selectedSkill={selectedSkill}
            />
          ) : null}
        </Command.List>
      </Command>
    </div>
  );
};
