// packages/ai-workspace-common/src/components/canvas/launchpad/MentionList.tsx
import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@refly/utils/cn';

export interface MentionListItem {
  id: string;
  label: string;
  // Add any other properties your items might have
}

export interface MentionListProps {
  items: MentionListItem[];
  command: (item: MentionListItem) => void;
}

export interface MentionListRef {
  onKeyDown: ({ event }: { event: KeyboardEvent }) => boolean;
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(({ items, command }, ref) => {
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

  return (
    <div className="tiptap-mention-popup bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg overflow-hidden text-sm">
      {items.map((item, index) => (
        <button
          key={item.id}
          className={cn(
            'block w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none',
            index === selectedIndex ? 'bg-gray-100 dark:bg-gray-600' : '',
          )}
          onClick={() => selectItem(index)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = 'MentionList';

export default MentionList;
