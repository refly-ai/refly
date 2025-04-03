import { AddSources } from '@refly-packages/ai-workspace-common/components/project/add-sources';

import { useTranslation } from 'react-i18next';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Document, Resource } from '@refly/openapi-schema';
import { Button, Checkbox, Skeleton, List, Empty, Collapse, Typography, message } from 'antd';
import {
  IconDocument,
  IconPlus,
  IconFiles,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { sourceObject } from '@refly-packages/ai-workspace-common/components/project/project-directory';
import cn from 'classnames';
import HeaderActions from '@refly-packages/ai-workspace-common/components/common/header-actions';
import { ResourceIcon } from '@refly-packages/ai-workspace-common/components/common/resourceIcon';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';

const { Text } = Typography;

export const SourcesMenu = ({
  sourceList,
  projectId,
  onUpdatedItems,
  isFetching,
  documentCount,
  resourceCount,
}: {
  sourceList?: Array<sourceObject>;
  projectId: string;
  onUpdatedItems?: () => void;
  isFetching: boolean;
  documentCount: number;
  resourceCount: number;
}) => {
  const { t } = useTranslation();

  const [selectedSources, setSelectedSources] = useState<sourceObject[]>([]);
  const [hoveredSourceId, setHoveredSourceId] = useState<string | null>(null);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [addSourcesVisible, setAddSourcesVisible] = useState(false);

  const handleSourceHover = (id: string | null) => {
    if (!isMultiSelectMode) {
      setHoveredSourceId(id);
    }
  };

  const toggleSourceSelection = (item: sourceObject) => {
    setSelectedSources((prev) => {
      if (prev.some((source) => source.entityId === item.entityId)) {
        return prev.filter((source) => source.entityId !== item.entityId);
      }
      setIsMultiSelectMode(true);
      return [...prev, item];
    });
  };

  const exitMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(false);
    setSelectedSources([]);
    setHoveredSourceId(null);
  }, []);

  const toggleSearchMode = useCallback(() => {
    setIsSearchMode((prev) => !prev);
    if (isSearchMode) {
      setSearchValue('');
    }
  }, [isSearchMode]);

  const exitSearchMode = useCallback(() => {
    setIsSearchMode(false);
    setSearchValue('');
    setSelectedSources([]);
    setHoveredSourceId(null);
    setIsMultiSelectMode(false);
  }, []);

  const deleteSelectedSources = useCallback(async () => {
    const { data } = await getClient().deleteProjectItems({
      body: {
        projectId,
        items: selectedSources.map((item) => ({
          entityType: item.entityType,
          entityId: item.entityId,
        })),
      },
    });
    if (data?.success) {
      exitSearchMode();
      message.success(t('project.action.deleteItemsSuccess'));
      onUpdatedItems?.();
    }
  }, [selectedSources, exitMultiSelectMode]);

  const removeSelectedSourcesFromProject = useCallback(async () => {
    const res = await getClient().updateProjectItems({
      body: {
        projectId,
        items: selectedSources.map((item) => ({
          entityType: item.entityType,
          entityId: item.entityId,
        })),
      },
    });
    const { data } = res || {};
    if (data?.success) {
      exitSearchMode();
      message.success(t('project.action.removeItemsSuccess'));
      onUpdatedItems?.();
    }
  }, [selectedSources, projectId, t, onUpdatedItems]);

  const addSelectedSourcesToCanvas = useCallback(async () => {
    if (selectedSources.length > 0) {
      for (const item of selectedSources) {
        nodeOperationsEmitter.emit('addNode', {
          node: {
            type: item.entityType,
            data: {
              title: item.title,
              entityId: item.entityId,
            },
          },
          needSetCenter: true,
          shouldPreview: true,
        });
      }
    }
    exitSearchMode();
  }, [selectedSources]);

  const filteredSourceList = useMemo(() => {
    if (!searchValue) return sourceList;
    return sourceList?.filter((item) =>
      item.title.toLowerCase().includes(searchValue.toLowerCase()),
    );
  }, [searchValue, sourceList]);

  const handleAddSource = useCallback(() => {
    setAddSourcesVisible(true);
  }, []);

  const itemCountText = useMemo(
    () =>
      t('project.sourceList.sourceCount', {
        resourceCount,
        documentCount,
      }),
    [t, resourceCount, documentCount],
  );

  const getItemIcon = useCallback((item: Document | Resource) => {
    return 'docId' in item ? (
      <IconDocument
        size={14}
        className="text-green-600 flex-shrink-0 flex items-center justify-center"
      />
    ) : (
      <ResourceIcon url={item?.data?.url} resourceType={item.resourceType} size={14} />
    );
  }, []);

  useEffect(() => {
    if (selectedSources?.length === 0) {
      setIsMultiSelectMode(false);
    }
  }, [selectedSources?.length]);

  return (
    <div className="flex-grow overflow-y-auto min-h-[150px] mt-1">
      <Collapse
        defaultActiveKey={['sources']}
        ghost
        expandIconPosition="end"
        className="bg-white sources-collapse"
        items={[
          {
            key: 'sources',
            label: (
              <div className="flex items-center gap-2 text-sm ">
                <IconFiles size={20} className="flex items-center justify-center text-gray-500" />
                {t('project.source')}
              </div>
            ),
            children: (
              <div className="h-full flex flex-col">
                <HeaderActions
                  source="source"
                  isSearchMode={isSearchMode}
                  isMultiSelectMode={isMultiSelectMode}
                  searchValue={searchValue}
                  selectedItems={selectedSources}
                  onSearchChange={setSearchValue}
                  onToggleSearchMode={toggleSearchMode}
                  onExitMultiSelectMode={exitMultiSelectMode}
                  onDeleteSelected={deleteSelectedSources}
                  onRemoveSelected={removeSelectedSourcesFromProject}
                  onAddItem={handleAddSource}
                  onAddSelectedSourcesToCanvas={addSelectedSourcesToCanvas}
                  itemCountText={itemCountText}
                />
                <div className="flex-grow overflow-y-auto px-3">
                  {isFetching ? (
                    <div className="flex justify-center h-full pt-4">
                      <Skeleton active paragraph={{ rows: 8 }} title={false} />
                    </div>
                  ) : (
                    <List
                      itemLayout="horizontal"
                      split={false}
                      dataSource={filteredSourceList}
                      locale={{
                        emptyText: (
                          <Empty
                            className="text-xs my-2"
                            imageStyle={{
                              display: 'none',
                            }}
                            image={null}
                            description={t('common.empty')}
                          >
                            <Button
                              size="small"
                              type="default"
                              className="text-xs"
                              icon={
                                <IconPlus size={12} className="flex items-center justify-center" />
                              }
                              onClick={handleAddSource}
                            >
                              {t('project.addSource')}
                            </Button>
                          </Empty>
                        ),
                      }}
                      renderItem={(item) => {
                        return (
                          <List.Item
                            className={cn(
                              '!py-2 !pl-1 !pr-2 rounded-md hover:bg-gray-50 cursor-pointer relative group',
                              selectedSources.some((source) => source.entityId === item.entityId) &&
                                'bg-gray-50',
                            )}
                            onMouseEnter={() => handleSourceHover(item.entityId)}
                            onMouseLeave={() => handleSourceHover(null)}
                          >
                            <div className="flex items-center gap-1 w-full">
                              <div
                                className="flex items-center gap-1.5 flex-grow"
                                onClick={() => toggleSourceSelection(item)}
                              >
                                {getItemIcon(item)}
                                <Text
                                  className="text-[13px] w-[120px] text-gray-700"
                                  ellipsis={{
                                    tooltip: true,
                                  }}
                                >
                                  {item.title || t('common.untitled')}
                                </Text>
                              </div>
                              <div
                                className={cn(
                                  'flex-shrink-0 flex items-center gap-1 transition-opacity duration-200',
                                  isMultiSelectMode || hoveredSourceId === item.entityId
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              >
                                <Checkbox
                                  checked={selectedSources.some(
                                    (source) => source.entityId === item.entityId,
                                  )}
                                  onChange={() => toggleSourceSelection(item)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                {/* {!isMultiSelectMode && (
                                  <IconMoreHorizontal className="w-4 h-3 text-gray-500 font-bond hover:text-green-600" />
                                )} */}
                              </div>
                            </div>
                          </List.Item>
                        );
                      }}
                    />
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />

      <AddSources
        domain="source"
        visible={addSourcesVisible}
        setVisible={setAddSourcesVisible}
        projectId={projectId}
        existingItems={sourceList?.map((item) => item.entityId) || []}
        onSuccess={() => {
          onUpdatedItems?.();
        }}
      />
    </div>
  );
};
