import React, { ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Popconfirm, Button, Input, Tooltip, Affix, Modal, message } from 'antd';
import {
  IconDelete,
  IconRemove,
  IconPlus,
  IconSearch,
  IconExit,
} from '@refly-packages/ai-workspace-common/components/common/icon';

import cn from 'classnames';
import { IoAlertCircle } from 'react-icons/io5';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';

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
  onDeleteSelected: (afterDelete?: () => void) => void;
  isDeleteLoading: boolean;
  onRemoveSelected: () => void;
  onAddItem?: () => void;
  onAddSelectedSourcesToCanvas?: () => void;
  addButtonNode?: ReactNode;
  itemCountText?: string;
  useAffix?: boolean;
  target?: () => HTMLElement;
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
  isDeleteLoading,
  onRemoveSelected,
  onAddItem,
  onAddSelectedSourcesToCanvas,
  addButtonNode,
  itemCountText,
  useAffix = false,
  target,
}: HeaderActionsProps) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isCanvasOpen } = useGetProjectCanvasId();

  const actions = useMemo(() => {
    if (isSearchMode || isMultiSelectMode) {
      return (
        <>
          {isMultiSelectMode && (
            <div className="flex items-center justify-between gap-2 mt-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('project.sourceList.selectedCount', { count: selectedItems?.length ?? 0 })}
              </div>
              <div className="flex items-center gap-1">
                <Tooltip title={t('project.action.delete')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<IconDelete className={cn(iconClassName, 'text-red-500')} />}
                    onClick={() => setIsModalOpen(true)}
                  />
                </Tooltip>

                <Tooltip title={t('project.action.remove')}>
                  <Popconfirm
                    title={
                      <div className="max-w-[300px] text-sm">
                        {t('project.sourceList.removeConfirm')}
                      </div>
                    }
                    onConfirm={onRemoveSelected}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={
                        <IconRemove
                          className={cn(iconClassName, 'text-gray-500 dark:text-gray-400"')}
                        />
                      }
                    />
                  </Popconfirm>
                </Tooltip>

                {source === 'source' && (
                  <Tooltip title={t('project.action.addToCanvas')}>
                    <Button
                      type="text"
                      size="small"
                      icon={
                        <IconPlus
                          className={cn(iconClassName, 'text-gray-500 dark:text-gray-400"')}
                        />
                      }
                      onClick={() => {
                        if (isCanvasOpen) {
                          onAddSelectedSourcesToCanvas?.();
                        } else {
                          message.error(t('workspace.noCanvasSelected'));
                        }
                      }}
                    />
                  </Tooltip>
                )}

                <Tooltip title={t('project.action.exit')}>
                  <Button
                    type="text"
                    size="small"
                    icon={
                      <IconExit
                        className={cn(iconClassName, 'text-gray-500 dark:text-gray-400"')}
                      />
                    }
                    onClick={onExitMultiSelectMode}
                  />
                </Tooltip>
              </div>
            </div>
          )}

          {isSearchMode && (
            <div className="flex items-center gap-1 w-full justify-between mt-2">
              <Input
                autoFocus
                type="text"
                className="text-xs px-2 py-1 border border-gray-200 rounded-md flex-grow focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
                placeholder={t('project.sourceList.searchPlaceholder')}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              <Tooltip title={t('project.action.exit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<IconExit className={cn(iconClassName, 'text-gray-500')} />}
                  onClick={onToggleSearchMode}
                />
              </Tooltip>
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
            icon={<IconPlus className={cn(iconClassName, 'text-gray-500 dark:text-gray-400"')} />}
            onClick={onAddItem}
          />
        )}
        <Button
          type="text"
          size="small"
          icon={<IconSearch className={cn(iconClassName, 'text-gray-500 dark:text-gray-400"')} />}
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
    source,
    onAddSelectedSourcesToCanvas,
    setIsModalOpen,
  ]);

  const headerContent = (
    <div
      className={`mb-2 px-3 ${isMultiSelectMode || isSearchMode ? '' : 'flex justify-between items-center'} ${useAffix ? 'bg-white py-2 z-20 w-full dark:bg-gray-900 shadow-sm' : ''}`}
    >
      {itemCountText && <div className="text-[10px] text-gray-500">{itemCountText}</div>}
      {actions}
      <Modal
        centered
        width={416}
        open={isModalOpen}
        onOk={() => onDeleteSelected(() => setIsModalOpen(false))}
        okText={t('common.confirm')}
        okButtonProps={{ danger: true, loading: isDeleteLoading }}
        cancelText={t('common.cancel')}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={isDeleteLoading}
        title={
          <div className="flex items-center gap-2">
            <IoAlertCircle size={26} className="mr-2 text-[#faad14]" />
            {t('common.deleteConfirmMessage')}
          </div>
        }
      >
        <div>
          {t('project.sourceList.deleteConfirm', {
            count: selectedItems.length,
          })}
        </div>
        <div className="mt-2 px-4 text-xs text-gray-500">
          {selectedItems.slice(0, 10).map((item, index) => (
            <div key={item.id}>
              {index + 1}. {item.title || item.name || t('common.untitled')}
            </div>
          ))}
          {selectedItems.length > 10 && <div>...</div>}
        </div>
      </Modal>
    </div>
  );

  if (useAffix) {
    return (
      <Affix offsetTop={0} className="z-20 w-full" target={target}>
        <div className="w-full overflow-hidden">{headerContent}</div>
      </Affix>
    );
  }

  return headerContent;
};

export default React.memo(HeaderActions);
