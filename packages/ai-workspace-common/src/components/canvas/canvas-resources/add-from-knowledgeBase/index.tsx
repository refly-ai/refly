import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button, Modal, Segmented, Input, Empty, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { CanvasNodeType, ResourceMeta, ResourceType, SearchDomain } from '@refly/openapi-schema';
import { useFetchOrSearchList } from '@refly-packages/ai-workspace-common/modules/entity-selector/hooks';
import { ContextItem } from '@refly-packages/ai-workspace-common/types/context';
import { Checked } from 'refly-icons';
import throttle from 'lodash.throttle';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';

import './index.scss';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';

// Base multi-select list component
const BaseMultiSelectList = ({
  domain,
  selectedItems,
  setSelectedItems,
}: {
  domain: SearchDomain;
  selectedItems: ContextItem[];
  setSelectedItems: (items: ContextItem[] | ((prev: ContextItem[]) => ContextItem[])) => void;
}) => {
  const { t } = useTranslation();

  const [searchValue, setSearchValue] = useState('');

  const { loadMore, dataList, isRequesting, handleValueChange, resetState, hasMore } =
    useFetchOrSearchList({
      domain,
      pageSize: 20,
    });

  // Sort items: selected items first, then unselected items
  const sortedItems: ContextItem[] = useMemo(() => {
    if (!dataList?.length) return [];

    return [
      ...selectedItems,
      ...(dataList?.filter((item) => !selectedItems.some((selected) => selected.id === item.id)) ||
        []),
    ].map((item) => ({
      ...item,
      isSelected: selectedItems.some((selected) => selected.id === item.id),
    }));
  }, [dataList, selectedItems]);

  // Handle scroll to load more
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { currentTarget } = e;
      if (currentTarget.scrollTop + currentTarget.clientHeight >= currentTarget.scrollHeight - 20) {
        loadMore();
      }
    },
    [loadMore],
  );

  // Throttled search
  const throttledValueChange = useCallback(
    throttle((value: string) => {
      handleValueChange(value, [domain]);
    }, 300),
    [domain, handleValueChange],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      throttledValueChange(value);
    },
    [throttledValueChange],
  );

  // Handle item selection
  const handleItemClick = useCallback((item: ContextItem) => {
    setSelectedItems((prev) => {
      const isSelected = prev.some((selected) => selected.id === item.id);
      if (isSelected) {
        return prev.filter((selected) => selected.id !== item.id);
      }
      return [item, ...prev];
    });
  }, []);

  // Load initial data
  useEffect(() => {
    loadMore();
    return () => {
      resetState();
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Search input */}
      <Input
        className="text-sm"
        placeholder={t('project.sourceList.searchPlaceholder')}
        value={searchValue}
        onChange={(e) => handleSearchChange(e.target.value)}
      />

      {/* Items list */}
      <div
        className="flex-grow overflow-y-auto min-h-0 flex flex-col gap-2"
        onScroll={handleScroll}
      >
        {sortedItems?.map((option) => (
          <div
            key={option.id}
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-refly-tertiary-hover ${
              option.isSelected ? 'bg-refly-tertiary-hover' : ''
            }`}
            onClick={() => handleItemClick(option)}
          >
            <NodeIcon
              className="flex-shrink-0"
              type={domain === 'document' ? 'document' : 'resource'}
              resourceType={option.metadata?.resourceType as ResourceType}
              resourceMeta={option.metadata?.resourceMeta as ResourceMeta}
              iconSize={option.metadata?.resourceType === 'weblink' ? 18 : 24}
              filled={false}
            />
            <div className="flex-grow min-w-0">
              <div className="font-medium truncate">{option.title || t('common.untitled')}</div>
              {option.snippets?.[0]?.text && (
                <div className="text-xs text-refly-text-2 truncate mt-1">
                  {option.snippets[0].text}
                </div>
              )}
            </div>
            {option.isSelected && (
              <Checked className="flex-shrink-0" size={18} color="var(--refly-primary-default)" />
            )}
          </div>
        ))}

        {/* Loading indicator */}
        <Spin
          spinning={isRequesting}
          className={`${sortedItems.length === 0 ? 'w-full h-full flex items-center justify-center' : ''}`}
        />

        {/* No more data indicator */}
        {!hasMore && sortedItems.length > 0 && (
          <Divider dashed plain className="my-4 px-8">
            <div className="text-xs text-gray-400">{t('common.noMore')}</div>
          </Divider>
        )}

        {/* Empty state */}
        {sortedItems.length === 0 && !isRequesting && (
          <Empty
            className="flex-grow text-sm flex flex-col items-center justify-center py-8"
            imageStyle={{ width: 60, height: 60 }}
            description={t('common.empty')}
          />
        )}
      </div>
    </div>
  );
};

interface AddFromKnowledgeBaseProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

export const AddFromKnowledgeBase = (props: AddFromKnowledgeBaseProps) => {
  const { visible, setVisible } = props;
  const [activeTab, setActiveTab] = useState<'document' | 'resource'>('document');
  const { t } = useTranslation();
  const [selectedItems, setSelectedItems] = useState<ContextItem[]>([]);
  const { addNode } = useAddNode();
  const options = useMemo(() => {
    return [
      { label: t('common.document'), value: 'document' },
      { label: t('common.resource'), value: 'resource' },
    ];
  }, [t]);
  const onClose = () => {
    setVisible(false);
    setSelectedItems([]);
  };

  const onSave = (selectedItems: ContextItem[]) => {
    if (selectedItems.length > 0) {
      const domain = selectedItems[0]?.domain;
      selectedItems.forEach((item, _index) => {
        const contentPreview = item?.snippets?.map((snippet) => snippet?.text || '').join('\n');
        addNode({
          type: domain as CanvasNodeType,
          data: {
            title: item.title,
            entityId: item.id,
            contentPreview: item?.contentPreview || contentPreview,
          },
        });
      });
      onClose();
    }
  };

  return (
    <Modal
      centered
      open={visible}
      onCancel={onClose}
      title={null}
      footer={null}
      closable={false}
      className="add-from-knowledge-base-modal"
      width={720}
    >
      <div className="h-full flex flex-col gap-4">
        <div className="text-lg font-semibold">
          {t('canvas.resourceLibrary.importFromKnowledgeBase')}
        </div>
        <Segmented
          options={options}
          shape="round"
          value={activeTab}
          onChange={(value) => {
            setActiveTab(value as 'document' | 'resource');
            setSelectedItems([]);
          }}
          className="w-full [&_.ant-segmented-item]:flex-1 [&_.ant-segmented-item]:text-center"
        />
        <div className="flex-grow overflow-y-auto">
          {activeTab === 'document' && (
            <BaseMultiSelectList
              domain="document"
              selectedItems={selectedItems}
              setSelectedItems={setSelectedItems}
            />
          )}
          {activeTab === 'resource' && (
            <BaseMultiSelectList
              domain="resource"
              selectedItems={selectedItems}
              setSelectedItems={setSelectedItems}
            />
          )}
        </div>
        <Divider className="m-0" />
        <div className="flex justify-end gap-3">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            onClick={() => onSave(selectedItems)}
            disabled={selectedItems.length === 0}
          >
            {t('common.saveToCanvas')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
