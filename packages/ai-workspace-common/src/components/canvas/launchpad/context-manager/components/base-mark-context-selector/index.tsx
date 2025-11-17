import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import classNames from 'classnames';

import { Command } from 'cmdk';

import { Home } from './home';
import { CanvasNodeType } from '@refly/openapi-schema';
import { ReloadOutlined } from '@ant-design/icons';
import { IContextItem } from '@refly/common-types';
import { useContextPanelStoreShallow } from '@refly/stores';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { useFetchDriveFiles } from '@refly-packages/ai-workspace-common/hooks/use-fetch-resources';
import { CONTEXT_FILTER_NODE_TYPES } from '@refly/canvas-common';

import './index.scss';
import '@refly-packages/ai-workspace-common/components/canvas/common/node-selector/index.scss';

interface CustomProps {
  onClickOutside?: () => void;
  onSearchValueChange?: (value: string) => void;
  onSelect?: (item: IContextItem) => void;
  selectedItems: IContextItem[];
  onClose?: () => void;
  onClear?: () => void;
}

export interface BaseMarkContextSelectorProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'>,
    CustomProps {}

export const BaseMarkContextSelector = (props: BaseMarkContextSelectorProps) => {
  const {
    onClickOutside,
    onSearchValueChange,
    onClose,
    onSelect,
    onClear,
    selectedItems = [],
    ...divProps
  } = props;

  const [searchValue, setSearchValue] = useState('');
  const [activeValue, setActiveValue] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const { t } = useTranslation();

  const contextPanelStore = useContextPanelStoreShallow((state) => ({
    clearContextItems: state.clearContextItems,
  }));

  const handleSearchValueChange = (val: string) => {
    if (onSearchValueChange) {
      onSearchValueChange(val);
    }
    setSearchValue(val);
  };

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
  }, [onClickOutside]);

  const { nodes } = useCanvasData();
  const { data: files } = useFetchDriveFiles();
  const targetNodes = nodes.filter((node) => !CONTEXT_FILTER_NODE_TYPES.includes(node?.type));

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      contextPanelStore.clearContextItems();
    }
  };

  // Memoize the filtered and sorted nodes and resources to prevent unnecessary recalculations
  const processedNodes = useMemo(() => {
    // First get unselected nodes and reverse them to show most recent first
    const unselectedNodes =
      targetNodes
        ?.filter(
          (node) => !selectedItems.some((selected) => selected.entityId === node.data?.entityId),
        )
        .reverse()
        .map((node) => ({
          title:
            node?.type === 'memo'
              ? node.data?.contentPreview
                ? `${node.data?.title} - ${node.data?.contentPreview?.slice(0, 10)}`
                : node.data?.title
              : node.data?.title,
          entityId: node.data?.entityId,
          type: node.type,
          metadata: node.data?.metadata,
        })) ?? [];

    // Process unselected resources
    const unselectedResources =
      files
        ?.filter((file) => !selectedItems.some((selected) => selected.entityId === file.fileId))
        .map((file) => ({
          title: file.name,
          entityId: file.fileId,
          type: 'file',
          metadata: {
            type: file.type,
            category: file.category,
          },
        })) ?? [];

    // Combine nodes and resources
    const combinedUnselectedItems = [...unselectedNodes, ...unselectedResources];

    // Filter based on search value
    const normalizedSearch = searchValue.toLowerCase();
    const filteredUnselectedItems = combinedUnselectedItems.filter((item) => {
      const normalizedTitle = item?.title?.toLowerCase() ?? '';
      return normalizedTitle.includes(normalizedSearch);
    });

    // Return selected items first, followed by filtered unselected items
    return [...(selectedItems ?? []), ...filteredUnselectedItems];
  }, [targetNodes, files, searchValue, selectedItems]);

  // Memoize the render data transformation
  const sortedRenderData = useMemo(() => {
    return processedNodes.map((item) => ({
      data: { ...item, title: item?.title || t(`canvas.nodeTypes.${item?.type}`) },
      type: item?.type as CanvasNodeType,
      isSelected: selectedItems?.some((selected) => selected?.entityId === item?.entityId),
      onItemClick: (item: IContextItem) => {
        onSelect?.(item);
      },
    }));
  }, [processedNodes, selectedItems, onSelect]);

  return (
    <div {...divProps} className={classNames('refly-base-context-selector', divProps?.className)}>
      <Command
        value={activeValue}
        onValueChange={setActiveValue}
        ref={ref}
        filter={() => 1}
        className={'search-active'}
        onKeyDownCapture={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' && !isComposing) {
            console.log('keydown', searchValue);
          }
        }}
      >
        <div cmdk-input-wrapper="">
          <Command.Input
            autoFocus
            ref={inputRef}
            value={searchValue}
            placeholder={t('canvas.contextSelector.placeholder')}
            onCompositionStart={() => {
              setIsComposing(true);
            }}
            onCompositionEnd={() => {
              setIsComposing(false);
            }}
            onValueChange={handleSearchValueChange}
          />
        </div>
        <Command.List>
          <Command.Empty>{t('common.empty')}</Command.Empty>
          <Home
            showItemDetail={false}
            key={'search'}
            data={sortedRenderData as any}
            activeValue={activeValue}
            setValue={setActiveValue}
          />
        </Command.List>
        <div cmdk-footer="">
          <div className="cmdk-footer-inner">
            <div className="cmdk-footer-hint">
              <div cmdk-vercel-shortcuts="">
                <span>
                  <span>
                    <kbd>↑</kbd>
                    <kbd>↓</kbd> {t('knowledgeBase.context.popoverSelector.footer.navigate')}
                  </span>
                  <span className="ml-2">
                    <kbd>↵</kbd> {t('knowledgeBase.context.popoverSelector.footer.toggle')}
                  </span>
                </span>
              </div>
            </div>
            <div className="cmdk-footer-action">
              <Button size="small" icon={<ReloadOutlined />} onClick={handleClear}>
                {t('knowledgeBase.context.clearContext')}
              </Button>
            </div>
          </div>
        </div>
      </Command>
    </div>
  );
};
