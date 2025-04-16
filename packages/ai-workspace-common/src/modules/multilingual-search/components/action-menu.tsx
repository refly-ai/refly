import React, { useState } from 'react';
import { Affix, Button, Checkbox, message } from 'antd';
import { useMultilingualSearchStore } from '../stores/multilingual-search';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import './action-menu.scss';
import { useImportResourceStoreShallow } from '@refly-packages/ai-workspace-common/stores/import-resource';
import { UpsertResourceRequest } from '@refly/openapi-schema';
import { useKnowledgeBaseStore } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { StorageLimit } from '@refly-packages/ai-workspace-common/components/import-resource/intergrations/storageLimit';
import { getAvailableFileCount } from '@refly-packages/utils/quota';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useUpdateSourceList } from '@refly-packages/ai-workspace-common/hooks/canvas/use-update-source-list';

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

  const { projectId } = useGetProjectCanvasId();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(projectId || null);
  const { updateSourceList } = useUpdateSourceList();

  const { addNode } = useAddNode();
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
          addNode({
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
          });
        });
        updateSourceList(Array.isArray(data?.data) ? data.data : [], currentProjectId);
      }
    } else if (props.importActionMode === ImportActionMode.ADD_NODE) {
      for (const item of selectedItems) {
        addNode({
          type: 'resource',
          data: {
            title: item.title,
            entityId: item.metadata?.entityId,
            contentPreview: item.pageContent,
            metadata: {
              contentPreview: item.pageContent,
            },
          },
        });
      }
      message.success(t('common.putSuccess'));
      setSelectedItems([]);
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
      <div className="intergation-footer">
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
            {t('common.saveToCanvas')}
          </Button>
        </div>
      </div>
    </Affix>
  );
};
