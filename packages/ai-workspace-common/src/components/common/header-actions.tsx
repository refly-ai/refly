import React, { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Popconfirm, Button, Input } from 'antd';
import {
  IconDelete,
  IconRemove,
  IconPlus,
  IconSearch,
  IconExit,
  IconEdit,
} from '@refly-packages/ai-workspace-common/components/common/icon';

import cn from 'classnames';

export const iconClassName =
  'w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center hover:text-gray-700';

export interface HeaderActionsProps {
  source?: 'source' | 'canvas';
  isSearchMode: boolean;
  isMultiSelectMode: boolean;
  searchValue: string;
  selectedItems: any[];
  onSearchChange: (value: string) => void;
  onToggleSearchMode: () => void;
  onExitMultiSelectMode: () => void;
  onDeleteSelected: () => void;
  onRemoveSelected: () => void;
  onAddItem?: () => void;
  onAddSelectedSourcesToCanvas?: () => void;
  addButtonNode?: ReactNode;
  itemCountText?: string;
}

const HeaderActions = ({
  source,
  isSearchMode,
  isMultiSelectMode,
  searchValue,
  selectedItems,
  onSearchChange,
  onToggleSearchMode,
  onExitMultiSelectMode,
  onDeleteSelected,
  onRemoveSelected,
  onAddItem,
  onAddSelectedSourcesToCanvas,
  addButtonNode,
  itemCountText,
}: HeaderActionsProps) => {
  const { t } = useTranslation();

  const actions = useMemo(() => {
    if (isSearchMode || isMultiSelectMode) {
      return (
        <>
          {isMultiSelectMode && (
            <div className="flex items-center justify-between gap-2 mt-2">
              <div className="text-xs text-gray-500">
                {t('project.sourceList.selectedCount', { count: selectedItems?.length ?? 0 })}
              </div>
              <div className="flex items-center gap-1">
                <Popconfirm
                  title={t('project.sourceList.deleteConfirm')}
                  onConfirm={onDeleteSelected}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<IconDelete className={cn(iconClassName, 'text-red-500')} />}
                  />
                </Popconfirm>

                <Popconfirm
                  title={t('project.sourceList.removeConfirm')}
                  onConfirm={onRemoveSelected}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<IconRemove className={cn(iconClassName, 'text-gray-500')} />}
                  />
                </Popconfirm>

                {source === 'source' && (
                  <Button
                    type="text"
                    size="small"
                    icon={<IconEdit className={cn(iconClassName, 'text-gray-500')} />}
                    onClick={() => onAddSelectedSourcesToCanvas?.()}
                  />
                )}

                <Button
                  type="text"
                  size="small"
                  icon={<IconExit className={cn(iconClassName, 'text-gray-500')} />}
                  onClick={onExitMultiSelectMode}
                />
              </div>
            </div>
          )}

          {isSearchMode && (
            <div className="flex items-center gap-1 w-full justify-between mt-2">
              <Input
                autoFocus
                type="text"
                className="text-xs px-2 py-1 border border-gray-200 rounded-md flex-grow focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={t('project.sourceList.searchPlaceholder')}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              <Button
                type="text"
                size="small"
                icon={<IconExit className={cn(iconClassName, 'text-gray-500')} />}
                onClick={onToggleSearchMode}
              />
            </div>
          )}
        </>
      );
    }

    return (
      <div className="flex items-center gap-1">
        {addButtonNode ? (
          addButtonNode
        ) : (
          <Button
            type="text"
            size="small"
            icon={<IconPlus className={cn(iconClassName, 'text-gray-500')} />}
            onClick={onAddItem}
          />
        )}
        <Button
          type="text"
          size="small"
          icon={<IconSearch className={cn(iconClassName, 'text-gray-500')} />}
          onClick={onToggleSearchMode}
        />
      </div>
    );
  }, [
    isMultiSelectMode,
    isSearchMode,
    searchValue,
    selectedItems?.length,
    onDeleteSelected,
    onExitMultiSelectMode,
    onRemoveSelected,
    onSearchChange,
    onToggleSearchMode,
    addButtonNode,
    onAddItem,
    t,
  ]);

  return (
    <div
      className={`mb-2 px-3 ${isMultiSelectMode || isSearchMode ? '' : 'flex justify-between items-center'}`}
    >
      {itemCountText && <div className="text-[10px] text-gray-500">{itemCountText}</div>}
      {actions}
    </div>
  );
};

export default React.memo(HeaderActions);
