import { Command } from 'cmdk';
import React from 'react';

export function Item({
  children,
  shortcut,
  value,
  keywords,
  activeValue,
  onSelect = () => {},
}: {
  children: React.ReactNode;
  shortcut?: string;
  hoverShortcut?: string;
  value?: string;
  keywords?: string[];
  activeValue?: string;
  onSelect?: (value: string) => void;
}) {
  const isActive = activeValue === value;
  const hoverShortcut = '↵';

  return (
    <Command.Item
      onSelect={onSelect}
      value={value}
      keywords={keywords}
      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
        isActive ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : ''
      }`}
    >
      {children}
      {isActive ? (
        <div cmdk-vercel-shortcuts="" className="ml-auto flex items-center">
          <kbd className="min-w-5 h-5 rounded flex items-center justify-center bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs px-1.5 ml-2">
            {hoverShortcut}
          </kbd>
        </div>
      ) : (
        shortcut && (
          <div cmdk-vercel-shortcuts="" className="ml-auto flex items-center gap-1">
            {shortcut.split(' ').map((key) => {
              return (
                <kbd
                  key={key}
                  className="min-w-5 h-5 rounded flex items-center justify-center bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs px-1.5"
                >
                  {key}
                </kbd>
              );
            })}
          </div>
        )
      )}
    </Command.Item>
  );
}
