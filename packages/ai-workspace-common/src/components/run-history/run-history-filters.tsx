import { memo, useCallback, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, Button, Checkbox, Input, Tag } from 'antd';
import { ChevronDown, Search, X } from 'lucide-react';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { useToolsetDefinition } from '@refly-packages/ai-workspace-common/hooks/use-toolset-definition';
import type { MenuProps } from 'antd';
import './index.scss';

export type RunStatusFilter = 'all' | 'success' | 'failed';
export type RunTypeFilter = 'all' | 'workflow' | 'template' | 'schedule';

export interface RunHistoryFiltersProps {
  // Search by title
  titleFilter: string;
  onTitleChange: (value: string) => void;
  // Search by canvasId
  canvasIdFilter: string;
  onCanvasIdChange: (value: string) => void;
  // Type filter
  typeFilter: RunTypeFilter;
  onTypeChange: (type: RunTypeFilter) => void;
  // Status filter
  statusFilter: RunStatusFilter;
  onStatusChange: (status: RunStatusFilter) => void;
  // Tools filter
  selectedTools: string[];
  onToolsChange: (tools: string[]) => void;
  availableTools: { id: string; name: string }[];
}

export const RunHistoryFilters = memo(
  ({
    titleFilter,
    onTitleChange,
    canvasIdFilter,
    onCanvasIdChange,
    typeFilter,
    onTypeChange,
    statusFilter,
    onStatusChange,
    selectedTools,
    onToolsChange,
    availableTools,
  }: RunHistoryFiltersProps) => {
    const { t, i18n } = useTranslation();
    const currentLanguage = (i18n.language || 'en') as 'en' | 'zh';
    const [toolSearchValue, setToolSearchValue] = useState('');
    const [searchInputValue, setSearchInputValue] = useState('');
    const { lookupToolsetDefinitionByKey } = useToolsetDefinition();

    // Get localized tool name
    const getToolName = useCallback(
      (toolId: string) => {
        const definition = lookupToolsetDefinitionByKey(toolId);
        if (definition?.labelDict?.[currentLanguage]) {
          return definition.labelDict[currentLanguage] as string;
        }
        // Fallback to availableTools name or toolId
        const tool = availableTools.find((t) => t.id === toolId);
        return tool?.name || toolId;
      },
      [lookupToolsetDefinitionByKey, currentLanguage, availableTools],
    );

    // Enrich available tools with localized names
    const enrichedTools = useMemo(() => {
      return availableTools.map((tool) => ({
        ...tool,
        displayName: getToolName(tool.id),
      }));
    }, [availableTools, getToolName]);

    // Type options
    const typeOptions: { value: RunTypeFilter; label: string }[] = [
      { value: 'all', label: t('runHistory.filters.typeAll') },
      // { value: 'workflow', label: t('runHistory.filters.typeWorkflow') },
      // { value: 'template', label: t('runHistory.filters.typeTemplate') },
      { value: 'schedule', label: t('runHistory.filters.typeSchedule') },
    ];

    // Status options
    const statusOptions: { value: RunStatusFilter; label: string }[] = [
      { value: 'all', label: t('runHistory.status.all') },
      { value: 'success', label: t('runHistory.status.succeeded') },
      { value: 'failed', label: t('runHistory.status.failed') },
    ];

    // Get display labels
    const getTypeLabel = () => {
      const selected = typeOptions.find((t) => t.value === typeFilter);
      return selected?.label || t('runHistory.filters.typeAll');
    };

    const getStatusLabel = () => {
      const selected = statusOptions.find((s) => s.value === statusFilter);
      return selected?.label || t('runHistory.status.all');
    };

    const getToolsLabel = () => {
      if (selectedTools.length === 0) return t('runHistory.filters.selectTools');
      if (selectedTools.length === 1) {
        return getToolName(selectedTools[0]);
      }
      return t('runHistory.filters.toolsSelected', { count: selectedTools.length });
    };

    // Handle tool toggle
    const handleToolToggle = useCallback(
      (toolId: string) => {
        if (selectedTools.includes(toolId)) {
          onToolsChange(selectedTools.filter((t) => t !== toolId));
        } else {
          onToolsChange([...selectedTools, toolId]);
        }
      },
      [selectedTools, onToolsChange],
    );

    // Clear all tools
    const handleClearAllTools = useCallback(() => {
      onToolsChange([]);
    }, [onToolsChange]);

    // Handle search input submit (Enter key or search button)
    const handleSearchSubmit = useCallback(() => {
      const value = searchInputValue.trim();
      if (!value) return;

      // Clear old title/canvasId filters when new search is entered
      onTitleChange('');
      onCanvasIdChange('');

      // Parse for canvasId: prefix
      const canvasIdMatch = value.match(/^canvasId:\s*(.+)$/i);
      if (canvasIdMatch) {
        onCanvasIdChange(canvasIdMatch[1].trim());
      } else {
        onTitleChange(value);
      }

      // Clear input after submit
      setSearchInputValue('');
    }, [searchInputValue, onTitleChange, onCanvasIdChange]);

    // Handle input key press
    const handleSearchKeyPress = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          handleSearchSubmit();
        }
      },
      [handleSearchSubmit],
    );

    // Remove individual filter
    const handleRemoveFilter = useCallback(
      (type: 'type' | 'tool' | 'status' | 'title' | 'canvasId', value?: string) => {
        if (type === 'type') {
          onTypeChange('all');
        } else if (type === 'tool' && value) {
          onToolsChange(selectedTools.filter((t) => t !== value));
        } else if (type === 'status') {
          onStatusChange('all');
        } else if (type === 'title') {
          onTitleChange('');
        } else if (type === 'canvasId') {
          onCanvasIdChange('');
        }
      },
      [onTypeChange, onStatusChange, onToolsChange, onTitleChange, onCanvasIdChange, selectedTools],
    );

    // Filter tools by search (using displayName for search)
    const filteredTools = enrichedTools.filter((tool) =>
      tool.displayName.toLowerCase().includes(toolSearchValue.toLowerCase()),
    );

    // Type dropdown menu
    const typeMenuItems: MenuProps['items'] = typeOptions.map((option) => ({
      key: option.value,
      className: '!h-[36px] !leading-[36px]',
      label: (
        <div className="flex items-center justify-between">
          <span>{option.label}</span>
          {typeFilter === option.value && <span className="text-primary">✓</span>}
        </div>
      ),
      onClick: () => onTypeChange(option.value),
    }));

    // Status dropdown menu
    const statusMenuItems: MenuProps['items'] = statusOptions.map((option) => ({
      key: option.value,
      className: '!h-[36px] !leading-[36px]',
      label: (
        <div className="flex items-center justify-between">
          <span>{option.label}</span>
          {statusFilter === option.value && <span className="text-primary">✓</span>}
        </div>
      ),
      onClick: () => onStatusChange(option.value),
    }));

    // Tools dropdown content
    const toolsDropdownContent = (
      <div className="w-[250px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        {/* Search input */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <Input
            placeholder={t('runHistory.filters.searchTools')}
            prefix={<Search size={14} className="text-gray-400" />}
            value={toolSearchValue}
            onChange={(e) => setToolSearchValue(e.target.value)}
            allowClear
            className="!h-[36px]"
          />
        </div>
        {/* Tool checkboxes */}
        <div className="max-h-[200px] overflow-y-auto py-1">
          {filteredTools.length > 0 ? (
            filteredTools.map((tool) => (
              <div
                key={tool.id}
                className="px-3 h-[40px] flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => handleToolToggle(tool.id)}
              >
                <Checkbox checked={selectedTools.includes(tool.id)} className="mr-2" />
                <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded overflow-hidden mr-2">
                  <ToolsetIcon toolsetKey={tool.id} config={{ size: 18 }} />
                </div>
                <span className="truncate">{tool.displayName}</span>
              </div>
            ))
          ) : (
            <div className="px-3 h-[40px] flex items-center text-gray-400 text-sm">
              {t('runHistory.filters.noTools')}
            </div>
          )}
        </div>
        {/* Clear all button */}
        {selectedTools.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-2">
            <Button type="link" size="small" onClick={handleClearAllTools} className="w-full">
              {t('runHistory.filters.clearAllTools')}
            </Button>
          </div>
        )}
      </div>
    );

    // Check if any filters are active
    const hasActiveFilters =
      typeFilter !== 'all' ||
      selectedTools.length > 0 ||
      statusFilter !== 'all' ||
      !!titleFilter ||
      !!canvasIdFilter;

    return (
      <div className="run-history-filters">
        {/* Search bar - full width */}
        <Input
          placeholder={t('runHistory.searchPlaceholder')}
          prefix={<Search size={16} className="text-gray-400" />}
          value={searchInputValue}
          onChange={(e) => setSearchInputValue(e.target.value)}
          onKeyDown={handleSearchKeyPress}
          onPressEnter={handleSearchSubmit}
          allowClear
          className="w-full !h-[42px]"
        />

        {/* Filter dropdowns row */}
        <div className="flex items-center gap-3 mt-4">
          {/* Type filter */}
          <Dropdown menu={{ items: typeMenuItems }} trigger={['click']}>
            <Button className="flex items-center justify-between min-w-[150px] !h-[42px] !bg-transparent hover:!bg-transparent !border-[var(--ant-color-border)] hover:!border-[var(--ant-color-primary)]">
              <span className=" text-xs mr-2">{t('runHistory.filters.type')}</span>
              <span className="flex-1 text-left">{getTypeLabel()}</span>
              <ChevronDown size={14} className="ml-2 " />
            </Button>
          </Dropdown>

          {/* Tools filter */}
          {availableTools.length > 0 && (
            <Dropdown dropdownRender={() => toolsDropdownContent} trigger={['click']}>
              <Button className="flex items-center justify-between min-w-[180px] !h-[42px] !bg-transparent hover:!bg-transparent !border-[var(--ant-color-border)] hover:!border-[var(--ant-color-primary)]">
                <span className=" text-xs mr-2">{t('runHistory.filters.tools')}</span>
                <span className="flex-1 text-left truncate">{getToolsLabel()}</span>
                <ChevronDown size={14} className="ml-2 " />
              </Button>
            </Dropdown>
          )}

          {/* State filter */}
          <Dropdown menu={{ items: statusMenuItems }} trigger={['click']}>
            <Button className="flex items-center justify-between min-w-[150px] !h-[42px] !bg-transparent hover:!bg-transparent !border-[var(--ant-color-border)] hover:!border-[var(--ant-color-primary)]">
              <span className=" text-xs mr-2">{t('runHistory.filters.state')}</span>
              <span className="flex-1 text-left">{getStatusLabel()}</span>
              <ChevronDown size={14} className="ml-2 " />
            </Button>
          </Dropdown>
        </div>

        {/* Active filter tags */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mt-[18px]">
            {titleFilter && (
              <Tag
                closable
                onClose={() => handleRemoveFilter('title')}
                closeIcon={<X size={12} />}
                className="flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200"
              >
                {t('runHistory.filters.title')}: {titleFilter}
              </Tag>
            )}
            {canvasIdFilter && (
              <Tag
                closable
                onClose={() => handleRemoveFilter('canvasId')}
                closeIcon={<X size={12} />}
                className="flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200"
              >
                canvasId: {canvasIdFilter}
              </Tag>
            )}
            {typeFilter !== 'all' && (
              <Tag
                closable
                onClose={() => handleRemoveFilter('type')}
                closeIcon={<X size={12} />}
                className="flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200"
              >
                {t('runHistory.filters.type')}: {getTypeLabel()}
              </Tag>
            )}
            {selectedTools.map((toolId) => (
              <Tag
                key={toolId}
                closable
                onClose={() => handleRemoveFilter('tool', toolId)}
                closeIcon={<X size={12} />}
                className="flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200"
              >
                <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded overflow-hidden">
                  <ToolsetIcon toolsetKey={toolId} config={{ size: 14 }} />
                </div>
                {getToolName(toolId)}
              </Tag>
            ))}
            {statusFilter !== 'all' && (
              <Tag
                closable
                onClose={() => handleRemoveFilter('status')}
                closeIcon={<X size={12} />}
                className="flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200"
              >
                {t('runHistory.filters.state')}: {getStatusLabel()}
              </Tag>
            )}
          </div>
        )}
      </div>
    );
  },
);

RunHistoryFilters.displayName = 'RunHistoryFilters';
