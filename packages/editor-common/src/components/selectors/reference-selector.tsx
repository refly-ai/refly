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
import { IconCheck, IconRefresh } from '@arco-design/web-react/icon';

import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useSearchStoreShallow } from '@refly-packages/ai-workspace-common/stores/search';
import { RenderItem } from '@refly-packages/ai-workspace-common/components/copilot/copilot-operation-module/context-manager/types/item';
import { Mark } from '@refly/common-types';
import { getTypeIcon } from '@refly-packages/ai-workspace-common/components/copilot/copilot-operation-module/context-manager/utils/icon';
import { BaseReference } from '@refly/openapi-schema';
import { useDebouncedCallback } from 'use-debounce';
import { IconCanvas, IconResource } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useSearchParams } from '@refly-packages/ai-workspace-common/utils/router';
import { useReferencesStoreShallow } from '@refly-packages/ai-workspace-common/stores/references';
import { useCanvasStore } from '@refly-packages/ai-workspace-common/stores/canvas';

const { TextArea } = Input;

interface ReferenceSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReferenceSelector = ({ open, onOpenChange }: ReferenceSelectorProps) => {
  const { t } = useTranslation();
  const { noCategoryBigSearchRes } = useSearchStoreShallow((state) => ({
    noCategoryBigSearchRes: state.noCategoryBigSearchRes,
  }));

  const { fetchReferences } = useReferencesStoreShallow((state) => ({
    fetchReferences: state.fetchReferences,
  }));

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const canvasId = searchParams.get('canvasId');

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
  const [linkStr, setLinkStr] = useState('');

  const debouncedHandleSearch = useDebouncedCallback(async (val: string) => {
    handleSearch(val);
  }, 300);

  const handleSearchValueChange = (val: string) => {
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
      const scrollTop = scrollContainerRef.current?.scrollTop;

      setSelectedItems((prev) => {
        if (prev.some((selected) => selected.id === item.id)) {
          return prev.filter((selected) => selected.id !== item.id);
        }
        return [item, ...prev];
      });

      requestAnimationFrame(() => {
        if (scrollContainerRef.current && scrollTop !== undefined) {
          scrollContainerRef.current.scrollTop = scrollTop;
        }
      });
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

  const addReferences = async () => {
    let references: BaseReference[] = [];
    if (activeTab === 'library') {
      references = selectedItems.map((item) => ({
        sourceId: canvasId,
        sourceType: 'canvas',
        targetId: item.id,
        targetType: item.type,
      }));
    } else if (activeTab === 'externalUrl') {
      const links = linkStr.split('\n').filter((link) => link.trim());
      references = links.map((link) => ({
        sourceId: canvasId,
        sourceType: 'canvas',
        targetId: link.trim(),
        targetType: 'externalUrl',
      }));
    }
    setConfirmLoading(true);
    const { data } = await getClient().addReferences({
      body: {
        references,
      },
    });
    setConfirmLoading(false);
    if (data?.success) {
      const referenceList = data.data;
      const editor = useCanvasStore.getState().editor;

      referenceList.forEach((reference) => {
        editor.commands.addCitation({
          referenceId: reference.referenceId,
        });
      });

      fetchReferences({
        sourceType: 'canvas',
        sourceId: canvasId,
      });
      onClose();
    }
  };

  useEffect(() => {
    if (open && activeTab === 'library') {
      if (inputRef?.current) {
        inputRef?.current?.focus();
      }

      handleSearch('');
    }
  }, [open, activeTab]);

  useEffect(() => {
    if (open) {
      setSelectedItems([]);
      setLinkStr('');
    }
  }, [open]);

  return (
    <Popover modal={true} open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-2 rounded-none border-none">
          <RiDoubleQuotesL className={`h-3 w-3 font-medium ${open ? 'text-[#00968F]' : ''}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-60 p-0 border-solid border-1 border-gray-100 rounded-lg"
        sideOffset={10}
      >
        <div className="h-[300px] flex flex-col pt-1 pb-2">
          <div className="flex items-center gap-2 px-2">
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
              <div className="px-2 mb-2">
                <Input
                  style={{
                    fontSize: '12px',
                  }}
                  ref={inputRef}
                  placeholder={t(`referenceManager.${activeTab}Placeholder`)}
                  onChange={(e) => handleSearchValueChange(e.target.value)}
                />
              </div>

              <div className="flex-grow overflow-y-scroll flex flex-col relative" ref={scrollContainerRef}>
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

          {activeTab === 'externalUrl' && (
            <div className="flex-grow px-2">
              <TextArea
                style={{
                  fontSize: '12px',
                }}
                placeholder={t('resource.import.webLinkPlaceholer')}
                rows={4}
                autoSize={{
                  minRows: 10,
                  maxRows: 10,
                }}
                value={linkStr}
                onChange={(e) => setLinkStr(e.target.value)}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 px-2 pt-1 border-t border-t-1 border-solid border-l-0 border-r-0 border-b-0 border-gray-100">
            <AntdButton className="text-xs" size="small" color="default" variant="filled" onClick={onClose}>
              {t('common.cancel')}
            </AntdButton>

            <AntdButton
              className="text-xs"
              disabled={activeTab === 'library' ? selectedItems.length === 0 : linkStr.trim() === ''}
              size="small"
              type="primary"
              loading={confirmLoading}
              onClick={addReferences}
            >
              {t('common.confirm')}
            </AntdButton>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
