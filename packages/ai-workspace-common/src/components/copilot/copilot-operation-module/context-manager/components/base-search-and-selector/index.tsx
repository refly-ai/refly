import React, { useEffect, useState } from 'react';
import { Message, Spin } from '@arco-design/web-react';
import { Button } from 'antd';
import './index.scss';

import { Command } from 'cmdk';
import { useSearchStore } from '@refly-packages/ai-workspace-common/stores/search';

import './index.scss';
import { Home } from './home';

// request
import { RenderItem } from '../../types/item';
import classNames from 'classnames';

import { useTranslation } from 'react-i18next';
import { BaseMarkType, frontendBaseMarkTypes, backendBaseMarkTypes, Mark } from '@refly/common-types';
import { getTypeIcon } from '../../utils/icon';
import { SortMark } from '../../types/mark';

import { getRuntime } from '@refly-packages/ai-workspace-common/utils/env';
import { useSearchStrategy } from '@refly-packages/ai-workspace-common/components/copilot/copilot-operation-module/context-manager/hooks/use-search-strategy';
import { MessageIntentSource } from '@refly-packages/ai-workspace-common/types/copilot';
import { IconRefresh } from '@arco-design/web-react/icon';
import { useContextPanelStoreShallow } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useSelectedMark } from '@refly-packages/ai-workspace-common/modules/content-selector/hooks/use-selected-mark';

interface CustomProps {
  showList?: boolean;
  onClickOutside?: () => void;
  onSearchValueChange?: (value: string) => void;
  onSelect?: (newMark: Mark) => void;
  onClose?: () => void;
  source: MessageIntentSource;
}

export interface BaseSearchAndSelectorProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'>,
    CustomProps {
  selectedItems: SortMark[];
}

export const BaseSearchAndSelector = ({
  onClose,
  onSelect,
  showList,
  onClickOutside,
  onSearchValueChange,
  selectedItems = [],
  source,
}: BaseSearchAndSelectorProps) => {
  const [activeTab, setActiveTab] = useState<BaseMarkType | 'all'>('all');
  const [searchValue, setSearchValue] = useState('');
  const [activeValue, setActiveValue] = React.useState('');
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const { t } = useTranslation();

  const { handleSearch, displayMode } = useSearchStrategy({
    source,
    onLoadingChange: (loading) => {
      setLoading(loading);
    },
  });

  const [loading, setLoading] = useState(false);

  console.log('activeValue', activeValue);

  // stores
  const searchStore = useSearchStore();
  const contextPanelStore = useContextPanelStoreShallow((state) => ({
    resetSelectedTextCardState: state.resetSelectedTextCardState,
  }));
  const { handleReset } = useSelectedMark();
  // hooks

  const isHome = activeTab === 'all';
  const isWeb = getRuntime() === 'web';

  const handleConfirm = (activeValue: string, sortedRenderData: RenderItem[]) => {
    const [_, id] = activeValue.split('__');
    const mark = sortedRenderData.find((item) => item.data.id === id);
    onSelect(mark?.data);
  };

  const handleSearchValueChange = (val: string) => {
    if (onSearchValueChange) {
      onSearchValueChange(val);
    }
    setSearchValue(val);
    console.log('handleSearch', val, activeTab);
    handleSearch(val, activeTab);
  };

  useEffect(() => {
    inputRef?.current?.focus();

    handleSearch('', activeTab);
  }, [activeTab]);

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

  const sortedMarks: Mark[] = [
    ...((selectedItems || []).map((item) => ({ ...item, isSelected: true })) || []),
    ...(searchStore.noCategoryBigSearchRes?.filter(
      (item) => !selectedItems.some((selected) => selected.id === item.id),
    ) || []),
  ];
  const sortedRenderData: RenderItem[] = sortedMarks.map((item) => ({
    domain: item.domain,
    heading: item.title,
    data: item,
    type: item.type,
    icon: getTypeIcon(item.type, { width: 12, height: 12 }),
    onItemClick: (item: Mark) => {
      onSelect(item);
    },
  }));

  const getInputPlaceholder = (domain: BaseMarkType | 'all') => {
    if (domain === 'all') {
      if (getRuntime() === 'web') {
        return t('knowledgeBase.context.popoverSelector.webPlaceholder');
      } else {
        return t('knowledgeBase.context.popoverSelector.extensionPlaceholder');
      }
    }
  };

  return (
    <Command
      value={activeValue}
      onValueChange={setActiveValue}
      ref={ref}
      filter={() => 1}
      className={classNames(showList ? 'search-active' : '')}
      onCompositionStart={(e) => console.log('composition start')}
      onCompositionUpdate={(e) => console.log('composition update')}
      onCompositionEnd={(e) => console.log('composition end')}
      onKeyDownCapture={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isComposing) {
          console.log('keydown', searchValue);
        }

        if (isHome || searchValue.length) {
          return;
        }
      }}
    >
      <div cmdk-input-wrapper="">
        <Command.Input
          autoFocus
          ref={inputRef}
          value={searchValue}
          placeholder={getInputPlaceholder(activeTab)}
          onCompositionStart={(e) => {
            setIsComposing(true);
          }}
          onCompositionUpdate={(e) => console.log('composition update')}
          onCompositionEnd={(e) => {
            setIsComposing(false);
          }}
          onValueChange={handleSearchValueChange}
        />
      </div>
      <Spin
        loading={loading}
        style={{ width: '100%', height: 'calc(100% - 72px)' }}
        className="context-search-list-container"
      >
        <Command.List>
          <Command.Empty>No results found.</Command.Empty>
          <Home
            showItemDetail={false}
            key={'search'}
            displayMode={displayMode}
            data={sortedRenderData}
            activeValue={activeValue}
            setValue={setActiveValue}
            searchValue={searchValue}
          />
        </Command.List>
      </Spin>
      <div cmdk-footer="">
        <div className="cmdk-footer-inner">
          <div className="cmdk-footer-hint">
            <div cmdk-vercel-shortcuts="">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> {t('knowledgeBase.context.popoverSelector.footer.navigate')}
              </span>
              <span>
                <kbd>↵</kbd> {t('knowledgeBase.context.popoverSelector.footer.toggle')}
              </span>
            </div>
          </div>
          <div className="cmdk-footer-action">
            <Button
              size="small"
              icon={<IconRefresh />}
              onClick={() => {
                contextPanelStore.resetSelectedTextCardState();
                handleReset();
              }}
            >
              {t('knowledgeBase.context.clearContext')}
            </Button>
          </div>
        </div>
      </div>
    </Command>
  );
};
