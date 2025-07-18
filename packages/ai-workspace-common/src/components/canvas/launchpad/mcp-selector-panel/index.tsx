import React, { useEffect, useState, useCallback } from 'react';
import { Button, Empty, Skeleton, Tooltip, Popover, Divider } from 'antd';
import type { PopoverProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { ChevronDown, CheckCircle2, ChevronRight } from 'lucide-react';
import { ReloadOutlined, ToolOutlined } from '@ant-design/icons';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { useListMcpServers } from '@refly-packages/ai-workspace-common/queries';
import { useLaunchpadStoreShallow } from '@refly/stores';
import { useUserStoreShallow } from '@refly/stores';
import { useSiderStoreShallow, SettingsModalActiveTab } from '@refly/stores';
import { Mcp, Checked, Settings } from 'refly-icons';

interface McpSelectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface McpSelectorPopoverProps {
  trigger?: React.ReactNode;
  placement?: PopoverProps['placement'];
  align?: { offset: [number, number] };
}

/**
 * MCP Selector Panel Component
 * Displays a list of available MCP servers for selection
 */
export const McpSelectorPanel: React.FC<McpSelectorPanelProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  // Get selected MCP servers from store
  const { selectedMcpServers, setSelectedMcpServers } = useLaunchpadStoreShallow((state) => ({
    selectedMcpServers: state.selectedMcpServers,
    setSelectedMcpServers: state.setSelectedMcpServers,
  }));

  const isLogin = useUserStoreShallow((state) => state.isLogin);

  // Get settings modal state
  const { setShowSettingModal, setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));

  // Fetch MCP servers from API
  const { data, refetch, isLoading, isRefetching } = useListMcpServers(
    { query: { enabled: true } },
    [],
    {
      enabled: isOpen && isLogin,
      refetchOnWindowFocus: false,
    },
  );

  const loading = isLoading || isRefetching;

  const mcpServers = data?.data || [];

  useEffect(() => {
    if (mcpServers.length > 0) {
      const userMcpServers = mcpServers
        .filter((server) => server.enabled)
        .filter((server) => selectedMcpServers.includes(server.name))
        .map((server) => server.name);

      setSelectedMcpServers(userMcpServers);
    }
  }, [mcpServers]);

  // Handle MCP server selection
  const handleMcpSelect = (mcpName: string) => {
    const newSelectedServers = selectedMcpServers.includes(mcpName)
      ? selectedMcpServers.filter((name) => name !== mcpName)
      : [...selectedMcpServers, mcpName];

    setSelectedMcpServers(newSelectedServers);
  };

  // Refresh MCP server list
  const handleRefresh = () => {
    refetch();
  };

  // Open settings modal and navigate to MCP Store
  const handleOpenMcpStore = () => {
    setSettingsModalActiveTab(SettingsModalActiveTab.McpServer);
    setShowSettingModal(true);
    onClose(); // Close the current panel
  };

  // Don't render if panel is closed
  if (!isOpen) return null;

  // Render content based on loading state and data availability
  const renderContent = () => {
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

    if (mcpServers.length === 0) {
      return (
        <div className="h-[140px] flex flex-col items-center justify-center">
          <Empty
            className="mb-2"
            imageStyle={{ height: 40, width: 40, margin: '4px auto' }}
            description={
              <span className="text-[12px] text-[#00968f]">{t('copilot.mcpSelector.empty')}</span>
            }
          />
          <Button
            type="link"
            size="small"
            onClick={handleOpenMcpStore}
            className="text-[12px] text-[#00968f] hover:text-[#007c74] p-0 flex items-center gap-1"
          >
            {t('copilot.mcpSelector.browseMcpStore')}
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      );
    }

    // 对 mcpServers 进行排序，将已选择的服务器排在前面
    const sortedMcpServers = [...mcpServers].sort((a, b) => {
      const aSelected = selectedMcpServers.includes(a.name);
      const bSelected = selectedMcpServers.includes(b.name);

      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });

    return sortedMcpServers.map((server) => {
      const displayDescription = server.url || server.command || '';
      return (
        <div
          key={server.name}
          className={cn(
            'group relative flex items-center justify-between',
            'rounded-lg border border-solid m-1 py-2 px-3 mb-2',
            'cursor-pointer transition-all duration-200',
            selectedMcpServers.includes(server.name)
              ? 'border-[#00968f] bg-[#00968f]/5 dark:bg-[#00968f]/10'
              : 'border-black/10 dark:border-gray-700',
            'hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm dark:hover:bg-gray-700 dark:hover:border-gray-600',
          )}
          onClick={() => handleMcpSelect(server.name)}
        >
          <div className="flex-1 min-w-0 flex flex-col">
            {' '}
            {/* Changed to flex-col for name and description stacking */}
            <div className="flex items-center">
              <ToolOutlined className="text-[#00968f] mr-2 flex-shrink-0" />
              <span className="text-[12px] text-gray-700 dark:text-gray-200 font-medium block truncate">
                {server.name}
              </span>
            </div>
            {/* Display server description */}
            <Tooltip title={displayDescription} placement="bottomLeft">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate ml-6">
                {displayDescription}
              </span>
            </Tooltip>
          </div>
          {selectedMcpServers.includes(server.name) && (
            <CheckCircle2 className="w-4 h-4 text-[#00968f] ml-2" />
          )}
        </div>
      );
    });
  };

  return (
    <div className="w-full border border-solid border-black/10 dark:border-gray-700 shadow-[0px_2px_6px_0px_rgba(0,0,0,0.1)] max-w-7xl mx-auto p-3 pb-1 space-y-1 rounded-t-lg bg-white dark:bg-gray-900">
      <div className="text-gray-800 font-bold flex items-center justify-between">
        <div className="flex items-center space-x-1 pl-1 dark:text-gray-200">
          <span>{t('copilot.mcpSelector.title')}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Tooltip title={t('copilot.mcpSelector.browseMcpStore')}>
            <Button
              type="text"
              size="small"
              icon={<ChevronRight className="w-4 h-4 text-gray-400" />}
              onClick={handleOpenMcpStore}
              className="text-[12px] text-[rgba(0,0,0,0.5)] dark:text-gray-400"
            />
          </Tooltip>
          <Tooltip title={t('copilot.recommendQuestions.refresh')}>
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined className="w-4 h-4 text-gray-400 text-[12px]" spin={loading} />}
              onClick={handleRefresh}
              disabled={loading}
              className="text-[12px] text-[rgba(0,0,0,0.5)] dark:text-gray-400"
            />
          </Tooltip>
          <Button
            type="text"
            size="small"
            icon={<ChevronDown className="w-4 h-4 text-gray-400" />}
            onClick={onClose}
            className="text-[12px] text-[rgba(0,0,0,0.5)]"
          />
        </div>
      </div>

      <div className="h-[140px] overflow-y-auto">{renderContent()}</div>
    </div>
  );
};

/**
 * MCP Selector Popover Component
 * A popover wrapper around the MCP selector with a trigger button
 */
export const McpSelectorPopover: React.FC<McpSelectorPopoverProps> = ({
  trigger,
  placement = 'bottomLeft',
  align = { offset: [0, 8] },
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Get selected MCP servers from store
  const { selectedMcpServers, setSelectedMcpServers } = useLaunchpadStoreShallow((state) => ({
    selectedMcpServers: state.selectedMcpServers,
    setSelectedMcpServers: state.setSelectedMcpServers,
  }));

  const isLogin = useUserStoreShallow((state) => state.isLogin);
  if (!isLogin) return null;

  // Get settings modal state
  const { setShowSettingModal, setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));

  // Fetch MCP servers from API
  const { data, isLoading, isRefetching } = useListMcpServers({ query: { enabled: true } }, [], {
    enabled: open && isLogin,
    refetchOnWindowFocus: false,
  });

  const loading = isLoading || isRefetching;
  const mcpServers = data?.data || [];

  // Handle MCP server selection
  const handleMcpSelect = useCallback(
    (mcpName: string) => {
      const newSelectedServers = selectedMcpServers.includes(mcpName)
        ? selectedMcpServers.filter((name) => name !== mcpName)
        : [...selectedMcpServers, mcpName];

      setSelectedMcpServers(newSelectedServers);
    },
    [selectedMcpServers, setSelectedMcpServers],
  );

  const handleOpenMcpStore = useCallback(() => {
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
          imageStyle={{ height: 26, width: 26, margin: '4px auto' }}
          description={
            <div className="text-refly-text-2 text-xs mt-2">{t('copilot.mcpSelector.empty')}</div>
          }
          image={<Mcp size={26} color="var(--refly-text-3)" />}
        />
        <Button
          type="text"
          size="small"
          onClick={handleOpenMcpStore}
          className="mt-1 text-xs font-semibold text-refly-primary-default"
        >
          {t('copilot.mcpSelector.browseMcpStore')}
        </Button>
      </div>
    );
  }, [mcpServers]);

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

    if (mcpServers.length === 0) {
      return renderEmpty();
    }

    const sortedMcpServers = [...mcpServers].sort((a, b) => {
      const aSelected = selectedMcpServers.includes(a.name);
      const bSelected = selectedMcpServers.includes(b.name);

      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });

    return (
      <div className="text-refly-text-0">
        <div className="flex flex-col gap-1.5 p-2">
          {sortedMcpServers.map((server) => {
            return (
              <div
                key={server.name}
                className={cn(
                  'flex items-center justify-between gap-2 px-2 h-8 rounded-lg hover:bg-refly-tertiary-hover',
                  'cursor-pointer transition-all duration-200',
                  selectedMcpServers.includes(server.name) ? 'bg-refly-tertiary-default' : '',
                )}
                onClick={() => handleMcpSelect(server.name)}
              >
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-center gap-2">
                    <Mcp size={16} color="var(--refly-text-0)" />
                    <span className="text-[12px] text-gray-700 dark:text-gray-200 font-medium block truncate">
                      {server.name}
                    </span>
                  </div>
                </div>
                {selectedMcpServers.includes(server.name) && (
                  <Checked size={14} color="var(--refly-primary-default)" />
                )}
              </div>
            );
          })}
        </div>
        <Divider className="!my-0 border-refly-Card-Border" />
        <div
          className="p-3 flex items-center gap-2 hover:bg-refly-tertiary-hover cursor-pointer"
          onClick={handleOpenMcpStore}
        >
          <Settings size={16} color="var(--refly-text-0)" />
          <div className="text-refly-text-0 text-xs font-medium">
            {t('copilot.mcpSelector.manageMcpServers')}
          </div>
        </div>
      </div>
    );
  }, [loading, mcpServers, selectedMcpServers, handleMcpSelect, handleOpenMcpStore, t]);

  const defaultTrigger = (
    <Tooltip title={t('copilot.mcpSelector.useMcpServers')} placement="bottom">
      <Button
        className="gap-0 h-7 w-7 flex items-center justify-center"
        type="text"
        size="small"
        icon={<Mcp size={16} className="flex items-center" />}
      >
        <span className="text-refly-text-2 text-xs font-semibold ml-[2px]">
          {selectedMcpServers?.length > 0 ? selectedMcpServers.length : ''}
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
      overlayInnerStyle={{ padding: 0, boxShadow: 'none' }}
      content={
        <div className="w-[240px] max-h-[320px] overflow-y-auto border-1 border-solid border-refly-Card-Border rounded-lg bg-refly-bg-content-z2 shadow-[0_8px_40px_0px_rgba(0,0,0,0.08)]">
          {renderContent()}
        </div>
      }
    >
      {trigger || defaultTrigger}
    </Popover>
  );
};
