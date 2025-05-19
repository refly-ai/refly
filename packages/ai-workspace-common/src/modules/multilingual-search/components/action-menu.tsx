import React, { useState } from 'react';
import { Affix, Button, Checkbox, message } from 'antd';
import { useMultilingualSearchStore } from '../stores/multilingual-search';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import './action-menu.scss';
import { useImportResourceStoreShallow } from '@refly-packages/ai-workspace-common/stores/import-resource';
import { UpsertResourceRequest } from '@refly/openapi-schema';
import { useKnowledgeBaseStore } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { StorageLimit } from '@refly-packages/ai-workspace-common/components/import-resource/intergrations/storageLimit';
import { getAvailableFileCount } from '@refly/utils/quota';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useUpdateSourceList } from '@refly-packages/ai-workspace-common/hooks/canvas/use-update-source-list';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';

export enum ImportActionMode {
  CREATE_RESOURCE = 'createResource',
  ADD_NODE = 'addNode',
  NONE = 'none',
}

interface ActionMenuProps {
  getTarget: () => HTMLElement;
  sourceType: 'multilingualSearch' | 'sourceListModal';
  importActionMode: ImportActionMode;
  disabled?: boolean;
}

export const ActionMenu: React.FC<ActionMenuProps> = (props) => {
  const { t } = useTranslation();

  const { updateSourceListDrawer } = useKnowledgeBaseStore((state) => ({
    updateSourceListDrawer: state.updateSourceListDrawer,
  }));

  const { projectId, isCanvasOpen } = useGetProjectCanvasId();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(projectId || null);
  const { updateSourceList } = useUpdateSourceList();

  const { refetchUsage, storageUsage } = useSubscriptionUsage();

  const { selectedItems, results, setSelectedItems } = useMultilingualSearchStore();
  const { setImportResourceModalVisible, insertNodePosition } = useImportResourceStoreShallow(
    (state) => ({
      setImportResourceModalVisible: state.setImportResourceModalVisible,
      insertNodePosition: state.insertNodePosition,
    }),
  );
  const [saveLoading, setSaveLoading] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    setSelectedItems(checked ? results : []);
  };

  const handleClose = () => {
    if (props.sourceType === 'sourceListModal') {
      updateSourceListDrawer({ visible: false });
    }
    if (props.sourceType === 'multilingualSearch') {
      setImportResourceModalVisible(false);
    }
  };

  const handleSave = async () => {
    if (selectedItems.length === 0) {
      message.warning(t('resource.import.emptyLink'));
      return;
    }
    setSaveLoading(true);

    if (props.importActionMode === ImportActionMode.CREATE_RESOURCE) {
      const batchCreateResourceData: UpsertResourceRequest[] = selectedItems.map((item) => ({
        projectId: currentProjectId,
        resourceType: 'weblink',
        title: item.title,
        data: {
          url: item.url,
          title: item.title,
        },
      }));

      const { data } = await getClient().batchCreateResource({
        body: batchCreateResourceData,
      });

      if (data?.success) {
        refetchUsage();
        message.success(t('common.putSuccess'));
        setSelectedItems([]);
        updateSourceList(Array.isArray(data?.data) ? data.data : [], currentProjectId);

        if (isCanvasOpen) {
          const resources = (Array.isArray(data?.data) ? data.data : []).map((resource, index) => {
            const selectedItem = selectedItems[index];
            return {
              id: resource.resourceId,
              title: resource.title,
              domain: 'resource',
              contentPreview: selectedItem?.pageContent ?? resource.contentPreview,
            };
          });

          resources.forEach((resource, index) => {
            const nodePosition = insertNodePosition
              ? {
                  x: insertNodePosition?.x + index * 300,
                  y: insertNodePosition?.y,
                }
              : null;

            nodeOperationsEmitter.emit('addNode', {
              node: {
                type: 'resource',
                data: {
                  title: resource.title,
                  entityId: resource.id,
                  contentPreview: resource.contentPreview,
                  metadata: {
                    contentPreview: resource.contentPreview,
                  },
                },
                position: nodePosition,
              },
            });
          });
        }
      }
    } else if (props.importActionMode === ImportActionMode.ADD_NODE) {
      message.success(t('common.putSuccess'));
      setSelectedItems([]);

      if (isCanvasOpen) {
        for (const item of selectedItems) {
          nodeOperationsEmitter.emit('addNode', {
            node: {
              type: 'resource',
              data: {
                title: item.title,
                entityId: item.metadata?.entityId,
                contentPreview: item.pageContent,
                metadata: {
                  contentPreview: item.pageContent,
                },
              },
            },
          });
        }
      }
    }
    setSaveLoading(false);
    handleClose();
  };

  const canImportCount = getAvailableFileCount(storageUsage);
  const disableSave = () => {
    return selectedItems.length === 0 || selectedItems.length > canImportCount;
  };

  return (
    <Affix offsetBottom={0} target={props.getTarget}>
      <div className="intergation-footer bg-white dark:bg-[#1f1f1f] border-[#e5e5e5] dark:!border-[#2f2f2f]">
        <div className="footer-location">
          <Checkbox
            checked={selectedItems.length && selectedItems.length === results.length}
            indeterminate={selectedItems.length > 0 && selectedItems.length < results.length}
            onChange={(e) => handleSelectAll(e.target.checked)}
          />
          <p className="footer-count text-item">
            {t('resource.import.linkCount', { count: selectedItems.length })}
          </p>
          <StorageLimit
            resourceCount={selectedItems.length}
            projectId={currentProjectId}
            onSelectProject={setCurrentProjectId}
          />
        </div>
        <div className="footer-action">
          <Button onClick={handleClose}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            onClick={handleSave}
            disabled={disableSave() || props.disabled}
            loading={saveLoading}
          >
            {isCanvasOpen ? t('common.saveToCanvas') : t('common.save')}
          </Button>
        </div>
      </div>
    </Affix>
  );
};
