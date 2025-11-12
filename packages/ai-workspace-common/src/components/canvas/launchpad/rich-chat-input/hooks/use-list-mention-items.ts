import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MentionItem } from '../mentionList';
import type { ResourceType, ResourceMeta } from '@refly/openapi-schema';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useListTools } from '@refly-packages/ai-workspace-common/queries/queries';
import { useFetchDriveFiles } from '@refly-packages/ai-workspace-common/hooks/use-fetch-resources';

export const useListMentionItems = (filterNodeId?: string): MentionItem[] => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.languages?.[0] || 'en';

  const { nodes } = useCanvasData();
  const { workflow } = useCanvasContext();
  const { data: resources } = useFetchDriveFiles();

  // Fetch tools
  const { data: toolsData } = useListTools({ query: { enabled: true } }, [], {
    refetchOnWindowFocus: false,
  });
  const toolsets = toolsData?.data ?? [];
  const { workflowVariables = [] } = workflow || {};

  const allItems: MentionItem[] = useMemo(() => {
    const variableItems = workflowVariables.map((variable) => ({
      name: variable.name,
      description: variable.description || '',
      source: 'variables' as const,
      variableType: variable.variableType || 'string',
      variableId: variable.variableId || '',
      variableValue: variable.value,
    }));

    // Get skillResponse nodes for step records
    const stepRecordItems: MentionItem[] =
      nodes
        ?.filter(
          (node) => node.type === 'skillResponse' && (!filterNodeId || node.id !== filterNodeId),
        )
        ?.map((node) => ({
          name: node.data?.title ?? t('canvas.richChatInput.untitledStep'),
          description: t('canvas.richChatInput.stepRecord'),
          source: 'stepRecord' as const,
          entityId: node.data?.entityId || '',
          nodeId: node.id,
        })) ?? [];

    // Get result record nodes - same logic as ResultList component
    const resultRecordItems: MentionItem[] =
      nodes
        ?.filter(
          (node) =>
            ['document', 'codeArtifact', 'website', 'video', 'audio'].includes(node.type) ||
            (node.type === 'image' && !!node.data?.metadata?.resultId),
        )
        ?.map((node) => ({
          name: node.data?.title ?? t('canvas.richChatInput.untitledResult'),
          description: t('canvas.richChatInput.resultRecord'),
          source: 'resultRecord' as const,
          entityId: node.data?.entityId,
          nodeId: node.id,
          metadata: {
            imageUrl: node.data?.metadata?.imageUrl,
            resourceType: node.data?.metadata?.resourceType as ResourceType | undefined,
            resourceMeta: node.data?.metadata?.resourceMeta as ResourceMeta | undefined,
          },
        })) ?? [];

    // Get my upload items from API resources data
    const myUploadItems: MentionItem[] =
      resources?.map((resource) => ({
        name: resource.title ?? t('canvas.richChatInput.untitledUpload'),
        description: t('canvas.richChatInput.myUpload'),
        source: 'myUpload' as const,
        variableType: resource.resourceType || 'resource',
        entityId: resource.resourceId,
        nodeId: resource.resourceId,
        metadata: {
          imageUrl: resource.data?.url as string | undefined,
          resourceType: resource.resourceType as ResourceType | undefined,
          resourceMeta: resource.data as ResourceMeta | undefined,
          storageKey: resource.storageKey,
          rawFileKey: resource.rawFileKey,
          [`${resource.resourceType}Url`]: resource.downloadURL,
        },
      })) ?? [];

    // Get toolset items from toolsets
    const toolsetItems: MentionItem[] = toolsets.map((toolset) => ({
      name: toolset.name,
      description: toolset.toolset?.name || toolset.mcpServer?.name || toolset.name,
      source: 'toolsets' as const,
      toolset,
      toolsetId: toolset.id,
    }));

    // Get tool items from toolsets
    const toolItems: MentionItem[] = toolsets.flatMap(
      (toolset) =>
        toolset.toolset?.definition?.tools?.map((tool) => ({
          name: tool.name,
          description: (tool.descriptionDict?.[currentLanguage] as string) || toolset.name,
          source: 'tools' as const,
          toolset,
          toolsetId: toolset.id,
        })) ?? [],
    );

    return [
      ...variableItems,
      ...stepRecordItems,
      ...resultRecordItems,
      ...myUploadItems,
      ...toolsetItems,
      ...toolItems,
    ];
  }, [workflowVariables, nodes, resources, toolsets, t, currentLanguage, filterNodeId]);

  return allItems;
};
