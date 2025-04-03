import React from 'react';
import { SelectedItems } from './index';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { CommonList, FetchDataFn } from './common-list';

interface CanvasesProps {
  visible: boolean;
  selectedItems: SelectedItems[];
  existingItems: string[];
  onSelectedItemsChange: (selectedItems: SelectedItems[]) => void;
}

const CanvasesMemo = ({
  visible,
  selectedItems,
  onSelectedItemsChange,
  existingItems,
}: CanvasesProps) => {
  const fetchCanvases: FetchDataFn = async (queryPayload) => {
    try {
      const res = await getClient().listCanvases({
        query: queryPayload,
      });
      return {
        success: true,
        data: res?.data?.data,
      };
    } catch (error) {
      console.error('Error fetching canvases:', error);
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
      fetchData={fetchCanvases}
      entityType="canvas"
      scrollableId="canvasesScrollableDiv"
      idField="canvasId"
    />
  );
};

export const Canvases = React.memo(CanvasesMemo);
