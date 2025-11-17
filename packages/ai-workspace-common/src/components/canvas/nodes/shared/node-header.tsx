import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Input } from 'antd';
import type { InputRef } from 'antd';
import cn from 'classnames';
import { CanvasNodeType, ResourceType, ResourceMeta } from '@refly/openapi-schema';
import { NodeIcon } from './node-icon';

interface NodeHeaderProps {
  // Node identification
  nodeId?: string;
  nodeType?: CanvasNodeType;

  // Title props (legacy support)
  fixedTitle?: string;
  title: string;
  type?: CanvasNodeType; // alias for nodeType for backward compatibility
  placeholder?: string; // Placeholder to display when it is empty

  // Resource props (for resource nodes)
  resourceType?: ResourceType;
  resourceMeta?: ResourceMeta;

  // Edit behavior
  canEdit?: boolean;
  disabled?: boolean;
  updateTitle?: (title: string) => void;

  // Visual customization
  showIcon?: boolean;
  iconColor?: string;
  iconFilled?: boolean;
  backgroundColor?: string; // Override background color

  // Action buttons - render prop for custom actions
  actions?: React.ReactNode;

  // Additional props
  source?: 'preview' | 'node' | 'skillResponsePreview';
  className?: string;
}

// Background color classes for different node types
const NODE_TYPE_BG_CLASSES: Partial<Record<CanvasNodeType, string>> = {
  skillResponse: 'bg-refly-node-fill-1',
  start: 'bg-refly-node-fill-2',
};

/**
 * Generic node header component that can be used by different node types
 * Supports title editing, action buttons, and customizable styling
 */
export const NodeHeader = memo(
  ({
    nodeType,
    fixedTitle,
    title,
    placeholder,
    type, // backward compatibility
    resourceType,
    resourceMeta,
    canEdit = false,
    disabled = false,
    updateTitle,
    showIcon = true,
    iconColor = 'black',
    iconFilled = false,
    backgroundColor,
    actions,
    source = 'node',
    className = '',
  }: NodeHeaderProps) => {
    const [editTitle, setEditTitle] = useState(title);
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<InputRef>(null);
    const buttonContainerRef = useRef<HTMLDivElement>(null);

    // Use nodeType or fall back to type for backward compatibility
    const actualNodeType = nodeType || type;

    // Sync editTitle with prop title
    useEffect(() => {
      setEditTitle(title);
    }, [title]);

    // Auto-focus input when editing starts
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
        updateTitle?.(e.target.value);
      },
      [updateTitle],
    );

    // Determine background color class
    const bgColorClass = backgroundColor
      ? `bg-[${backgroundColor}]`
      : actualNodeType
        ? NODE_TYPE_BG_CLASSES[actualNodeType]
        : '';

    return (
      <div
        data-cy={actualNodeType ? `${actualNodeType}-node-header` : 'node-header'}
        className={cn(
          'flex items-center flex-shrink-0 w-full py-2 px-3 h-10',
          bgColorClass,
          className,
        )}
        ref={buttonContainerRef}
      >
        <div className="flex items-center w-full min-w-0 gap-2">
          {showIcon && (
            <NodeIcon
              type={actualNodeType}
              resourceType={resourceType}
              resourceMeta={resourceMeta}
              filled={iconFilled}
              iconColor={iconColor}
              iconSize={16}
            />
          )}

          {canEdit && isEditing && !disabled ? (
            <Input
              ref={inputRef}
              className={cn(
                '!border-transparent rounded-md font-semibold focus:!bg-refly-tertiary-hover px-0.5 py-0 !bg-refly-tertiary-hover !text-refly-text-0',
                {
                  'text-lg': source === 'skillResponsePreview',
                },
              )}
              value={editTitle}
              data-cy={actualNodeType ? `${actualNodeType}-node-header-input` : 'node-header-input'}
              placeholder={placeholder}
              onBlur={handleBlur}
              onChange={handleChange}
            />
          ) : (
            <div
              className={cn(
                'flex-1 rounded-md h-6 px-0.5 box-border font-semibold leading-6 truncate min-w-0',
                {
                  'text-lg': source === 'skillResponsePreview',
                  'text-sm': source !== 'skillResponsePreview',
                },
              )}
              title={editTitle || fixedTitle}
              onClick={() => {
                if (canEdit && !disabled) {
                  setIsEditing(true);
                }
              }}
            >
              {editTitle || fixedTitle || title}
            </div>
          )}
        </div>

        {/* Custom action buttons from parent */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    );
  },
);

NodeHeader.displayName = 'NodeHeader';
