import { memo, useState } from 'react';
import { IconType } from 'react-icons';
import { Input } from 'antd';

interface NodeHeaderProps {
  title: string;
  Icon: IconType;
  iconBgColor?: string;
  canEdit?: boolean;
  updateTitle?: (title: string) => void;
}

export const NodeHeader = memo(
  ({ title, Icon, iconBgColor = '#17B26A', canEdit = false, updateTitle }: NodeHeaderProps) => {
    const [editTitle, setEditTitle] = useState(title);

    return (
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded shadow-[0px_2px_4px_-2px_rgba(16,24,60,0.06),0px_4px_8px_-2px_rgba(16,24,60,0.1)] flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: iconBgColor }}
          >
            <Icon className="w-4 h-4 text-white" />
          </div>
          {canEdit ? (
            <Input
              className="!border-transparent font-bold focus:!bg-transparent px-0.5 py-0"
              value={editTitle}
              onChange={(e) => {
                setEditTitle(e.target.value);
                updateTitle?.(e.target.value);
              }}
            />
          ) : (
            <span
              className="text-sm font-medium leading-normal text-[rgba(0,0,0,0.8)] truncate"
              title={title}
            >
              {title}
            </span>
          )}
        </div>
      </div>
    );
  },
);
