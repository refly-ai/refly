import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button, Empty, Skeleton, Tooltip, Popover, Divider } from 'antd';
import type { PopoverProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { useListTools } from '@refly-packages/ai-workspace-common/queries';
import { useLaunchpadStoreShallow, useUserStoreShallow } from '@refly/stores';
import { useSiderStoreShallow, SettingsModalActiveTab } from '@refly/stores';
import { Mcp, Checked, Settings } from 'refly-icons';
import { GenericToolset } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';

interface ToolsetSelectorPopoverProps {
  trigger?: React.ReactNode;
  placement?: PopoverProps['placement'];
  align?: { offset: [number, number] };
  selectedToolsets: GenericToolset[];
  onSelectedToolsetsChange: (toolsets: GenericToolset[]) => void;
}

/**
 * Tool Selector Popover Component
 * A popover wrapper around the tool selector with a trigger button
 * Now manages selectedToolsets locally through props instead of global state
 */
export const ToolSelectorPopover: React.FC<ToolsetSelectorPopoverProps> = ({
  trigger,
  placement = 'bottomLeft',
  align = { offset: [0, 8] },
  selectedToolsets = [],
  onSelectedToolsetsChange,
}) => {
  const { t, i18n } = useTranslation();
  const currentLanguage = (i18n.language || 'en') as 'en' | 'zh';
  const [open, setOpen] = useState(false);

  const selectedToolsetIds = new Set(selectedToolsets?.map((toolset) => toolset.id) ?? []);

  const isLogin = useUserStoreShallow((state) => state.isLogin);
  if (!isLogin) return null;
  const { setSelectedToolsets } = useLaunchpadStoreShallow((state) => ({
    setSelectedToolsets: state.setSelectedToolsets,
  }));

  // Get settings modal state
  const { setShowSettingModal, setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));

  // Fetch tools from API
  const { data, isLoading, isRefetching } = useListTools({ query: { enabled: true } }, [], {
    enabled: isLogin,
    refetchOnWindowFocus: false,
  });

  const loading = isLoading || isRefetching;
  const toolsets = data?.data || [];
  const builtinToolsets = toolsets?.filter((toolset) => toolset?.id === 'builtin') ?? [];

  // Ensure builtin toolsets are initialized exactly once when no selection is provided
  const hasInitializedBuiltinToolsets = useRef(false);
  useEffect(() => {
    if (hasInitializedBuiltinToolsets.current) return;
    const hasNoSelection = !(selectedToolsets?.length ?? 0);
    const hasBuiltin = (builtinToolsets?.length ?? 0) > 0;
    if (hasNoSelection && hasBuiltin) {
      onSelectedToolsetsChange?.(builtinToolsets);
      setSelectedToolsets?.(builtinToolsets);
      hasInitializedBuiltinToolsets.current = true;
    }
  }, [selectedToolsets, builtinToolsets, onSelectedToolsetsChange, setSelectedToolsets]);

  useEffect(() => {
    if (selectedToolsets?.length && toolsets?.length) {
      const availableToolsetIds = new Set(toolsets.map((toolset) => toolset.id));
      const filteredSelectedToolsets = selectedToolsets.filter((toolset) =>
        availableToolsetIds.has(toolset.id),
      );

      if (filteredSelectedToolsets.length !== selectedToolsets.length) {
        onSelectedToolsetsChange?.(filteredSelectedToolsets);
        setSelectedToolsets?.(filteredSelectedToolsets);
      }
    }
  }, [toolsets, selectedToolsets, onSelectedToolsetsChange, setSelectedToolsets]);

  const handleToolSelect = useCallback(
    (toolset: GenericToolset) => {
      hasInitializedBuiltinToolsets.current = true;
      const newSelectedToolsets = selectedToolsetIds.has(toolset.id)
        ? (selectedToolsets?.filter((t) => t.id !== toolset.id) ?? [])
        : [
            ...(selectedToolsets ?? []),
            {
              id: toolset.id,
              type: toolset.type,
              name: toolset.name,
              toolset: toolset.toolset,
              mcpServer: toolset.mcpServer,
            },
          ];

      onSelectedToolsetsChange(newSelectedToolsets);
      setSelectedToolsets(newSelectedToolsets);
    },
    [selectedToolsets, selectedToolsetIds, onSelectedToolsetsChange, setSelectedToolsets],
  );

  const handleOpenToolStore = useCallback(() => {
    setSettingsModalActiveTab(SettingsModalActiveTab.ToolsConfig);
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
      <div className="text-refly-text-0 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-1.5 p-2">
            {sortedToolsets.map((toolset) => {
              const description =
                toolset?.type === 'mcp'
                  ? toolset.mcpServer.url
                  : toolset?.toolset?.definition?.descriptionDict?.[currentLanguage];

              const labelName =
                toolset?.type === 'regular' && toolset?.id === 'builtin'
                  ? (toolset?.toolset?.definition?.labelDict?.[currentLanguage] as string)
                  : toolset.name;

              const isBuiltin = toolset.id === 'builtin';
              return (
                <div
                  key={toolset.id}
                  className={cn(
                    'flex items-center justify-between gap-2 px-2 py-1 rounded-lg hover:bg-refly-tertiary-hover',
                    'cursor-pointer transition-all duration-200',
                    selectedToolsetIds.has(toolset.id) ? 'bg-refly-tertiary-default' : '',
                  )}
                  onClick={() => handleToolSelect(toolset)}
                >
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-center gap-3">
                      <ToolsetIcon
                        toolset={toolset}
                        isBuiltin={isBuiltin}
                        config={{ builtinClassName: '!w-6 !h-6' }}
                      />
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="text-sm text-refly-text-0 font-semibold block truncate leading-5">
                          {labelName || toolset.name}
                        </div>
                        <div className="text-xs text-refly-text-2 font-normal block truncate leading-4">
                          {description as string}
                        </div>
                      </div>
                    </div>
                  </div>
                  {selectedToolsetIds.has(toolset.id) && (
                    <Checked size={14} color="var(--refly-primary-default)" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <Divider className="!my-0 border-refly-Card-Border" />
        <div
          className="flex-shrink-0 p-3 flex items-center gap-2 hover:bg-refly-tertiary-hover cursor-pointer"
          onClick={handleOpenToolStore}
        >
          <Settings size={18} color="var(--refly-text-0)" />
          <div className="text-refly-text-0 text-sm font-medium">{t('tools.manageTools')}</div>
        </div>
      </div>
    );
  }, [loading, toolsets, selectedToolsets, handleToolSelect, handleOpenToolStore, t]);

  const defaultTrigger = (
    <Tooltip title={t('tools.useTools')} placement="bottom">
      <Button
        className={cn(
          'gap-0 h-7 w-auto flex items-center justify-center hover:bg-refly-tertiary-hover',
          {
            '!w-7': !selectedToolsets?.length,
            'bg-refly-bg-control-z0': selectedToolsets?.length,
            'bg-refly-fill-active': open,
          },
        )}
        type="text"
        size="small"
        icon={<Mcp size={20} className="flex items-center" />}
      >
        {selectedToolsets?.length > 0 && (
          <div className="ml-1.5 flex items-center">
            {selectedToolsets.slice(0, 3).map((toolset) => {
              return (
                <ToolsetIcon
                  key={toolset.id}
                  toolset={toolset}
                  isBuiltin={toolset.id === 'builtin'}
                  config={{
                    size: 14,
                    className:
                      'bg-refly-bg-body-z0 shadow-refly-s p-0.5 -mr-[7px] last:mr-0 rounded-full',
                    builtinClassName: '!w-3.5 !h-3.5',
                  }}
                />
              );
            })}
            {selectedToolsets.length > 3 && (
              <div className="min-w-[18px] h-[18px] p-0.5 box-border flex items-center justify-center rounded-full bg-refly-bg-body-z0 shadow-refly-s text-refly-text-1 text-[10px]">
                +{selectedToolsets.length - 3}
              </div>
            )}
          </div>
        )}
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
      styles={{ body: { padding: 0 } }}
      content={
        <div className="w-[340px] h-[320px] border-[1px] border-solid border-refly-Card-Border rounded-lg bg-refly-bg-content-z2 shadow-[0_8px_40px_0px_rgba(0,0,0,0.08)]">
          {renderContent()}
        </div>
      }
    >
      {trigger || defaultTrigger}
    </Popover>
  );
};
