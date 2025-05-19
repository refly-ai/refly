import { AddSources } from '@refly-packages/ai-workspace-common/components/project/add-sources';
//import './index.scss';
import { useTranslation } from 'react-i18next';
import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { Document, Resource } from '@refly/openapi-schema';
import {
  Button,
  Checkbox,
  Skeleton,
  List,
  Empty,
  Collapse,
  Typography,
  message,
  Dropdown,
  Popconfirm,
} from 'antd';
import {
  IconDocument,
  IconPlus,
  IconFiles,
  IconMoreHorizontal,
  IconDelete,
  IconDownloadFile,
  IconRemove,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { sourceObject } from '@refly-packages/ai-workspace-common/components/project/project-directory';
import cn from 'classnames';
import HeaderActions from '@refly-packages/ai-workspace-common/components/common/header-actions';
import { ResourceIcon } from '@refly-packages/ai-workspace-common/components/common/resourceIcon';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useImportResourceStoreShallow } from '@refly-packages/ai-workspace-common/stores/import-resource';
import { LuPlus, LuExternalLink } from 'react-icons/lu';
import { useDownloadFile } from '@refly-packages/ai-workspace-common/hooks/use-download-file';
import type { MenuProps, DropdownProps } from 'antd';
import { useMatch } from 'react-router-dom';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useThemeStoreShallow } from '@refly-packages/ai-workspace-common/stores/theme';

const { Text } = Typography;

interface AddSourceDropdownProps {
  onAddSource: () => void;
  children?: React.ReactNode;
}

const AddSourceDropdown = memo(({ onAddSource, children }: AddSourceDropdownProps) => {
  const { t } = useTranslation();
  const { setImportResourceModalVisible } = useImportResourceStoreShallow((state) => ({
    setImportResourceModalVisible: state.setImportResourceModalVisible,
  }));

  const items = [
    {
      key: 'addExistingSource',
      label: t('project.action.addExistingSource', 'Add Existing Source'),
      onClick: () => {
        onAddSource();
      },
    },
    {
      key: 'importResource',
      label: t('project.action.importResource', 'Import Resource'),
      onClick: () => {
        setImportResourceModalVisible(true);
      },
    },
  ];

  return (
    <Dropdown menu={{ items }} trigger={['click']}>
      {children || (
        <Button
          type="default"
          size="small"
          className="text-xs text-gray-600 dark:text-gray-300"
          icon={<IconPlus size={12} className="flex items-center justify-center" />}
        >
          {t('project.action.addSource', 'Add Source')}
        </Button>
      )}
    </Dropdown>
  );
});

interface SourceItemActionDropdownProps {
  item: sourceObject;
  projectId: string;
  onUpdatedItems?: () => void;
}

const SourceItemActionDropdown = memo(
  ({ item, projectId, onUpdatedItems }: SourceItemActionDropdownProps) => {
    const { t } = useTranslation();
    const [popupVisible, setPopupVisible] = useState(false);
    const { downloadFile } = useDownloadFile();
    const isShareCanvas = useMatch('/share/canvas/:canvasId');
    const isDocument = item.entityType === 'document';
    const { isCanvasOpen } = useGetProjectCanvasId();

    // Resource-specific properties
    const resourceItem = !isDocument
      ? (item as { entityType: 'resource'; entityId: string } & Resource)
      : null;
    const hasUrl = resourceItem?.data?.url;
    const isFileResource = resourceItem?.resourceType === 'file';
    const hasDownloadUrl = resourceItem?.downloadURL;

    const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const { data } = await getClient().deleteProjectItems({
        body: {
          projectId,
          items: [
            {
              entityType: item.entityType,
              entityId: item.entityId,
            },
          ],
        },
      });
      if (data?.success) {
        message.success(t('project.action.deleteItemsSuccess'));
        setPopupVisible(false);
        onUpdatedItems?.();
      }
    };

    const handleRemoveFromProject = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const res = await getClient().updateProjectItems({
        body: {
          projectId,
          items: [
            {
              entityType: item.entityType,
              entityId: item.entityId,
            },
          ],
        },
      });
      const { data } = res || {};
      if (data?.success) {
        message.success(t('project.action.removeItemsSuccess'));
        setPopupVisible(false);
        onUpdatedItems?.();
      }
    };

    const handleAddToCanvas = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isCanvasOpen) {
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
        setPopupVisible(false);
      } else {
        message.error(t('workspace.noCanvasSelected'));
      }
    };

    const handleOpenWebpage = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasUrl && resourceItem?.data?.url) {
        window.open(resourceItem.data.url, '_blank');
        setPopupVisible(false);
      }
    };

    const handleDownloadFile = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (resourceItem) {
        downloadFile(resourceItem);
        setPopupVisible(false);
      }
    };

    const items: MenuProps['items'] = [
      !isShareCanvas && {
        label: (
          <div className="flex items-center flex-grow">
            <LuPlus size={16} className="mr-2" />
            {t('workspace.addToCanvas')}
          </div>
        ),
        key: 'addToCanvas',
        onClick: ({ domEvent }) => handleAddToCanvas(domEvent as React.MouseEvent),
      },
      !isDocument && {
        label: (
          <div className="flex items-center flex-grow">
            <LuExternalLink size={16} className="mr-2" />
            {t('workspace.openWebpage')}
          </div>
        ),
        key: 'openWebpage',
        onClick: ({ domEvent }) => handleOpenWebpage(domEvent as React.MouseEvent),
        disabled: !hasUrl,
      },
      !isDocument &&
        isFileResource &&
        hasDownloadUrl && {
          label: (
            <div className="flex items-center flex-grow">
              <IconDownloadFile size={16} className="mr-2" />
              {t('workspace.downloadFile')}
            </div>
          ),
          key: 'downloadFile',
          onClick: ({ domEvent }) => handleDownloadFile(domEvent as React.MouseEvent),
        },
      {
        label: (
          <div className="flex items-center flex-grow">
            <IconRemove size={16} className="mr-2 text-gray-600 dark:text-gray-300" />
            {t('project.action.remove', 'Remove from Project')}
          </div>
        ),
        key: 'removeFromProject',
        onClick: ({ domEvent }) => handleRemoveFromProject(domEvent as React.MouseEvent),
      },
      {
        label: (
          <Popconfirm
            placement="bottomLeft"
            title={t(`canvas.nodeActions.${isDocument ? 'document' : 'resource'}DeleteConfirm`, {
              title: item.title || t('common.untitled'),
            })}
            onConfirm={handleDelete}
            onCancel={(e?: React.MouseEvent) => {
              e?.stopPropagation();
              setPopupVisible(false);
            }}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            overlayStyle={{ maxWidth: '300px' }}
          >
            <div
              className="flex items-center text-red-600 flex-grow"
              onClick={(e) => e.stopPropagation()}
            >
              <IconDelete size={16} className="mr-2" />
              {t('workspace.deleteDropdownMenu.delete')}
            </div>
          </Popconfirm>
        ),
        key: 'delete',
      },
    ];

    const handleOpenChange: DropdownProps['onOpenChange'] = (open: boolean, info: any) => {
      if (info.source === 'trigger') {
        setPopupVisible(open);
      }
    };

    return (
      <Dropdown
        trigger={['click']}
        open={popupVisible}
        onOpenChange={handleOpenChange}
        menu={{ items }}
      >
        <Button
          type="text"
          size="small"
          icon={<IconMoreHorizontal className="text-gray-500" />}
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      </Dropdown>
    );
  },
);

SourceItemActionDropdown.displayName = 'SourceItemActionDropdown';

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
  const { isDarkMode } = useThemeStoreShallow((state) => ({
    isDarkMode: state.isDarkMode,
  }));

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

  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const deleteSelectedSources = useCallback(
    async (afterDelete?: () => void) => {
      setIsDeleteLoading(true);
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
        afterDelete?.();
      }
      setIsDeleteLoading(false);
    },
    [selectedSources, exitMultiSelectMode, projectId, t, onUpdatedItems, exitSearchMode],
  );

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
  }, [selectedSources, projectId, t, onUpdatedItems, exitSearchMode]);

  const addSelectedSourcesToCanvas = useCallback(async () => {
    if (selectedSources.length > 0) {
      // Store the reference position for node placement
      let referencePosition = null;

      for (let i = 0; i < selectedSources.length; i++) {
        const item = selectedSources[i];

        // For the first node, let the system calculate the position
        // For subsequent nodes, provide an offset based on the previous node
        const position = referencePosition
          ? {
              x: referencePosition.x,
              y: referencePosition.y + 150, // Add vertical spacing between nodes
            }
          : undefined;

        await new Promise<void>((resolve) => {
          nodeOperationsEmitter.emit('addNode', {
            node: {
              type: item.entityType,
              data: {
                title: item.title,
                entityId: item.entityId,
              },
              position,
            },
            needSetCenter: i === selectedSources.length - 1, // Only center on the last node
            shouldPreview: i === selectedSources.length - 1, // Only preview the last node
            // Capture the position of each node to use for positioning the next node
            positionCallback: (newPosition) => {
              referencePosition = newPosition;
              resolve();
            },
          });

          // Add a timeout in case the callback doesn't fire
          setTimeout(() => resolve(), 100);
        });
      }
    }
    exitSearchMode();
  }, [selectedSources, exitSearchMode]);

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

  const addButtonNode = useMemo(
    () => (
      <AddSourceDropdown onAddSource={handleAddSource}>
        <Button
          type="text"
          size="small"
          icon={
            <IconPlus className="flex items-center justify-center text-gray-500 hover:text-gray-700" />
          }
        />
      </AddSourceDropdown>
    ),
    [handleAddSource],
  );

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
        className={cn(
          'bg-white sources-collapse dark:bg-gray-900',
          isDarkMode ? 'dark-custom-collapse' : '',
        )}
        items={[
          {
            key: 'sources',
            label: (
              <div className="flex items-center gap-2 text-sm dark:text-gray-400">
                <IconFiles size={20} className="flex items-center justify-center text-gray-500" />
                {t('project.source')}
              </div>
            ),
            children: (
              <div className="h-full flex flex-col overflow-hidden">
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
                  isDeleteLoading={isDeleteLoading}
                  onRemoveSelected={removeSelectedSourcesFromProject}
                  onAddItem={handleAddSource}
                  onAddSelectedSourcesToCanvas={addSelectedSourcesToCanvas}
                  itemCountText={itemCountText}
                  addButtonNode={addButtonNode}
                  useAffix={true}
                  target={() => document.querySelector('.project-directory-content') as HTMLElement}
                />
                <div className="flex-grow overflow-y-auto px-3 source-list-container">
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
                            <AddSourceDropdown onAddSource={handleAddSource} />
                          </Empty>
                        ),
                      }}
                      renderItem={(item) => {
                        return (
                          <List.Item
                            className={cn(
                              '!py-2 !pl-1 !pr-2 rounded-md hover:bg-gray-50 cursor-pointer relative group dark:hover:bg-gray-800',
                              selectedSources.some((source) => source.entityId === item.entityId) &&
                                'bg-gray-50 dark:bg-gray-800',
                            )}
                            onMouseEnter={() => handleSourceHover(item.entityId)}
                            onMouseLeave={() => handleSourceHover(null)}
                          >
                            <div className="w-full relative">
                              <div
                                className="flex items-center gap-1.5 w-full overflow-hidden"
                                onClick={() => toggleSourceSelection(item)}
                              >
                                <div className="flex-shrink-0 flex items-center">
                                  {getItemIcon(item)}
                                </div>
                                <Text
                                  className="text-[13px] text-gray-700 truncate dark:text-gray-200"
                                  ellipsis={{
                                    tooltip: { placement: 'right' },
                                  }}
                                >
                                  {item.title || t('common.untitled')}
                                </Text>
                              </div>
                              <div
                                className={cn(
                                  'absolute -right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity duration-200 z-10 px-1',
                                  isMultiSelectMode || hoveredSourceId === item.entityId
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                  isMultiSelectMode ? '' : 'bg-gray-50 dark:bg-gray-800',
                                )}
                              >
                                <Checkbox
                                  className="mr-1"
                                  checked={selectedSources.some(
                                    (source) => source.entityId === item.entityId,
                                  )}
                                  onChange={() => toggleSourceSelection(item)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                {!isMultiSelectMode && (
                                  <SourceItemActionDropdown
                                    item={item}
                                    projectId={projectId}
                                    onUpdatedItems={onUpdatedItems}
                                  />
                                )}
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
