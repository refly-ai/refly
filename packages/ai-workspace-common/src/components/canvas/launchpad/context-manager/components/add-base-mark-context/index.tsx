import { useState } from 'react';
import { Badge, Button, Popover, Tooltip } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { BaseMarkContextSelector } from '../base-mark-context-selector';
import { useTranslation } from 'react-i18next';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';

interface AddBaseMarkContextProps {
  contextItems: IContextItem[];
  setContextItems: (items: IContextItem[]) => void;
}

export const AddBaseMarkContext = ({ contextItems, setContextItems }: AddBaseMarkContextProps) => {
  const [popoverVisible, setPopoverVisible] = useState(false);
  const { t } = useTranslation();

  const handleVisibleChange = (visible: boolean) => {
    setPopoverVisible(visible);
  };

  const handleClose = () => {
    setPopoverVisible(false);
  };

  const handleSelect = (item: IContextItem) => {
    const isSelected = contextItems.find((contextItem) => contextItem.entityId === item.entityId);

    if (!isSelected) {
      // Adding node
      setContextItems([...contextItems, item]);
    } else {
      // Removing node
      setContextItems(contextItems.filter((contextItem) => contextItem.entityId !== item.entityId));
    }
  };

  const handleClear = () => {
    setContextItems([]);
  };

  return (
    <Badge
      count={(contextItems || []).length}
      size="small"
      color="#00968F"
      style={{ zIndex: 1000 }}
    >
      <Popover
        placement="bottom"
        trigger="click"
        overlayInnerStyle={{ padding: 0, boxShadow: 'none' }}
        open={popoverVisible}
        onOpenChange={handleVisibleChange}
        content={
          <BaseMarkContextSelector
            onClose={handleClose}
            onSelect={handleSelect}
            selectedItems={contextItems}
            onClear={handleClear}
          />
        }
      >
        <Tooltip
          title={contextItems?.length > 0 ? t('knowledgeBase.context.addContext') : ''}
          getPopupContainer={getPopupContainer}
        >
          <Button
            icon={<PlusOutlined className="w-3 h-3" />}
            size="small"
            type="default"
            className="text-xs h-6 rounded border text-gray-500 gap-1"
          >
            {contextItems?.length === 0 ? t('copilot.addContext') : null}
          </Button>
        </Tooltip>
      </Popover>
    </Badge>
  );
};
