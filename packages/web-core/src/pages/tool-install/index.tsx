import { memo, useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Typography, Avatar, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { Account } from 'refly-icons';

import { useUserStoreShallow } from '@refly/stores';
import {
  useGetCanvasData,
  useListUserTools,
} from '@refly-packages/ai-workspace-common/queries/queries';
import { useOpenInstallTool } from '@refly-packages/ai-workspace-common/hooks/use-open-install-tool';
import { useOpenInstallMcp } from '@refly-packages/ai-workspace-common/hooks/use-open-install-mcp';
import { useOAuthPopup } from '@refly-packages/ai-workspace-common/hooks/use-oauth-popup';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { extractToolsetsWithNodes } from '@refly/canvas-common';
import defaultAvatar from '@refly-packages/ai-workspace-common/assets/refly_default_avatar_v2.webp';
import './index.scss';

import type {
  GenericToolset,
  McpServerDTO,
  ToolsetDefinition,
  UserTool,
} from '@refly/openapi-schema';

const { Text } = Typography;

/**
 * Check if a toolset is authorized/installed
 * - MCP servers: check if exists in userTools by name
 * - Builtin tools: always available, no installation needed
 * - Regular tools: check if exists in userTools by key and authorized status
 */
const isToolsetAuthorized = (toolset: GenericToolset, userTools: UserTool[]): boolean => {
  if (toolset.type === 'mcp') {
    return userTools.some((tool) => tool.toolset?.name === toolset.name);
  }

  if (toolset.builtin) {
    return true;
  }

  const matchingUserTool = userTools.find((tool) => tool.key === toolset.toolset?.key);

  if (!matchingUserTool) {
    return false;
  }

  return matchingUserTool.authorized ?? false;
};

interface ToolWithNodes {
  toolset: GenericToolset;
  referencedNodes: Array<{
    id: string;
    entityId: string;
    title: string;
    type: string;
  }>;
}

const ReferencedNodesList = memo(
  (props: { nodes: ToolWithNodes['referencedNodes']; label: string }) => {
    const nodes = props?.nodes;
    const label = props?.label ?? '';
    const safeNodes = Array.isArray(nodes) ? nodes : [];

    if (safeNodes.length === 0) {
      return null;
    }

    return (
      <div className="mt-2 text-xs text-refly-text-2">
        <div className="font-medium text-refly-text-1">{label}</div>
        <div className="mt-1 flex flex-wrap gap-2">
          {safeNodes.map((node) => {
            const title = node?.title ?? 'Untitled';
            return (
              <span
                key={node.id}
                className="inline-flex items-center rounded-md bg-refly-bg-control-z0 px-2 py-0.5"
              >
                {title}
              </span>
            );
          })}
        </div>
      </div>
    );
  },
);

ReferencedNodesList.displayName = 'ReferencedNodesList';

const ToolInstallCard = memo(
  (props: {
    toolWithNodes: ToolWithNodes;
    description: string;
    isInstalling: boolean;
    onInstall: (toolset: GenericToolset) => void;
    label: string;
    isAuthorized: boolean;
  }) => {
    const { t } = useTranslation();
    const toolWithNodes = props?.toolWithNodes;
    const description = props?.description ?? '';
    const isInstalling = props?.isInstalling ?? false;
    const onInstall = props?.onInstall ?? (() => undefined);
    const label = props?.label ?? '';
    const isAuthorized = props?.isAuthorized ?? false;
    const toolset = toolWithNodes?.toolset;

    const handleInstallClick = useCallback(() => {
      if (!toolset) {
        return;
      }
      onInstall(toolset);
    }, [onInstall, toolset]);

    return (
      <div className="bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <ToolsetIcon toolset={toolset} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-refly-text-0">{label}</div>
            {description ? (
              <div className="mt-1 text-xs text-refly-text-2 truncate">{description}</div>
            ) : null}
          </div>
          {isAuthorized ? (
            <Button
              size="middle"
              className="custom-configure-button flex-shrink-0"
              disabled={true}
              onClick={handleInstallClick}
            >
              {t('toolInstall.connected')}
            </Button>
          ) : (
            <Button
              size="middle"
              className="custom-configure-button flex-shrink-0"
              loading={isInstalling}
              disabled={isInstalling}
              onClick={handleInstallClick}
            >
              {t('toolInstall.connect')}
            </Button>
          )}
        </div>
      </div>
    );
  },
);

ToolInstallCard.displayName = 'ToolInstallCard';

const ToolInstallPage = memo(() => {
  const { t, i18n } = useTranslation();
  const params = useParams();
  const workflowId = params?.workflowId ?? '';
  const userStore = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    userProfile: state.userProfile,
  }));
  const isLogin = userStore?.isLogin ?? false;
  const userProfile = userStore?.userProfile;

  const { data: canvasResponse, isLoading: canvasLoading } = useGetCanvasData(
    { query: { canvasId: workflowId } },
    [],
    {
      enabled: Boolean(workflowId) && isLogin,
      refetchOnWindowFocus: false,
    },
  );

  const {
    data: userToolsData,
    isLoading: toolsLoading,
    refetch: refetchUserTools,
  } = useListUserTools({}, [], {
    enabled: isLogin,
    refetchOnWindowFocus: false,
  });

  const userTools = Array.isArray(userToolsData?.data) ? (userToolsData?.data ?? []) : [];
  const nodes = Array.isArray(canvasResponse?.data?.nodes)
    ? (canvasResponse?.data?.nodes ?? [])
    : [];

  const toolsetDefinitions = useMemo(() => {
    if (!Array.isArray(userTools)) {
      return [];
    }
    return userTools
      .map((tool) => tool.definition ?? tool.toolset?.toolset?.definition)
      .filter(Boolean) as ToolsetDefinition[];
  }, [userTools]);

  const toolsetsWithNodes = useMemo(() => {
    return extractToolsetsWithNodes(nodes);
  }, [nodes]);

  const workflowTools = useMemo(() => {
    const safeToolsets = Array.isArray(toolsetsWithNodes) ? toolsetsWithNodes : [];
    // Only show external_oauth tools
    return safeToolsets.filter(
      (toolWithNodes) => toolWithNodes?.toolset?.type === 'external_oauth',
    );
  }, [toolsetsWithNodes]);

  const installedToolsCount = useMemo(() => {
    return workflowTools.filter((toolWithNodes) => {
      return isToolsetAuthorized(toolWithNodes.toolset, userTools);
    }).length;
  }, [workflowTools, userTools]);

  const totalToolsCount = workflowTools.length;

  const { openInstallToolByKey } = useOpenInstallTool();
  const { openInstallMcp } = useOpenInstallMcp();
  const { openOAuthPopup } = useOAuthPopup({
    onSuccess: () => {
      refetchUserTools();
    },
  });

  // Track loading state for each tool individually
  const [toolLoadingStates, setToolLoadingStates] = useState<Map<string, boolean>>(new Map());

  const currentLanguage = i18n?.language ?? 'en';
  const referencedNodesLabel = t('toolInstall.referencedNodes');

  const getToolsetDefinition = useCallback(
    (toolset: GenericToolset) => {
      if (toolset?.toolset?.definition) {
        return toolset.toolset.definition;
      }

      if (toolset?.toolset?.key && Array.isArray(toolsetDefinitions)) {
        const definition = toolsetDefinitions.find((item) => item?.key === toolset.toolset?.key);
        return definition ?? null;
      }

      return null;
    },
    [toolsetDefinitions],
  );

  const handleInstallTool = useCallback(
    async (toolset: GenericToolset) => {
      const toolKey =
        toolset.type === 'mcp' ? (toolset.mcpServer?.url ?? toolset.name) : toolset.toolset?.key;

      if (!toolKey) {
        return;
      }

      // Set loading state for this specific tool
      setToolLoadingStates((prev) => new Map(prev.set(toolKey, true)));

      try {
        if (toolset.type === 'mcp') {
          openInstallMcp(toolset.mcpServer as McpServerDTO);
          return;
        }

        const isAuthorized = isToolsetAuthorized(toolset, userTools);
        const toolsetKey = toolset.toolset?.key;

        if (!toolsetKey) {
          return;
        }

        if (!isAuthorized) {
          await openOAuthPopup(toolsetKey);
          return;
        }

        openInstallToolByKey(toolsetKey);
      } finally {
        // Clear loading state for this specific tool
        setToolLoadingStates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(toolKey);
          return newMap;
        });
      }
    },
    [openInstallMcp, openInstallToolByKey, openOAuthPopup, userTools],
  );

  const isLoading = canvasLoading || toolsLoading;
  const hasWorkflowTools = workflowTools.length > 0;

  const toolCards = useMemo(() => {
    if (!Array.isArray(workflowTools)) {
      return [];
    }

    return workflowTools.map((toolWithNodes) => {
      const toolset = toolWithNodes?.toolset;
      const isAuthorized = isToolsetAuthorized(toolset, userTools);
      const toolsetDefinition = toolset ? getToolsetDefinition(toolset) : null;
      const label =
        (toolsetDefinition?.labelDict?.[currentLanguage] as string) ??
        toolset?.name ??
        t('common.untitled');
      const description =
        toolset?.type === 'mcp'
          ? (toolset?.mcpServer?.url ?? toolset?.name ?? '')
          : (toolsetDefinition?.descriptionDict?.[currentLanguage] ?? '');

      // Get loading state for this specific tool
      const toolKey =
        toolset?.type === 'mcp'
          ? (toolset?.mcpServer?.url ?? toolset?.name)
          : toolset?.toolset?.key;
      const isInstalling = toolKey ? (toolLoadingStates.get(toolKey) ?? false) : false;

      return (
        <ToolInstallCard
          key={toolset?.id ?? label}
          toolWithNodes={toolWithNodes}
          description={description as unknown as string}
          isInstalling={isInstalling}
          onInstall={handleInstallTool}
          label={label}
          isAuthorized={isAuthorized}
        />
      );
    });
  }, [
    workflowTools,
    getToolsetDefinition,
    currentLanguage,
    t,
    toolLoadingStates,
    handleInstallTool,
    referencedNodesLabel,
  ]);

  if (!workflowId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-refly-bg-body-z0">
        <Text type="danger">{t('toolInstall.invalidWorkflow')}</Text>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 bg-refly-bg-body-z0 overflow-hidden">
      <div className="w-[504px] h-[697px] bg-refly-bg-body-z0 rounded-[20px] p-6 flex flex-col shadow-lg">
        <div className="p-1 px-2 rounded-lg">
          <div className="flex items-start gap-2">
            <Avatar icon={<Account />} src={userProfile?.avatar || defaultAvatar} size={46} />

            <div className="flex flex-col justify-between h-[44px] gap-[2px] opacity-100">
              <div className="max-w-40 text-base font-semibold text-refly-text-0 leading-5 truncate">
                {userProfile?.nickname || 'No nickname'}
              </div>
              <div className="max-w-40 text-xs text-refly-text-2 leading-4 truncate">
                {userProfile?.email ?? 'No email provided'}
              </div>
            </div>
          </div>
        </div>
        <Divider className="my-4 -mx-6 !w-[calc(100%+48px)]" />
        {/* Header */}
        <div className="flex flex-col items-center mb-6 gap-1">
          <Logo className="w-[120px] h-[32px] mb-2" />
          <h1 className="text-2xl font-semibold text-[#1c1f23] m-0 text-center leading-8">
            {t('toolInstall.workflowToolsTitle')}
          </h1>
          <p className="text-sm text-refly-text-2 m-0 text-center leading-5">
            {installedToolsCount === 0
              ? t('toolInstall.allToolsNeedInstall', { count: totalToolsCount })
              : installedToolsCount === totalToolsCount
                ? t('toolInstall.allToolsInstalled')
                : t('toolInstall.partialToolsInstalled', {
                    installed: installedToolsCount,
                    total: totalToolsCount,
                  })}
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-refly-Card-Border bg-white p-6 shadow-sm">
            <Text className="text-refly-text-2">{t('common.loading')}</Text>
          </div>
        ) : null}

        {!isLoading && hasWorkflowTools ? (
          <div className="min-h-0 rounded-2xl border border-solid border-refly-primary-default shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-y-auto flex flex-col">{toolCards}</div>
          </div>
        ) : null}

        {!isLoading && !hasWorkflowTools ? (
          <div className="rounded-2xl border border-refly-Card-Border bg-white p-6 shadow-sm">
            <Text className="text-refly-text-2">{t('toolInstall.noTools')}</Text>
          </div>
        ) : null}
      </div>
    </div>
  );
});

ToolInstallPage.displayName = 'ToolInstallPage';

export default ToolInstallPage;
