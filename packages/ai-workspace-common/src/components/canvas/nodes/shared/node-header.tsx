import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Input } from 'antd';
import type { InputRef } from 'antd';
import cn from 'classnames';
import { CanvasNodeType, ResourceType, ResourceMeta } from '@refly/openapi-schema';
import { NodeIcon } from './node-icon';

interface NodeHeaderProps {
  fixedTitle?: string;
  title: string;
  type?: CanvasNodeType;
  resourceType?: ResourceType;
  resourceMeta?: ResourceMeta;
  canEdit?: boolean;
  source?: 'preview' | 'node';
  updateTitle?: (title: string) => void;
}

// Background colors for different node types
const NODE_TYPE_COLORS: Partial<Record<CanvasNodeType, string>> = {
  skillResponse: '#D9FFFE',
  start: '#FEF2CF',
};

export const NodeHeader = memo(
  ({
    fixedTitle,
    title,
    type,
    resourceType,
    resourceMeta,
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

    const backgroundColor = type ? NODE_TYPE_COLORS[type] : undefined;
    console.log('backgroundColor', type, backgroundColor);
    return (
      <div
        className={cn('flex-shrink-0', { 'mb-3': source === 'node' })}
        style={{ backgroundColor }}
      >
        <div className="flex items-center gap-2">
          <NodeIcon type={type} resourceType={resourceType} resourceMeta={resourceMeta} />
          {canEdit && isEditing ? (
            <Input
              ref={inputRef}
              className="!border-transparent rounded-md font-bold focus:!bg-refly-tertiary-hover px-0.5 py-0 !bg-refly-tertiary-hover !text-refly-text-0"
              value={editTitle}
              onBlur={handleBlur}
              onChange={handleChange}
            />
          ) : (
            <div
              className="rounded-md h-6 px-0.5 box-border font-bold leading-6 truncate block hover:bg-refly-tertiary-hover"
              title={title || fixedTitle}
              onClick={() => {
                if (canEdit) {
                  setIsEditing(true);
                }
              }}
            >
              {title || fixedTitle}
            </div>
          )}
        </div>
      </div>
    );
  },
);
