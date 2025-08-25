import React, { useState, useCallback } from 'react';
import { Button, Empty, Skeleton, Tooltip, Popover, Divider } from 'antd';
import type { PopoverProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { useListTools } from '@refly-packages/ai-workspace-common/queries';
import { useLaunchpadStoreShallow } from '@refly/stores';
import { useUserStoreShallow } from '@refly/stores';
import { useSiderStoreShallow, SettingsModalActiveTab } from '@refly/stores';
import { Mcp, Checked, Settings } from 'refly-icons';
import { GenericToolset } from '@refly/openapi-schema';

interface ToolsetSelectorPopoverProps {
  trigger?: React.ReactNode;
  placement?: PopoverProps['placement'];
  align?: { offset: [number, number] };
}

/**
 * Tool Selector Popover Component
 * A popover wrapper around the tool selector with a trigger button
 */
export const ToolSelectorPopover: React.FC<ToolsetSelectorPopoverProps> = ({
  trigger,
  placement = 'bottomLeft',
  align = { offset: [0, 8] },
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Get selected MCP servers from store
  const { selectedToolsets, setSelectedToolsets } = useLaunchpadStoreShallow((state) => ({
    selectedToolsets: state.selectedToolsets,
    setSelectedToolsets: state.setSelectedToolsets,
  }));
  const selectedToolsetIds = new Set(selectedToolsets.map((toolset) => toolset.id));

  const isLogin = useUserStoreShallow((state) => state.isLogin);
  if (!isLogin) return null;

  // Get settings modal state
  const { setShowSettingModal, setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));

  // Fetch MCP servers from API
  const { data, isLoading, isRefetching } = useListTools({ query: { enabled: true } }, [], {
    enabled: open && isLogin,
    refetchOnWindowFocus: false,
  });

  const loading = isLoading || isRefetching;
  const toolsets = data?.data || [];

  const handleToolSelect = useCallback(
    (toolset: GenericToolset) => {
      const newSelectedToolsets = selectedToolsetIds.has(toolset.id)
        ? selectedToolsets.filter((t) => t.id !== toolset.id)
        : [
            ...selectedToolsets,
            {
              id: toolset.id,
              type: toolset.type,
              name: toolset.name,
            },
          ];

      setSelectedToolsets(newSelectedToolsets);
    },
    [selectedToolsets, selectedToolsetIds, setSelectedToolsets],
  );

  const handleOpenToolStore = useCallback(() => {
    setSettingsModalActiveTab(SettingsModalActiveTab.McpServer);
    setShowSettingModal(true);
    setOpen(false);
  }, [setSettingsModalActiveTab, setShowSettingModal]);

  const handleOpenChange = useCallback((visible: boolean) => {
    setOpen(visible);
  }, []);

  const renderEmpty = useCallback(() => {
    return (
      <div className="h-full w-full px-2 py-6 flex flex-col items-center justify-center">
        <Empty
          styles={{ image: { height: 26, width: 26, margin: '4px auto' } }}
          description={<div className="text-refly-text-2 text-xs mt-2">{t('tools.empty')}</div>}
          image={<Mcp size={26} color="var(--refly-text-3)" />}
        />
        <Button
          type="text"
          size="small"
          onClick={handleOpenToolStore}
          className="mt-1 text-xs font-semibold text-refly-primary-default"
        >
          {t('tools.browseToolStore')}
        </Button>
      </div>
    );
  }, [handleOpenToolStore, t]);

  const renderContent = useCallback(() => {
    if (loading) {
      return (
        <div className="space-y-3 px-1 h-[140px] flex flex-col justify-center">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-lg p-2">
              <Skeleton
                active
                paragraph={false}
                title={{
                  width: '100%',
                  style: {
                    height: '12px',
                    marginBottom: 0,
                  },
                }}
              />
            </div>
          ))}
        </div>
      );
    }

    if (toolsets.length === 0) {
      return renderEmpty();
    }

    const sortedToolsets = [...toolsets].sort((a, b) => {
      const aSelected = selectedToolsetIds.has(a.id);
      const bSelected = selectedToolsetIds.has(b.id);

      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });

    return (
      <div className="text-refly-text-0">
        <div className="flex flex-col gap-1.5 p-2">
          {sortedToolsets.map((toolset) => {
            return (
              <div
                key={toolset.id}
                className={cn(
                  'flex items-center justify-between gap-2 px-2 h-8 rounded-lg hover:bg-refly-tertiary-hover',
                  'cursor-pointer transition-all duration-200',
                  selectedToolsetIds.has(toolset.id) ? 'bg-refly-tertiary-default' : '',
                )}
                onClick={() => handleToolSelect(toolset)}
              >
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-center gap-2">
                    <Mcp size={16} color="var(--refly-text-0)" />
                    <span className="text-[12px] text-gray-700 dark:text-gray-200 font-medium block truncate">
                      {toolset.type === 'mcp' ? toolset.mcpServer?.name : toolset.toolset?.name}
                    </span>
                  </div>
                </div>
                {selectedToolsetIds.has(toolset.id) && (
                  <Checked size={14} color="var(--refly-primary-default)" />
                )}
              </div>
            );
          })}
        </div>
        <Divider className="!my-0 border-refly-Card-Border" />
        <div
          className="p-3 flex items-center gap-2 hover:bg-refly-tertiary-hover cursor-pointer"
          onClick={handleOpenToolStore}
        >
          <Settings size={16} color="var(--refly-text-0)" />
          <div className="text-refly-text-0 text-xs font-medium">{t('tools.manageTools')}</div>
        </div>
      </div>
    );
  }, [loading, toolsets, selectedToolsets, handleToolSelect, handleOpenToolStore, t]);

  const defaultTrigger = (
    <Tooltip title={t('tools.useTools')} placement="bottom">
      <Button
        className="gap-0 h-7 w-7 flex items-center justify-center"
        type="text"
        size="small"
        icon={<Mcp size={20} className="flex items-center" />}
      >
        <span className="text-refly-text-2 text-xs font-semibold ml-[2px]">
          {selectedToolsets?.length > 0 ? selectedToolsets.length : ''}
        </span>
      </Button>
    </Tooltip>
  );

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      placement={placement}
      align={align}
      trigger="click"
      arrow={false}
      styles={{ body: { padding: 0, boxShadow: 'none' } }}
      content={
        <div className="w-[240px] max-h-[320px] overflow-y-auto border-[1px] border-solid border-refly-Card-Border rounded-lg bg-refly-bg-content-z2 shadow-[0_8px_40px_0px_rgba(0,0,0,0.08)]">
          {renderContent()}
        </div>
      }
    >
      {trigger || defaultTrigger}
    </Popover>
  );
};
