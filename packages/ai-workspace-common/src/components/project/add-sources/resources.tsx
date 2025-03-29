import React from 'react';
import { SelectedItems } from './index';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { CommonList, FetchDataFn } from './common-list';

interface ResourcesProps {
  visible: boolean;
  selectedItems: SelectedItems[];
  existingItems: string[];
  onSelectedItemsChange: (selectedItems: SelectedItems[]) => void;
}

const ResourcesMemo = ({
  visible,
  selectedItems,
  onSelectedItemsChange,
  existingItems,
}: ResourcesProps) => {
  const fetchResources: FetchDataFn = async (queryPayload) => {
    try {
      const res = await getClient().listResources({
        query: queryPayload,
      });
      return {
        success: true,
        data: res?.data?.data,
      };
    } catch (error) {
      console.error('Error fetching resources:', error);
      return {
        success: false,
        data: [],
      };
    }
  };

  return (
    <CommonList
      visible={visible}
      selectedItems={selectedItems}
      existingItems={existingItems}
      onSelectedItemsChange={onSelectedItemsChange}
      fetchData={fetchResources}
      entityType="resource"
      scrollableId="resourcesScrollableDiv"
      idField="resourceId"
    />
  );
};

export const Resources = React.memo(ResourcesMemo);
