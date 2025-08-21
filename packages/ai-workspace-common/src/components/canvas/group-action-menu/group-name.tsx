import { Button, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { FC, useCallback, useState, useEffect } from 'react';
import CommonColorPicker from '../nodes/shared/color-picker';
import { More } from 'refly-icons';
import { CanvasNodeType } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';

interface GroupNameProps {
  title: string;
  onUpdateName: (name: string) => void;
  selected: boolean;
  readonly: boolean;
  bgColor?: string;
  nodeId: string;
  onChangeBgColor?: (color: string) => void;
}

export const GroupName: FC<GroupNameProps> = ({
  title,
  onUpdateName,
  selected,
  readonly,
  bgColor,
  onChangeBgColor,
  nodeId,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(title);
  const [isEditing, setIsEditing] = useState(false);
  const showInput = title || selected || isEditing;

  const handleUpdateName = useCallback(() => {
    onUpdateName(name);
  }, [name, onUpdateName]);

  const handleOpenContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Get mouse coordinates
      const x = e.clientX + 10;
      const y = e.clientY;

      // Emit event to open context menu
      nodeOperationsEmitter.emit('openNodeContextMenu', {
        x,
        y,
        nodeId: nodeId,
        nodeType: 'group' as CanvasNodeType,
      });
    },
    [nodeId],
  );

  useEffect(() => {
    handleUpdateName();
  }, [name]);

  return (
    <div
      className={`
        absolute
        -top-[40px]
        left-0
        w-full
        h-[40px]
        ${showInput ? '' : 'pointer-events-none'}
      `}
      style={{
        opacity: showInput ? 1 : 0,
        pointerEvents: showInput ? 'auto' : 'none',
      }}
    >
      <div className="flex gap-3 justify-between">
        <Input
          className="!bg-refly-tertiary-default !border-none !shadow-none !p-2 !text-sm !leading-5 !text-text-refly-2"
          disabled={readonly}
          placeholder={t('canvas.nodeActions.editGroupNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setIsEditing(false)}
          onFocus={() => setIsEditing(true)}
        />

        <div
          className="items-center gap-2 bg-refly-bg-content-z2 border-solid border-[1px] border-refly-Card-Border rounded-xl px-2"
          style={{ display: selected ? 'flex' : 'none' }}
        >
          <CommonColorPicker disabledAlpha={true} color={bgColor!} onChange={onChangeBgColor} />
          <Button
            type="text"
            size="small"
            className="text-refly-0 hover:!bg-refly-tertiary-hover"
            icon={<More size={18} />}
            onClick={handleOpenContextMenu}
          />
        </div>
      </div>
    </div>
  );
};
