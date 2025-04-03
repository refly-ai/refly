import { useTranslation } from 'react-i18next';
import { Modal, Tabs, Button } from 'antd';
import { IconResource } from '@refly-packages/ai-workspace-common/components/common/icon';
import { IconDocument } from '@refly-packages/ai-workspace-common/components/common/icon';
import { IconCanvas } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Documents } from './documents';
import { Resources } from './resources';
import { Canvases } from './canvases';
import { useState, useCallback, useEffect } from 'react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import React from 'react';
import './index.scss';

interface AddSourcesProps {
  domain: 'source' | 'canvas';
  visible: boolean;
  setVisible: (visible: boolean) => void;
  projectId: string;
  onSuccess?: (canvasIds?: string[]) => void;
  existingItems: string[];
  defaultActiveKey?: string;
}

export type SelectedItems = {
  entityType: 'document' | 'resource' | 'canvas';
  entityId: string;
};

const AddSourcesMemo = React.memo(
  ({
    domain,
    visible,
    setVisible,
    projectId,
    onSuccess,
    existingItems,
    defaultActiveKey,
  }: AddSourcesProps) => {
    const { t } = useTranslation();
    const [selectedItems, setSelectedItems] = useState<SelectedItems[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeKey, setActiveKey] = useState(defaultActiveKey || 'document');

    useEffect(() => {
      if (defaultActiveKey) {
        setActiveKey(defaultActiveKey);
      }
    }, [defaultActiveKey]);

    const handleOk = useCallback(async () => {
      if (!projectId) return;

      const items = [
        ...selectedItems.map((item) => ({ entityType: item.entityType, entityId: item.entityId })),
      ];

      if (items.length === 0) return;

      try {
        setLoading(true);
        await getClient().updateProjectItems({
          body: {
            projectId,
            items,
            operation: 'add',
          },
        });
        onSuccess?.(
          selectedItems.filter((item) => item.entityType === 'canvas').map((item) => item.entityId),
        );
        setVisible(false);
        setSelectedItems([]);
      } catch (error) {
        console.error('Failed to add sources to project', error);
      } finally {
        setLoading(false);
      }
    }, [projectId, selectedItems, setVisible, onSuccess]);

    const handleCancel = useCallback(() => {
      setVisible(false);
      setSelectedItems([]);
    }, [setVisible]);

    useEffect(() => {
      if (!visible) {
        setSelectedItems([]);
      }
    }, [visible]);

    useEffect(() => {
      console.log('selectedItems', selectedItems);
    }, [selectedItems]);

    const sourceTabs = [
      {
        key: 'document',
        label: t('common.document'),
        icon: <IconDocument style={{ transform: 'translateY(2px)' }} />,
        children: (
          <Documents
            visible={visible && activeKey === 'document'}
            selectedItems={selectedItems.filter((item) => item.entityType === 'document')}
            onSelectedItemsChange={setSelectedItems}
            existingItems={existingItems}
          />
        ),
      },
      {
        key: 'resource',
        label: t('common.resource'),
        icon: <IconResource style={{ transform: 'translateY(2px)' }} />,
        children: (
          <Resources
            visible={visible && activeKey === 'resource'}
            selectedItems={selectedItems.filter((item) => item.entityType === 'resource')}
            onSelectedItemsChange={setSelectedItems}
            existingItems={existingItems}
          />
        ),
      },
    ];

    const canvasTabs = [
      {
        key: 'canvas',
        label: t('common.canvas'),
        icon: <IconCanvas style={{ transform: 'translateY(2px)' }} />,
        children: (
          <Canvases
            visible={visible && activeKey === 'canvas'}
            selectedItems={selectedItems.filter((item) => item.entityType === 'canvas')}
            onSelectedItemsChange={setSelectedItems}
            existingItems={existingItems}
          />
        ),
      },
    ];

    const handleTabChange = (key: string) => {
      setActiveKey(key);
    };

    const totalSelected = selectedItems.length;

    return (
      <Modal
        open={visible}
        onCancel={handleCancel}
        title={t('project.addSources.title')}
        width={600}
        className="add-sources-modal"
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={loading}
            onClick={handleOk}
            disabled={totalSelected === 0 || !projectId}
          >
            {t('common.confirm')} {totalSelected > 0 ? `(${totalSelected})` : ''}
          </Button>,
        ]}
      >
        <Tabs
          items={domain === 'source' ? sourceTabs : canvasTabs}
          activeKey={activeKey}
          onChange={handleTabChange}
        />
      </Modal>
    );
  },
);

export const AddSources = AddSourcesMemo;
