import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import { Command } from 'cmdk';
import { Home } from '../../launchpad/context-manager/components/base-mark-context-selector/home';
import { getContextItemIcon } from '../../launchpad/context-manager/utils/icon';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { CanvasNodeType } from '@refly/openapi-schema';

interface NodeSelectorProps {
  onClickOutside?: () => void;
  onSearchValueChange?: (value: string) => void;
  onSelect?: (item: IContextItem) => void;
  selectedItems?: IContextItem[];
  onClose?: () => void;
  showFooterActions?: boolean;
  className?: string;
}

export const NodeSelector = (props: NodeSelectorProps) => {
  const {
    onClickOutside,
    onSearchValueChange,
    onSelect,
    selectedItems = [],
    showFooterActions = true,
    className,
  } = props;

  const [searchValue, setSearchValue] = useState('');
  const [activeValue, setActiveValue] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const { t } = useTranslation();

  const handleSearchValueChange = (val: string) => {
    if (onSearchValueChange) {
      onSearchValueChange(val);
    }
    setSearchValue(val);
  };

  useEffect(() => {
    const handleClickOutside = (event: any) => {
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

  const targetNodes = nodes.filter((node) => !['group', 'skill'].includes(node?.type));
  const sortedItems: IContextItem[] = [...targetNodes].reverse().map((node) => ({
    title: node.data?.title,
    entityId: node.data?.entityId,
    type: node.type,
    metadata: node.data?.metadata,
  }));

  const processedItems = useMemo(() => {
    return sortedItems.filter((item) =>
      item?.title?.toLowerCase().includes(searchValue.toLowerCase()),
    );
  }, [sortedItems, searchValue]);

  const sortedRenderData = useMemo(() => {
    return processedItems.map((item) => ({
      data: item,
      type: item?.type as CanvasNodeType,
      icon: getContextItemIcon(item.type, { width: 12, height: 12 }),
      isSelected: selectedItems?.some((selected) => selected?.entityId === item?.entityId),
      onItemClick: (item: IContextItem) => {
        onSelect?.(item);
      },
    }));
  }, [processedItems, selectedItems, onSelect]);

  return (
    <div className={classNames('refly-base-context-selector', className)}>
      <Command
        value={activeValue}
        onValueChange={setActiveValue}
        ref={ref}
        filter={() => 1}
        className={'search-active'}
        onKeyDownCapture={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' && !isComposing) {
            const selectedItem = processedItems.find((node) => node.entityId === activeValue);
            if (selectedItem) {
              onSelect?.(selectedItem);
            }
          }
        }}
      >
        <div cmdk-input-wrapper="">
          <Command.Input
            autoFocus
            ref={inputRef}
            value={searchValue}
            placeholder={t('canvas.contextSelector.placeholder')}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onValueChange={handleSearchValueChange}
          />
        </div>
        <Command.List>
          <Command.Empty>{t('common.empty')}</Command.Empty>
          <Home
            showItemDetail={false}
            key={'search'}
            data={sortedRenderData}
            activeValue={activeValue}
            setValue={setActiveValue}
          />
        </Command.List>
        {showFooterActions && (
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
                      <kbd>↵</kbd> {t('knowledgeBase.context.popoverSelector.footer.position')}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Command>
    </div>
  );
};
