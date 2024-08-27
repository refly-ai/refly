import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useSearchStore } from '@refly-packages/ai-workspace-common/stores/search';
import * as Popover from '@radix-ui/react-popover';
import { Logo, LinearIcon, FigmaIcon, SlackIcon, YouTubeIcon, RaycastIcon } from './icons';
import {} from '@heroicons/react/24/outline';
import {
  IconSearch,
  IconMessage,
  IconFile,
  IconApps,
  IconBook,
  IconEdit,
  IconRobot,
  IconFolderAdd,
} from '@arco-design/web-react/icon';
import { useDebouncedCallback } from 'use-debounce';
import { defaultFilter } from './cmdk/filter';

import './index.scss';
import { Modal } from '@arco-design/web-react';
import { Item } from './item';

// request
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { SearchDomain, SearchRequest, SearchResult } from '@refly/openapi-schema';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from '@refly-packages/ai-workspace-common/utils/router';
import { useKnowledgeBaseStore } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useKnowledgeBaseJumpNewPath } from '@refly-packages/ai-workspace-common/hooks/use-jump-new-path';
import { useBigSearchQuickAction } from '@refly-packages/ai-workspace-common/hooks/use-big-search-quick-action';
import { RenderItem } from '@refly-packages/ai-workspace-common/components/search/types';
import { useSkillStore } from '@refly-packages/ai-workspace-common/stores/skill';
import { useTranslation } from 'react-i18next';

export function Home({
  pages,
  setPages,
  displayMode,
  data,
  activeValue,
  searchValue,
  setValue,
}: {
  data: RenderItem[];
  pages: string[];
  setPages: (pages: string[]) => void;
  displayMode: 'list' | 'search';
  activeValue: string;
  searchValue: string;
  setValue: (val: string) => void;
}) {
  const navigate = useNavigate();
  const searchStore = useSearchStore();
  const knowledgeBaseStore = useKnowledgeBaseStore();
  const { jumpToKnowledgeBase, jumpToNote, jumpToReadResource } = useKnowledgeBaseJumpNewPath();
  const [searchParams, setSearchParams] = useSearchParams();
  const { triggerSkillQuickAction } = useBigSearchQuickAction();
  const skillStore = useSkillStore();
  const { t } = useTranslation();

  useEffect(() => {
    setValue('refly-built-in-ask-ai');
  }, []);

  return (
    <>
      <Command.Group heading={t('loggedHomePage.quickSearch.home.heading')}>
        <Item
          value="refly-built-in-ask-ai"
          keywords={['NewConv']}
          activeValue={activeValue}
          onSelect={() => {
            triggerSkillQuickAction(searchValue);
            searchStore.setIsSearchOpen(false);
            skillStore.setSelectedSkillInstalce(null);
          }}
        >
          <IconMessage style={{ fontSize: 12 }} />
          {t('loggedHomePage.quickSearch.home.askAI')}
        </Item>
        <Item
          value="refly-built-in-ai-online-search"
          keywords={['AISearch']}
          activeValue={activeValue}
          onSelect={() => {
            // searchProjects();
          }}
        >
          <IconSearch style={{ fontSize: 12 }} />
          {t('loggedHomePage.quickSearch.home.onlineSearch')}
        </Item>
        <Item
          value="refly-built-in-ai-knowledgebase-search"
          keywords={['AISearch']}
          activeValue={activeValue}
          onSelect={() => {
            // searchProjects();
          }}
        >
          <IconSearch style={{ fontSize: 12 }} />
          {t('loggedHomePage.quickSearch.home.collectionSearch')}
        </Item>
      </Command.Group>
      {data
        .filter((item) => item?.data?.length > 0)
        .map((renderItem, index) => (
          <Command.Group heading={renderItem?.heading} key={index}>
            {renderItem?.data?.slice(0, 5)?.map((item, index) => (
              <Item
                key={index}
                value={`${renderItem?.domain}-${index}-${item?.title}-${item?.content?.[0] || ''}`}
                activeValue={activeValue}
                onSelect={() => {
                  renderItem?.onItemClick(item);
                }}
              >
                {renderItem?.icon}
                <div className="search-res-container">
                  <p className="search-res-title" dangerouslySetInnerHTML={{ __html: item?.title }}></p>
                  {item?.content?.length > 0 && (
                    <p className="search-res-desc" dangerouslySetInnerHTML={{ __html: item?.content?.[0] || '' }}></p>
                  )}
                </div>
              </Item>
            ))}
            {displayMode === 'list' && renderItem?.data?.length > 0 ? (
              <Item
                value={`all${renderItem?.domain}`}
                keywords={['']}
                onSelect={() => {
                  setPages([...pages, renderItem?.domain]);
                }}
                activeValue={activeValue}
              >
                <IconApps style={{ fontSize: 12 }} />
                {t('loggedHomePage.quickSearch.home.showAll', { heading: renderItem?.heading })}
              </Item>
            ) : null}
            {renderItem?.action ? (
              <Item
                value={`create ${renderItem?.domain}`}
                keywords={[`create ${renderItem?.domain}`]}
                onSelect={() => {
                  renderItem?.onCreateClick();
                }}
                activeValue={activeValue}
              >
                <IconFolderAdd style={{ fontSize: 12 }} />
                {renderItem?.actionHeading?.create}
              </Item>
            ) : null}
          </Command.Group>
        ))}
    </>
  );
}
