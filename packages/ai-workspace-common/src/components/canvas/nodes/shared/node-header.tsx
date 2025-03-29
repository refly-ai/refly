import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { IconType } from 'react-icons';
import { Input, Typography } from 'antd';
import type { InputRef } from 'antd';
import cn from 'classnames';
interface NodeHeaderProps {
  fixedTitle?: string;
  title: string;
  Icon?: IconType | React.ComponentType<{ className?: string }>;
  iconBgColor?: string;
  canEdit?: boolean;
  source?: 'preview' | 'node';
  updateTitle?: (title: string) => void;
}

export const NodeHeader = memo(
  ({
    fixedTitle,
    title,
    Icon,
    iconBgColor = '#17B26A',
    canEdit = false,
    updateTitle,
    source = 'node',
  }: NodeHeaderProps) => {
    const [editTitle, setEditTitle] = useState(title);
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<InputRef>(null);

    useEffect(() => {
      setEditTitle(title);
    }, [title]);

    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
      }
    }, [isEditing]);

    const handleBlur = () => {
      setIsEditing(false);
    };

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditTitle(e.target.value);
        updateTitle(e.target.value);
      },
      [setEditTitle, updateTitle],
    );

    return (
      <div className={cn('flex-shrink-0', { 'mb-1': source === 'node' })}>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded shadow-[0px_2px_4px_-2px_rgba(16,24,60,0.06),0px_4px_8px_-2px_rgba(16,24,60,0.1)] flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: iconBgColor }}
          >
            <Icon className="w-4 h-4 text-white" />
          </div>
          {canEdit && isEditing ? (
            <Input
              ref={inputRef}
              className="!border-transparent font-bold focus:!bg-transparent px-0.5 py-0"
              value={editTitle}
              onBlur={handleBlur}
              onChange={handleChange}
            />
          ) : (
            <Typography.Text
              className="text-sm font-bold leading-normal truncate"
              title={title || fixedTitle}
              onClick={() => {
                if (canEdit) {
                  setIsEditing(true);
                }
              }}
            >
              {title || fixedTitle}
            </Typography.Text>
          )}
        </div>
      </div>
    );
  },
);
