import React, { useEffect, useRef, useState } from 'react';
import { Spin, Input, Empty, Button as AntdButton } from 'antd';
import type { InputRef } from 'antd';
import { Button } from '../ui/button';
import { PopoverContent } from '../ui/popover';
import { Popover, PopoverTrigger } from '@radix-ui/react-popover';
import { RiDoubleQuotesL } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { useSearchStrategy } from '@refly-packages/ai-workspace-common/components/copilot/copilot-operation-module/context-manager/hooks/use-search-strategy';
import { MessageIntentSource } from '@refly-packages/ai-workspace-common/types/copilot';
import { Command } from 'cmdk';
import { IconCheck, IconRefresh } from '@arco-design/web-react/icon';
import { Home } from '@refly-packages/ai-workspace-common/components/copilot/copilot-operation-module/context-manager/components/base-search-and-selector/home';

import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useSearchStoreShallow } from '@refly-packages/ai-workspace-common/stores/search';
import { RenderItem } from '@refly-packages/ai-workspace-common/components/copilot/copilot-operation-module/context-manager/types/item';
import { Mark } from '@refly/common-types';
import { getTypeIcon } from '@refly-packages/ai-workspace-common/components/copilot/copilot-operation-module/context-manager/utils/icon';
import { SearchResult } from '../../../../openapi-schema/src/types.gen';
import { useDebouncedCallback } from 'use-debounce';
import { IconCanvas, IconResource } from '@refly-packages/ai-workspace-common/components/common/icon';
interface ReferenceSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReferenceSelector = ({ open, onOpenChange }: ReferenceSelectorProps) => {
  const { t } = useTranslation();
  const { noCategoryBigSearchRes } = useSearchStoreShallow((state) => ({
    noCategoryBigSearchRes: state.noCategoryBigSearchRes,
  }));

  const { handleSearch } = useSearchStrategy({
    limit: 20,
    source: MessageIntentSource.AISelector,
    onLoadingChange: (loading) => {
      setLoading(loading);
    },
  });
  const [loading, setLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const inputRef = React.useRef<InputRef>(null);
  const [selectedItems, setSelectedItems] = useState<Mark[]>([]);

  const [activeTab, setActiveTab] = useState('library');

  const debouncedHandleSearch = useDebouncedCallback(async (val: string) => {
    handleSearch(val);
  }, 300);

  const handleSearchValueChange = (val: string) => {
    console.log('handleSearchValueChange', val);
    debouncedHandleSearch(val);
  };

  const sortedMarks: Mark[] = [
    // 首先放入所有已选中的项目
    ...selectedItems,
    // 然后放入未选中的搜索结果
    ...(noCategoryBigSearchRes?.filter((item) => !selectedItems.some((selected) => selected.id === item.id)) || []),
  ].map((item) => ({
    ...item,
    // 标记是否被选中
    isSelected: selectedItems.some((selected) => selected.id === item.id),
  }));

  const sortedRenderData: RenderItem[] = sortedMarks.map((item) => ({
    domain: item.domain,
    heading: item.title,
    data: item,
    type: item.type,
    icon: getTypeIcon(item.type, { width: 12, height: 12 }),
    onItemClick: (item: Mark) => {
      if (selectedItems.some((selected) => selected.id === item.id)) {
        // 如果已选中，则移除
        setSelectedItems(selectedItems.filter((selected) => selected.id !== item.id));
      } else {
        // 如果未选中，则添加到最前面
        setSelectedItems([item, ...selectedItems]);
      }
      console.log('selectedItems', selectedItems);
    },
  }));

  const tabs = [
    {
      key: 'library',
      label: t('referenceManager.library'),
    },
    {
      key: 'externalUrl',
      label: t('referenceManager.externalUrl'),
    },
  ];

  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };

  const onClose = () => {
    onOpenChange(false);
  };

  const onConfirm = () => {
    onOpenChange(false);
  };

  useEffect(() => {
    if (open && activeTab === 'library') {
      if (inputRef?.current) {
        inputRef?.current?.focus();
      }

      handleSearch('');
    }
  }, [open, activeTab]);

  return (
    <Popover modal={true} open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-2 rounded-none border-none">
          <RiDoubleQuotesL className="h-3 w-3 font-medium" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-60 pt-1 pb-2 px-2 border-solid border-1 border-gray-100 rounded-lg"
        sideOffset={10}
      >
        <div className="h-[300px] flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {tabs.map((tab) => (
              <Button
                className="flex flex-col items-center justify-center hover:bg-transparent hover:text-[#00968F]"
                variant="ghost"
                size="sm"
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
              >
                <span className="text-xs">{tab.label}</span>
                <div className={`h-[2px] w-[100%] mt-2 rounded-full ${activeTab === tab.key ? 'bg-[#00968F]' : ''}`} />
              </Button>
            ))}
          </div>

          {activeTab === 'library' && (
            <>
              <Input
                ref={inputRef}
                placeholder={t(`referenceManager.${activeTab}Placeholder`)}
                onChange={(e) => handleSearchValueChange(e.target.value)}
              />

              <div className="flex-grow overflow-y-scroll flex flex-col relative">
                <Spin spinning={loading}>
                  {sortedRenderData.length ? (
                    sortedRenderData.map((item) => (
                      <div
                        key={item.data.id}
                        className={`flex items-center gap-2 text-xs hover:bg-gray-100 p-1`}
                        onClick={() => item.onItemClick(item.data)}
                      >
                        {item.type === 'canvas' ? (
                          <IconCanvas className="h-3 w-3 flex-shrink-0" />
                        ) : (
                          <IconResource className="h-3 w-3 flex-shrink-0" />
                        )}
                        {item.heading}
                        {item.data.isSelected && <IconCheck className="h-3 w-3 flex-shrink-0 text-[#00968F]" />}
                      </div>
                    ))
                  ) : (
                    <Empty className="text-xs" description={t('referenceManager.noResult')} />
                  )}
                </Spin>
              </div>
            </>
          )}

          {activeTab === 'externalUrl' && <div>UrlSelector</div>}

          <div className="flex justify-end gap-2">
            <AntdButton className="text-xs" size="small" color="default" variant="filled" onClick={onClose}>
              {t('common.cancel')}
            </AntdButton>

            <AntdButton className="text-xs" size="small" type="primary">
              {t('common.confirm')}
            </AntdButton>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
