import { useState } from 'react';
import { Badge, Button, Popover, Tooltip } from 'antd';
import { IconPlus } from '@arco-design/web-react/icon';
import { BaseMarkContextSelector } from '../base-mark-context-selector';
import { useTranslation } from 'react-i18next';
import { getPopupContainer } from '@refly-packages/ai-workspace-common/utils/ui';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { NodeItem } from '@refly-packages/ai-workspace-common/stores/context-panel';

interface AddBaseMarkContextProps {
  contextItems: NodeItem[];
  setContextItems: (items: NodeItem[]) => void;
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

  const handleSelect = (node: CanvasNode) => {
    const isSelected = contextItems.find((item) => item.id === node.id);

    if (!isSelected) {
      // Adding node
      setContextItems([...contextItems, node]);
    } else {
      // Removing node
      setContextItems(contextItems.filter((item) => item.id !== node.id));
    }
  };

  return (
    <Badge count={(contextItems || []).length} size="small" color="#00968F" style={{ zIndex: 1000 }}>
      <Popover
        placement="bottom"
        trigger="click"
        overlayInnerStyle={{ padding: 0, boxShadow: 'none' }}
        open={popoverVisible}
        onOpenChange={handleVisibleChange}
        content={<BaseMarkContextSelector onClose={handleClose} onSelect={handleSelect} selectedItems={contextItems} />}
      >
        <Tooltip
          title={contextItems?.length > 0 ? t('knowledgeBase.context.addContext') : ''}
          getPopupContainer={getPopupContainer}
        >
          <Button
            icon={<IconPlus className="w-3 h-3" />}
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
