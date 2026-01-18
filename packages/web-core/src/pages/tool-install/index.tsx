import { memo, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'refly-icons';

import { useUserStoreShallow } from '@refly/stores';
import {
  useGetCanvasData,
  useListUserTools,
} from '@refly-packages/ai-workspace-common/queries/queries';
import { useOpenInstallTool } from '@refly-packages/ai-workspace-common/hooks/use-open-install-tool';
import { useOpenInstallMcp } from '@refly-packages/ai-workspace-common/hooks/use-open-install-mcp';
import { useOAuthPopup } from '@refly-packages/ai-workspace-common/hooks/use-oauth-popup';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { extractToolsetsWithNodes } from '@refly/canvas-common';

import type {
  GenericToolset,
  McpServerDTO,
  ToolsetDefinition,
  UserTool,
} from '@refly/openapi-schema';

const { Title, Text } = Typography;

const TOOLSET_ICON_CONFIG = {
  builtinClassName: '!w-5 !h-5',
};

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
    referencedNodesLabel: string;
  }) => {
    const toolWithNodes = props?.toolWithNodes;
    const description = props?.description ?? '';
    const isInstalling = props?.isInstalling ?? false;
    const onInstall = props?.onInstall ?? (() => undefined);
    const label = props?.label ?? '';
    const referencedNodesLabel = props?.referencedNodesLabel ?? '';
    const toolset = toolWithNodes?.toolset;

    const handleInstallClick = useCallback(() => {
      if (!toolset) {
        return;
      }
      onInstall(toolset);
    }, [onInstall, toolset]);

    return (
      <div className="rounded-xl border border-refly-Card-Border bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <ToolsetIcon toolset={toolset} config={TOOLSET_ICON_CONFIG} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-refly-text-0">{label}</div>
            {description ? (
              <div className="mt-1 text-xs text-refly-text-2">{description}</div>
            ) : null}
            <ReferencedNodesList
              nodes={toolWithNodes.referencedNodes}
              label={referencedNodesLabel}
            />
          </div>
          <Button
            size="middle"
            className="custom-configure-button flex-shrink-0"
            loading={isInstalling}
            disabled={isInstalling}
            onClick={handleInstallClick}
          >
            Install
          </Button>
        </div>
      </div>
    );
  },
);

ToolInstallCard.displayName = 'ToolInstallCard';

const ToolInstallPage = memo(() => {
  const translation = useTranslation();
  const t = translation?.t ?? ((key: string) => key);
  const i18n = translation?.i18n;
  const params = useParams();
  const workflowId = params?.workflowId ?? '';
  const [searchParams] = useSearchParams();
  const userStore = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const isLogin = userStore?.isLogin ?? false;

  const toolKeysParam = searchParams?.get('tools') ?? '';
  const toolKeys = useMemo(() => {
    if (!toolKeysParam) {
      return [];
    }
    const splitKeys = toolKeysParam.split(',').map((key) => key.trim());
    return splitKeys.filter((key) => Boolean(key));
  }, [toolKeysParam]);

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

  const unauthorizedTools = useMemo(() => {
    const safeToolsets = Array.isArray(toolsetsWithNodes) ? toolsetsWithNodes : [];
    const filtered = safeToolsets.filter((toolWithNodes) => {
      return !isToolsetAuthorized(toolWithNodes.toolset, userTools);
    });

    if (toolKeys.length === 0) {
      return filtered;
    }

    return filtered.filter((toolWithNodes) => {
      const toolKey = toolWithNodes?.toolset?.toolset?.key ?? '';
      const toolName = toolWithNodes?.toolset?.name ?? '';
      return toolKeys.includes(toolKey) || toolKeys.includes(toolName);
    });
  }, [toolsetsWithNodes, userTools, toolKeys]);

  const { openInstallToolByKey } = useOpenInstallTool();
  const { openInstallMcp } = useOpenInstallMcp();
  const { openOAuthPopup, isPolling, isOpening } = useOAuthPopup({
    onSuccess: () => {
      refetchUserTools();
    },
  });

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
        if (isPolling || isOpening) {
          return;
        }
        await openOAuthPopup(toolsetKey);
        return;
      }

      openInstallToolByKey(toolsetKey);
    },
    [openInstallMcp, openInstallToolByKey, openOAuthPopup, isOpening, isPolling, userTools],
  );

  const handleBack = useCallback(() => {
    window.history.back();
  }, []);

  const isLoading = canvasLoading || toolsLoading;
  const hasUnauthorizedTools = unauthorizedTools.length > 0;

  const toolCards = useMemo(() => {
    if (!Array.isArray(unauthorizedTools)) {
      return [];
    }

    return unauthorizedTools.map((toolWithNodes) => {
      const toolset = toolWithNodes?.toolset;
      const toolsetDefinition = toolset ? getToolsetDefinition(toolset) : null;
      const label =
        (toolsetDefinition?.labelDict?.[currentLanguage] as string) ??
        toolset?.name ??
        t('common.untitled');
      const description =
        toolset?.type === 'mcp'
          ? (toolset?.mcpServer?.url ?? toolset?.name ?? '')
          : (toolsetDefinition?.descriptionDict?.[currentLanguage] ?? '');

      return (
        <ToolInstallCard
          key={toolset?.id ?? label}
          toolWithNodes={toolWithNodes}
          description={description as unknown as string}
          isInstalling={isPolling || isOpening}
          onInstall={handleInstallTool}
          label={label}
          referencedNodesLabel={referencedNodesLabel}
        />
      );
    });
  }, [
    unauthorizedTools,
    getToolsetDefinition,
    currentLanguage,
    t,
    isPolling,
    isOpening,
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
    <div className="min-h-screen bg-refly-bg-body-z0 p-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <Button type="text" icon={<ArrowLeft size={16} />} onClick={handleBack}>
            {t('common.goBack')}
          </Button>
        </div>

        <div className="rounded-2xl border border-refly-Card-Border bg-white p-6 shadow-sm">
          <Title level={3} className="!mb-2">
            {t('toolInstall.title')}
          </Title>
          <Text className="text-refly-text-2">{t('toolInstall.description')}</Text>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-refly-Card-Border bg-white p-6 shadow-sm">
            <Text className="text-refly-text-2">{t('common.loading')}</Text>
          </div>
        ) : null}

        {!isLoading && hasUnauthorizedTools ? (
          <div className="flex flex-col gap-3">{toolCards}</div>
        ) : null}

        {!isLoading && !hasUnauthorizedTools ? (
          <div className="rounded-2xl border border-refly-Card-Border bg-white p-6 shadow-sm">
            <Text className="text-refly-text-2">{t('toolInstall.noUnauthorizedTools')}</Text>
          </div>
        ) : null}
      </div>
    </div>
  );
});

ToolInstallPage.displayName = 'ToolInstallPage';

export default ToolInstallPage;
