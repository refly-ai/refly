import React, { useEffect } from 'react';
import { Button, Empty, Skeleton, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { ChevronDown, CheckCircle2 } from 'lucide-react';
import { ReloadOutlined, ToolOutlined } from '@ant-design/icons';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { useListMcpServers } from '@refly-packages/ai-workspace-common/queries';
import { useLaunchpadStoreShallow } from '@refly-packages/ai-workspace-common/stores/launchpad';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
// McpServerDTO is used implicitly through the API response

interface McpSelectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
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
        <Empty
          className="mb-2"
          imageStyle={{ height: 40, width: 40, margin: '4px auto' }}
          description={
            <span className="text-[12px] text-[#00968f]">{t('copilot.mcpSelector.empty')}</span>
          }
        />
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
