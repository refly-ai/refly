import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { FC, useCallback } from 'react';
import { Group, Ungroup } from 'lucide-react';
import { useGroupNodes } from '@refly-packages/ai-workspace-common/hooks/canvas/use-batch-nodes-selection/use-group-nodes';
import { useUngroupNodes } from '@refly-packages/ai-workspace-common/hooks/canvas/use-batch-nodes-selection/use-ungroup-nodes';

interface GroupActionMenuProps {
  nodeId: string;
  isTemporary?: boolean;
  onClose?: () => void;
}

export const GroupActionMenu: FC<GroupActionMenuProps> = ({ nodeId, isTemporary, onClose }) => {
  const { t } = useTranslation();
  const { createGroupFromSelectedNodes } = useGroupNodes();
  const { ungroupNodes } = useUngroupNodes();

  const handleGroup = useCallback(() => {
    createGroupFromSelectedNodes();
    onClose?.();
  }, [nodeId, createGroupFromSelectedNodes, onClose]);

  const handleUngroup = useCallback(() => {
    ungroupNodes(nodeId);
    onClose?.();
  }, [nodeId, ungroupNodes, onClose]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-1 flex gap-1 border border-[rgba(0,0,0,0.06)] dark:bg-gray-900">
      {isTemporary ? (
        <Button
          type="text"
          className="flex items-center justify-center  h-8 hover:bg-gray-50"
          icon={<Group className="w-4 h-4" />}
          onClick={handleGroup}
        >
          {t('canvas.nodeActions.group')}
        </Button>
      ) : (
        <Button
          type="text"
          className="flex items-center justify-center  h-8 hover:bg-gray-50"
          icon={<Ungroup className="w-4 h-4" />}
          onClick={handleUngroup}
        >
          {t('canvas.nodeActions.ungroup')}
        </Button>
      )}
    </div>
  );
};
