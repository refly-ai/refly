import React from 'react';
import { SelectedItems } from './index';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { CommonList, FetchDataFn } from './common-list';

interface DocumentsProps {
  visible: boolean;
  selectedItems: SelectedItems[];
  existingItems: string[];
  onSelectedItemsChange: (selectedItems: SelectedItems[]) => void;
}

const DocumentsMemo = ({
  visible,
  selectedItems,
  onSelectedItemsChange,
  existingItems,
}: DocumentsProps) => {
  const fetchDocuments: FetchDataFn = async (queryPayload) => {
    try {
      const res = await getClient().listDocuments({
        query: queryPayload,
      });
      return {
        success: true,
        data: res?.data?.data,
      };
    } catch (error) {
      console.error('Error fetching documents:', error);
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
      fetchData={fetchDocuments}
      entityType="document"
      scrollableId="documentsScrollableDiv"
      idField="docId"
    />
  );
};

export const Documents = React.memo(DocumentsMemo);
