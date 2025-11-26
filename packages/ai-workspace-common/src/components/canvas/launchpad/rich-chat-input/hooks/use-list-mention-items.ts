import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MentionItem } from '../mentionList';
import type { ResourceType, ResourceMeta } from '@refly/openapi-schema';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useListUserTools } from '@refly-packages/ai-workspace-common/queries/queries';
import { useFetchDriveFiles } from '@refly-packages/ai-workspace-common/hooks/use-fetch-drive-files';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';

export const useListMentionItems = (filterNodeId?: string): MentionItem[] => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.languages?.[0] || 'en';

  const { nodes } = useCanvasData();
  const { canvasId } = useCanvasContext();
  const { data: files } = useFetchDriveFiles();

  // Fetch user tools (authorized + unauthorized) using new unified API
  const { data: userToolsData } = useListUserTools({}, [], {
    refetchOnWindowFocus: false,
  });
  const userTools = userToolsData?.data ?? [];
  const { data: workflowVariables } = useVariablesManagement(canvasId);

  const allItems: MentionItem[] = useMemo(() => {
    const variableItems: MentionItem[] = workflowVariables.map((variable) => ({
      name: variable.name,
      description: variable.description || '',
      source: 'variables',
      variableType: variable.variableType || 'string',
      variableId: variable.variableId || '',
      variableValue: variable.value,
    }));

    // Get skillResponse nodes for step records
    const agentItems: MentionItem[] =
      nodes
        ?.filter(
          (node) => node.type === 'skillResponse' && (!filterNodeId || node.id !== filterNodeId),
        )
        ?.map((node) => ({
          name: node.data?.title || t('canvas.richChatInput.untitledAgent'),
          description: t('canvas.richChatInput.agents'),
          source: 'agents',
          entityId: node.data?.entityId || '',
          nodeId: node.id,
        })) ?? [];

    // Get my upload items from drive files data
    const fileItems: MentionItem[] =
      files?.map((file) => ({
        name: file.name ?? t('canvas.richChatInput.untitledFile'),
        description: t('canvas.richChatInput.files'),
        source: 'files',
        entityId: file.fileId,
        nodeId: file.fileId,
        metadata: {
          imageUrl: undefined, // DriveFile doesn't have direct imageUrl
          resourceType: 'file' as ResourceType,
          resourceMeta: {
            url: `/api/drive/file/download/${file.fileId}`,
            size: file.size,
            type: file.type,
            summary: file.summary,
          } as ResourceMeta | undefined,
          fileUrl: `/api/drive/file/download/${file.fileId}`,
        },
      })) ?? [];

    // Build toolset items from userTools API response
    const toolsetItems: MentionItem[] = userTools.map((userTool) => {
      const isAuthorized = userTool.authorized ?? false;

      if (isAuthorized && userTool.toolset) {
        // Authorized (installed) tool
        return {
          name: userTool.name ?? userTool.key ?? '',
          description:
            userTool.toolset?.toolset?.name ||
            userTool.toolset?.mcpServer?.name ||
            userTool.name ||
            '',
          source: 'toolsets' as const,
          toolset: userTool.toolset,
          toolsetId: userTool.toolset?.id || userTool.toolsetId,
          isInstalled: true,
        };
      } else {
        // Unauthorized (uninstalled) tool
        const name = (userTool.definition?.labelDict?.[currentLanguage as 'en' | 'zh'] ||
          userTool.definition?.labelDict?.en ||
          userTool.name) as string;
        const description = (userTool.definition?.descriptionDict?.[
          currentLanguage as 'en' | 'zh'
        ] ||
          userTool.definition?.descriptionDict?.en ||
          userTool.description) as string;

        return {
          name: name || userTool.key || '',
          description: description || name || userTool.key || '',
          source: 'toolsets' as const,
          toolset: undefined,
          toolsetId: userTool.key,
          toolDefinition: userTool.definition,
          isInstalled: false,
        };
      }
    });

    // Build tool items (individual tools within toolsets)
    const toolItems: MentionItem[] = userTools.flatMap((userTool) => {
      const isAuthorized = userTool.authorized ?? false;
      const definition = isAuthorized ? userTool.toolset?.toolset?.definition : userTool.definition;
      const tools = definition?.tools ?? [];

      return tools.map((tool) => ({
        name: tool.name,
        description:
          (tool.descriptionDict?.[currentLanguage as 'en' | 'zh'] as string) || tool.name,
        source: 'tools' as const,
        toolset: isAuthorized ? userTool.toolset : undefined,
        toolsetId: isAuthorized ? userTool.toolset?.id : userTool.key,
        toolDefinition: isAuthorized ? undefined : userTool.definition,
        isInstalled: isAuthorized,
      }));
    });

    // Combine all items
    return [...variableItems, ...agentItems, ...fileItems, ...toolsetItems, ...toolItems];
  }, [workflowVariables, nodes, files, userTools, t, currentLanguage, filterNodeId]);

  return allItems;
};
