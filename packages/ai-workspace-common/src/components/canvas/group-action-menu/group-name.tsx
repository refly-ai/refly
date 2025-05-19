import { Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { FC, useCallback, useState, useEffect } from 'react';
import CommonColorPicker from '../nodes/shared/color-picker';

interface GroupNameProps {
  title: string;
  onUpdateName: (name: string) => void;
  selected: boolean;
  readonly: boolean;
  bgColor?: string;
  onChangeBgColor?: (color: string) => void;
}

export const GroupName: FC<GroupNameProps> = ({
  title,
  onUpdateName,
  selected,
  readonly,
  bgColor,
  onChangeBgColor,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(title);
  const [isEditing, setIsEditing] = useState(false);
  const showInput = title || selected || isEditing;

  const handleUpdateName = useCallback(() => {
    onUpdateName(name);
  }, [name, onUpdateName]);

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
      <div className="flex gap-3">
        <Input
          className="!bg-transparent !border-none !shadow-none !pl-0 !text-base !text-black dark:!text-gray-100"
          disabled={readonly}
          placeholder={t('canvas.nodeActions.editGroupNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setIsEditing(false)}
          onFocus={() => setIsEditing(true)}
        />
        <div style={{ display: selected ? 'block' : 'none' }}>
          <CommonColorPicker disabledAlpha={true} color={bgColor} onChange={onChangeBgColor} />
        </div>
      </div>
    </div>
  );
};
