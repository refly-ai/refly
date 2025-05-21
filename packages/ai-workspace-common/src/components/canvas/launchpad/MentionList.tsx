// packages/ai-workspace-common/src/components/canvas/launchpad/MentionList.tsx
import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@refly/utils/cn';
import { getContextItemIcon } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager/utils/icon';

export interface MentionListItem {
  id: string;
  label: string;
  type?: string;
  metadata?: Record<string, any>;
}

export interface MentionListProps {
  items: MentionListItem[];
  command: (item: MentionListItem) => void;
  type?: 'user' | 'skill'; // 添加类型属性，用于区分 @ 命令和 / 命令
}

export interface MentionListRef {
  onKeyDown: ({ event }: { event: KeyboardEvent }) => boolean;
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command, type = 'user' }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [command, items],
    );

    useEffect(() => setSelectedIndex(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prevIndex) => (prevIndex + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prevIndex) => (prevIndex + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) {
      return null;
    }

    // 根据类型确定高亮颜色
    const getHighlightColors = () => {
      if (type === 'user') {
        return {
          text: 'text-blue-600 dark:text-blue-400',
          hover: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
          selected: 'bg-blue-50 dark:bg-blue-900/20',
        };
      } else {
        return {
          text: 'text-green-600 dark:text-green-400',
          hover: 'hover:bg-green-50 dark:hover:bg-green-900/20',
          selected: 'bg-green-50 dark:bg-green-900/20',
        };
      }
    };

    const colors = getHighlightColors();

    return (
      <div
        className="tiptap-mention-popup bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden text-sm"
        style={{ width: '240px' }}
      >
        <div className="py-1 max-h-60 overflow-y-auto">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'block w-full text-left px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none transition-colors duration-150 ease-in-out',
                'font-normal tracking-wide',
                colors.hover,
                index === selectedIndex ? `${colors.selected} ${colors.text}` : '',
              )}
              onClick={() => selectItem(index)}
              title={item.label}
            >
              <span className="inline-flex items-center mr-2 text-orange-500">
                {getContextItemIcon(item.type as any, { width: 12, height: 12 })}
              </span>
              <span className="truncate inline-block max-w-[calc(100%-24px)]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

MentionList.displayName = 'MentionList';

export default MentionList;
