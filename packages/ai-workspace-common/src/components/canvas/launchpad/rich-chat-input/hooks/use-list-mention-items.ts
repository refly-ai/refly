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
  const { data: files } = useFetchDriveFiles();

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
    const agentItems: MentionItem[] =
      nodes
        ?.filter(
          (node) => node.type === 'skillResponse' && (!filterNodeId || node.id !== filterNodeId),
        )
        ?.map((node) => ({
          name: node.data?.title || t('canvas.richChatInput.untitledAgent'),
          description: t('canvas.richChatInput.agents'),
          source: 'stepRecord' as const,
          entityId: node.data?.entityId || '',
          nodeId: node.id,
        })) ?? [];

    // Get my upload items from drive files data
    const myUploadItems: MentionItem[] =
      files?.map((file) => ({
        name: file.name ?? t('canvas.richChatInput.untitledUpload'),
        description: t('canvas.richChatInput.myUpload'),
        source: 'myUpload' as const,
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

    return [...variableItems, ...agentItems, ...myUploadItems, ...toolsetItems, ...toolItems];
  }, [workflowVariables, nodes, files, toolsets, t, currentLanguage, filterNodeId]);

  return allItems;
};
