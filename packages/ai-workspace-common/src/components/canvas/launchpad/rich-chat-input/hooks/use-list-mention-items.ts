import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MentionItem } from '../mentionList';
import type { ResourceType, ResourceMeta } from '@refly/openapi-schema';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useListUserTools } from '@refly-packages/ai-workspace-common/queries/queries';
import { useFetchDriveFiles } from '@refly-packages/ai-workspace-common/hooks/use-fetch-drive-files';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { useToolsetDefinition } from '@refly-packages/ai-workspace-common/hooks/use-toolset-definition';

export const useListMentionItems = (filterNodeId?: string): MentionItem[] => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.languages?.[0] || 'en';

  const { nodes } = useCanvasData();
  const { canvasId } = useCanvasContext();
  const { data: files } = useFetchDriveFiles();

  // Fetch user tools (authorized + unauthorized) using new unified API
  // Disable caching to always get fresh data
  const { data: userToolsData } = useListUserTools({}, [], {
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
  });
  const userTools = userToolsData?.data ?? [];

  // Use toolset definition hook for complete definition data
  const { lookupToolsetDefinitionByKey } = useToolsetDefinition();
  const { data: workflowVariables } = useVariablesManagement(canvasId);

  const allItems: MentionItem[] = useMemo(() => {
    const variableItems: MentionItem[] = workflowVariables.map((variable) => ({
      name: variable.name,
      description: variable.description || '',
      source: 'variables',
      variableType: variable.variableType || 'string',
      variableId: variable.variableId || '',
      variableValue: variable.value,
      // For resource type variables, set entityId to fileId for proper context handling
      entityId:
        variable.variableType === 'resource' ? variable.value?.[0]?.resource?.fileId : undefined,
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

    // Build toolset items from userTools API response with enhanced definition data
    const toolsetItems: MentionItem[] = userTools.map((userTool): MentionItem => {
      const isAuthorized = userTool.authorized ?? false;
      const toolsetKey = userTool.key;
      const inventoryDefinition = lookupToolsetDefinitionByKey(toolsetKey);

      if (isAuthorized && userTool.toolset) {
        // Authorized (installed) tool - use toolset inventory definition for better data
        const name = inventoryDefinition
          ? ((inventoryDefinition.labelDict?.[currentLanguage as 'en' | 'zh'] ||
              inventoryDefinition.labelDict?.en) as string)
          : (userTool.name ?? userTool.key ?? '');

        const description = inventoryDefinition
          ? ((inventoryDefinition.descriptionDict?.[currentLanguage as 'en' | 'zh'] ||
              inventoryDefinition.descriptionDict?.en) as string)
          : userTool.toolset?.toolset?.name ||
            userTool.toolset?.mcpServer?.name ||
            userTool.name ||
            '';

        return {
          name: name || userTool.key || '',
          description: description || name || userTool.key || '',
          source: 'toolsets' as const,
          toolset: userTool.toolset,
          toolsetId: userTool.toolset?.id || userTool.toolsetId,
          isInstalled: true,
        };
      } else {
        // Unauthorized (uninstalled) tool - prioritize inventory definition
        const name = inventoryDefinition
          ? ((inventoryDefinition.labelDict?.[currentLanguage as 'en' | 'zh'] ||
              inventoryDefinition.labelDict?.en) as string)
          : ((userTool.definition?.labelDict?.[currentLanguage as 'en' | 'zh'] ||
              userTool.definition?.labelDict?.en ||
              userTool.name) as string);

        const description = inventoryDefinition
          ? ((inventoryDefinition.descriptionDict?.[currentLanguage as 'en' | 'zh'] ||
              inventoryDefinition.descriptionDict?.en) as string)
          : ((userTool.definition?.descriptionDict?.[currentLanguage as 'en' | 'zh'] ||
              userTool.definition?.descriptionDict?.en ||
              userTool.description) as string);

        return {
          name: name || userTool.key || '',
          description: description || name || userTool.key || '',
          source: 'toolsets' as const,
          toolset: undefined,
          toolsetId: userTool.key,
          toolDefinition: inventoryDefinition || userTool.definition,
          isInstalled: false,
        };
      }
    });

    // Build tool items (individual tools within toolsets) with enhanced definition data
    const toolItems: MentionItem[] = userTools.flatMap((userTool) => {
      const isAuthorized = userTool.authorized ?? false;
      const toolsetKey = userTool.key;
      const inventoryDefinition = lookupToolsetDefinitionByKey(toolsetKey);

      // Prioritize inventory definition, fallback to user tool definition
      const definition =
        inventoryDefinition ||
        (isAuthorized ? userTool.toolset?.toolset?.definition : userTool.definition);
      const tools = definition?.tools ?? [];

      return tools.map(
        (tool): MentionItem => ({
          name: tool.name,
          description: ((tool.descriptionDict?.[currentLanguage as 'en' | 'zh'] as string) ||
            tool.name) as string,
          source: 'tools' as const,
          toolset: isAuthorized ? userTool.toolset : undefined,
          toolsetId: isAuthorized ? userTool.toolset?.id : userTool.key,
          toolDefinition: isAuthorized ? undefined : inventoryDefinition || userTool.definition,
          isInstalled: isAuthorized,
        }),
      );
    });

    // Combine all items
    return [...variableItems, ...agentItems, ...fileItems, ...toolsetItems, ...toolItems];
  }, [
    workflowVariables,
    nodes,
    files,
    userTools,
    lookupToolsetDefinitionByKey,
    t,
    currentLanguage,
    filterNodeId,
  ]);

  return allItems;
};
