import React, { useEffect, useState } from 'react';
import { Affix, Button, Checkbox, message } from 'antd';
import { useMultilingualSearchStore } from '../stores/multilingual-search';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import './action-menu.scss';
import { useImportResourceStoreShallow } from '@refly-packages/ai-workspace-common/stores/import-resource';
import { UpsertResourceRequest } from '@refly/openapi-schema';
import { useKnowledgeBaseStore } from '@refly-packages/ai-workspace-common/stores/knowledge-base';
import { useCanvasControl } from '@refly-packages/ai-workspace-common/hooks/use-canvas-control';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';

export enum ImportActionMode {
  CREATE_RESOURCE = 'createResource',
  ADD_NODE = 'addNode',
  NONE = 'none',
}

interface ActionMenuProps {
  getTarget: () => HTMLElement;
  sourceType: 'multilingualSearch' | 'sourceListModal';
  importActionMode: ImportActionMode;
}

export const ActionMenu: React.FC<ActionMenuProps> = (props) => {
  const { t } = useTranslation();
  const { getLibraryList } = useHandleSiderData();

  const { updateSourceListDrawer } = useKnowledgeBaseStore((state) => ({
    updateSourceListDrawer: state.updateSourceListDrawer,
  }));
  const { addNode } = useCanvasControl();

  const { selectedItems, results, setSelectedItems } = useMultilingualSearchStore();
  const importResourceStore = useImportResourceStoreShallow((state) => ({
    selectedProjectId: state.selectedProjectId,
    setSelectedProjectId: state.setSelectedProjectId,
    setImportResourceModalVisible: state.setImportResourceModalVisible,
  }));
  const [saveLoading, setSaveLoading] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    setSelectedItems(checked ? results : []);
  };

  const handleClose = () => {
    if (props.sourceType === 'sourceListModal') {
      updateSourceListDrawer({ visible: false });
    }
    if (props.sourceType === 'multilingualSearch') {
      importResourceStore.setImportResourceModalVisible(false);
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

      if (data.success) {
        getLibraryList();
        message.success(t('common.putSuccess'));
        setSelectedItems([]);

        const resources = (Array.isArray(data?.data) ? data?.data : []).map((resource, index) => {
          const selectedItem = selectedItems[index];
          return {
            id: resource.resourceId,
            title: resource.title,
            domain: 'resource',
            contentPreview: selectedItem?.pageContent ?? resource.contentPreview,
          };
        });

        resources.forEach((resource) => {
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
          });
        });
      }
    } else if (props.importActionMode === ImportActionMode.ADD_NODE) {
      selectedItems.forEach((item) => {
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
      });
      message.success(t('common.putSuccess'));
      setSelectedItems([]);
    }

    setSaveLoading(false);
    handleClose();
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
          <p className="footer-count text-item">{t('resource.import.linkCount', { count: selectedItems.length })}</p>
        </div>
        <div className="footer-action">
          <Button style={{ marginRight: 8 }} onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" onClick={handleSave} disabled={selectedItems.length === 0} loading={saveLoading}>
            {t('common.saveToCanvas')}
          </Button>
        </div>
      </div>
    </Affix>
  );
};
