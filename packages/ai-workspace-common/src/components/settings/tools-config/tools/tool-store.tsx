import { useTranslation } from 'react-i18next';
import {
  useListToolsetInventory,
  useListToolsets,
} from '@refly-packages/ai-workspace-common/queries';
import { Col, Empty, Row, Button, Typography, Skeleton, Input, message } from 'antd';
import { ToolsetDefinition } from '@refly-packages/ai-workspace-common/requests';
import { Search } from 'refly-icons';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { ToolInstallModal } from './tool-install-modal';
import { Favicon } from '@refly-packages/ai-workspace-common/components/common/favicon';
import { useToolStoreShallow } from '@refly/stores';

const ToolItemSkeleton = () => {
  return (
    <div className="p-4 bg-refly-bg-content-z2 border-solid border-[1px] border-refly-Card-Border rounded-lg">
      {/* Header section with icon and title */}
      <div className="mb-2">
        <div className="flex items-center mb-0.5">
          <div className="w-11 h-11 rounded-lg bg-refly-bg-control-z0 flex items-center justify-center mr-2 flex-shrink-0">
            <Skeleton.Avatar size={24} />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <Skeleton.Input size="small" className="w-24" active />
          </div>
        </div>
      </div>

      {/* Description section */}
      <div className="mb-5">
        <Skeleton title={false} active paragraph={{ rows: 2 }} />
      </div>

      <Skeleton.Button className="!w-[100%]" />
    </div>
  );
};

const ToolItem = ({ tool }: { tool: ToolsetDefinition }) => {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.language as 'en' | 'zh';
  const { setCurrentToolDefinition, setToolInstallModalOpen } = useToolStoreShallow((state) => ({
    setCurrentToolDefinition: state.setCurrentToolDefinition,
    setToolInstallModalOpen: state.setToolInstallModalOpen,
  }));

  const name = (tool.labelDict[currentLanguage] as string) ?? (tool.labelDict.en as string);
  const description =
    (tool.descriptionDict?.[currentLanguage] as string) ??
    (tool.descriptionDict?.en as string) ??
    '';

  const handleInstall = () => {
    setCurrentToolDefinition(tool);
    setToolInstallModalOpen(true);
  };

  return (
    <div className="p-4 bg-refly-bg-content-z2 border-solid border-[1px] border-refly-Card-Border rounded-lg hover:shadow-refly-m transition-all duration-200">
      {/* Header section with icon and title */}
      <div className="mb-2">
        <div className="flex items-center mb-0.5">
          <div className="w-11 h-11 rounded-lg bg-refly-bg-control-z0 flex items-center justify-center mr-2 flex-shrink-0 overflow-hidden">
            <Favicon url={tool.domain} size={24} />
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="text-refly-text-0 text-base leading-[26px] line-clamp-1 font-semibold">
              {name}
            </div>
          </div>
        </div>
      </div>

      {/* Description section */}
      <div className="mb-5">
        <div className="text-refly-text-1 text-sm leading-relaxed min-h-[4.5rem] flex items-start">
          <Typography.Paragraph
            className="text-refly-text-1 text-sm !mb-0"
            ellipsis={{ rows: 3, tooltip: true }}
          >
            {description}
          </Typography.Paragraph>
        </div>
      </div>

      {/* Action section */}
      <div className="flex items-center justify-between gap-3">
        <Button
          onClick={handleInstall}
          size="middle"
          type="text"
          className="h-8 flex-1 cursor-pointer font-semibold border-solid border-[1px] border-refly-Card-Border rounded-lg bg-refly-tertiary-default hover:!bg-refly-tertiary-hover"
        >
          {t('settings.toolStore.install.install')}
        </Button>
      </div>
    </div>
  );
};

export const ToolStore = () => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const {
    toolStoreModalOpen,
    toolInstallModalOpen,
    currentToolDefinition,
    setToolStoreModalOpen,
    setToolInstallModalOpen,
    setCurrentToolDefinition,
  } = useToolStoreShallow((state) => ({
    toolStoreModalOpen: state.toolStoreModalOpen,
    toolInstallModalOpen: state.toolInstallModalOpen,
    currentToolDefinition: state.currentToolDefinition,
    setToolStoreModalOpen: state.setToolStoreModalOpen,
    setToolInstallModalOpen: state.setToolInstallModalOpen,
    setCurrentToolDefinition: state.setCurrentToolDefinition,
  }));

  const { data, isLoading } = useListToolsetInventory({}, [], {
    enabled: toolStoreModalOpen,
  });

  // Get list of installed toolsets to filter out from store
  const { data: installedToolsets } = useListToolsets({}, [], {
    enabled: toolStoreModalOpen,
  });

  const tools = useMemo(() => {
    const allTools = (data?.data || []).filter((tool) => !tool.builtin && tool.key !== 'builtin');

    // Get set of keys for all installed toolsets (both global and user-installed)
    const installedToolKeys = new Set(
      (installedToolsets?.data || []).map((toolset) => toolset.key),
    );

    // Filter out tools that are already installed (globally or by user)
    return allTools.filter((tool) => !installedToolKeys.has(tool.key));
  }, [data?.data, installedToolsets?.data]);

  // Debounce search text to improve performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchText]);

  const filteredTools = useMemo(() => {
    if (!debouncedSearchText.trim()) {
      return tools;
    }

    const searchLower = debouncedSearchText.toLowerCase();
    return tools.filter((tool) => {
      // Search in tool name (label)
      const nameEn = typeof tool.labelDict?.en === 'string' ? tool.labelDict.en.toLowerCase() : '';
      const nameZh = typeof tool.labelDict?.zh === 'string' ? tool.labelDict.zh.toLowerCase() : '';

      // Search in tool description
      const descEn =
        typeof tool.descriptionDict?.en === 'string' ? tool.descriptionDict.en.toLowerCase() : '';
      const descZh =
        typeof tool.descriptionDict?.zh === 'string' ? tool.descriptionDict.zh.toLowerCase() : '';

      // Check if search text matches any of these fields
      return (
        nameEn.includes(searchLower) ||
        nameZh.includes(searchLower) ||
        descEn.includes(searchLower) ||
        descZh.includes(searchLower)
      );
    });
  }, [tools, debouncedSearchText]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchText('');
  }, []);

  const handleInstallSuccess = useCallback(() => {
    const closeMessage = message.success(
      <div className="flex items-center gap-2">
        <span>
          {t('settings.toolStore.install.installSuccess') || 'Tool installed successfully'}
        </span>
        <Button
          type="link"
          size="small"
          className="p-0 h-auto !text-refly-primary-default hover:!text-refly-primary-default"
          onClick={() => {
            closeMessage();
            setCurrentToolDefinition(null);
            setToolStoreModalOpen(false);
          }}
        >
          {t('common.view') || 'View'}
        </Button>
      </div>,
      5,
    );
  }, [t, setToolStoreModalOpen, setCurrentToolDefinition]);

  return (
    <div className="h-full flex flex-col px-5 py-3 overflow-hidden">
      <Input
        placeholder={t('settings.toolStore.searchPlaceholder')}
        prefix={<Search size={16} color="var(--refly-text-3)" />}
        value={searchText}
        onChange={handleSearchChange}
        onClear={handleClearSearch}
        allowClear
        className="mb-4"
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <Row gutter={[16, 12]}>
            {Array.from({ length: 8 }).map((_, index) => (
              <Col key={index} xs={24} sm={12} md={6} lg={6} xl={6}>
                <ToolItemSkeleton />
              </Col>
            ))}
          </Row>
        ) : filteredTools.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              searchText.trim()
                ? t('settings.toolStore.noSearchResults') || 'No tools found matching your search'
                : t('settings.toolStore.noTools')
            }
          />
        ) : (
          <Row gutter={[16, 12]}>
            {filteredTools.map((tool, index) => (
              <Col key={index} xs={24} sm={12} md={6} lg={6} xl={6}>
                <ToolItem tool={tool} />
              </Col>
            ))}
          </Row>
        )}
      </div>
      <ToolInstallModal
        mode="install"
        toolDefinition={currentToolDefinition}
        visible={toolInstallModalOpen}
        onCancel={() => setToolInstallModalOpen(false)}
        onSuccess={handleInstallSuccess}
      />
    </div>
  );
};
