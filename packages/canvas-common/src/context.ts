import {
  ActionResult,
  CanvasNodeType,
  SkillContext,
  SkillContextFileItem,
  WorkflowVariable,
} from '@refly/openapi-schema';
import { IContextItem } from '@refly/common-types';
import { Node, Edge } from '@xyflow/react';
import { omit, safeParseJSON } from '@refly/utils';
import { CanvasNodeFilter } from './types';

export const convertResultContextToItems = (
  context: SkillContext,
  history: ActionResult[],
): IContextItem[] => {
  if (!context) return [];

  const items: IContextItem[] = [];

  // Convert history
  for (const item of history ?? []) {
    items.push({
      type: 'skillResponse',
      entityId: item.resultId,
    });
  }

  // Convert contentList
  for (const content of context?.contentList ?? []) {
    const metadata = content.metadata as any;

    items.push({
      type: metadata?.domain?.includes('resource')
        ? 'resource'
        : metadata?.domain?.includes('document')
          ? 'document'
          : metadata?.domain === 'memo'
            ? 'memo'
            : 'skillResponse',
      entityId: metadata?.entityId ?? '',
      title: metadata?.title ?? 'Selected Content',
      metadata: {
        contentPreview: content.content,
        selectedContent: content.content,
        sourceEntityId: metadata?.entityId ?? '',
        sourceEntityType: metadata?.domain?.split('Selection')[0] ?? '',
        sourceType: metadata?.domain ?? '',
        ...(metadata?.url && { url: metadata.url }),
      },
    });
  }

  // Convert resources
  for (const resource of context?.resources ?? []) {
    items.push({
      type: 'resource',
      entityId: resource.resourceId ?? '',
      title: resource.resource?.title ?? 'Resource',
      metadata: resource.metadata ?? {},
      isPreview: !!resource.isCurrent,
      isCurrentContext: resource.isCurrent,
    });
  }

  // Convert documents
  for (const doc of context?.documents ?? []) {
    items.push({
      type: 'document',
      entityId: doc.docId ?? '',
      title: doc.document?.title ?? 'Document',
      metadata: doc.metadata ?? {},
      isPreview: !!doc.isCurrent,
      isCurrentContext: doc.isCurrent,
    });
  }

  // Convert code artifacts
  for (const artifact of context?.codeArtifacts ?? []) {
    items.push({
      type: 'codeArtifact',
      entityId: artifact.artifactId ?? '',
      title: artifact.codeArtifact?.title ?? 'Code Artifact',
      metadata: {
        ...artifact.metadata,
        artifactType: artifact.codeArtifact?.type ?? 'unknown',
      },
      isPreview: !!artifact.isCurrent,
      isCurrentContext: artifact.isCurrent,
    });
  }

  // Convert URLs/websites
  for (const url of context?.urls ?? []) {
    items.push({
      type: 'website',
      entityId: (url.metadata?.entityId as string) || '',
      title: (url.metadata?.title as string) || 'Website',
      metadata: {
        ...url.metadata,
        url: url.url,
      },
    });
  }

  return purgeContextItems(items);
};

export const convertContextItemsToNodeFilters = (items: IContextItem[]): CanvasNodeFilter[] => {
  const uniqueItems = new Map<string, CanvasNodeFilter>();

  for (const item of items ?? []) {
    // resources are no longer present in canvas
    if (item.type === 'resource') {
      continue;
    }

    const type = item.selection?.sourceEntityType ?? (item.type as CanvasNodeType);
    const entityId = item.selection?.sourceEntityId ?? item.entityId;

    const key = `${type}-${entityId}`;
    if (!uniqueItems.has(key)) {
      uniqueItems.set(key, { type, entityId });
    }
  }

  return Array.from(uniqueItems.values());
};

/**
 * Remove duplicates from an array based on a key function
 * @param array Array to deduplicate
 * @param keyFn Function to extract the key for deduplication
 * @returns Deduplicated array
 */
const deduplicate = <T>(array: T[] | null | undefined, keyFn: (item: T) => string): T[] => {
  if (!array || !Array.isArray(array)) {
    return [];
  }

  const seen = new Set<string>();
  return array.filter((item) => {
    // Skip nullish items
    if (item == null) {
      return false;
    }

    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export const convertContextItemsToInvokeParams = (
  items: IContextItem[],
  resultIds: string[],
  workflowVariables?: WorkflowVariable[], // WorkflowVariable[] - accepting workflow variables for resolving resource variables
): SkillContext => {
  const purgedItems = purgeContextItems(items);

  // Build a map from variableId to fileId for resource variables
  const variableToFileIdMap = new Map<
    string,
    { fileId: string; variableId: string; variableName: string }
  >();

  // Collect all files from resource variables
  const filesFromVariables: SkillContextFileItem[] = [];

  if (workflowVariables) {
    for (const variable of workflowVariables) {
      if (variable.variableType === 'resource' && variable.value?.length > 0) {
        const fileId = variable.value[0]?.resource?.fileId;
        if (fileId) {
          variableToFileIdMap.set(variable.variableId, {
            fileId,
            variableId: variable.variableId,
            variableName: variable.name,
          });
          // Also add to filesFromVariables for direct inclusion
          filesFromVariables.push({
            fileId,
            variableId: variable.variableId,
            variableName: variable.name,
          });
        }
      }
    }
  }

  // Get files from context items (for backward compatibility)
  const filesFromContextItems = purgedItems
    ?.filter((item) => item?.type === 'file')
    .map((item) => {
      // For resource variables, resolve variableId to fileId
      if (item.metadata?.source === 'variable' && item.metadata?.variableId) {
        const detail = variableToFileIdMap.get(item.metadata.variableId);
        if (detail) {
          // Find the variable to get its name
          return detail;
        }
        // If variableId cannot be resolved, skip this item
        console.warn(`Cannot resolve variableId ${item.metadata.variableId} to fileId, skipping`);
        return null;
      }
      // For direct file references, use entityId as fileId
      return {
        fileId: item.entityId,
      };
    })
    .filter((item): item is SkillContextFileItem => item !== null);

  // Merge files from both sources, deduplicating by fileId
  const allFiles = [...filesFromVariables, ...(filesFromContextItems ?? [])];

  const context: SkillContext = {
    files: deduplicate(allFiles, (item) => item.fileId),
    results: deduplicate(
      resultIds.map((resultId) => ({
        resultId,
      })),
      (item) => item.resultId,
    ),
  };

  return context;
};

export const convertContextItemsToEdges = (
  resultId: string,
  items: IContextItem[],
  nodes?: Node[],
  edges?: Edge[],
): { edgesToAdd: Edge[]; edgesToDelete: Edge[] } => {
  // Initialize arrays for new edges and edges to be deleted
  const edgesToAdd: Edge[] = [];
  const edgesToDelete: Edge[] = [];

  // Return early if no items to process
  if (!items?.length) {
    return { edgesToAdd, edgesToDelete };
  }

  const currentNode = nodes?.find((node) => node.data?.entityId === resultId);
  if (!currentNode) {
    console.warn('currentNode not found');
    return { edgesToAdd, edgesToDelete };
  }

  const relatedEdges = edges?.filter((edge) => edge.target === currentNode.id) ?? [];

  // Create a map of source entity IDs to their corresponding node IDs
  const entityNodeMap = new Map<string, string>();
  for (const node of nodes ?? []) {
    if (node.data?.entityId) {
      entityNodeMap.set(node.data.entityId as string, node.id);
    }
  }

  const itemNodeIds = items.map((item) => entityNodeMap.get(item.entityId as string));
  const itemNodeIdSet = new Set(itemNodeIds);

  const edgeSourceIds = relatedEdges.map((edge) => edge.source);
  const edgeSourceIdSet = new Set(edgeSourceIds);

  // Process each item to create edges based on relationships
  for (const item of items ?? []) {
    const itemNodeId = entityNodeMap.get(item.entityId as string);
    if (itemNodeId && !edgeSourceIdSet.has(itemNodeId)) {
      const newEdge: Edge = {
        id: `${itemNodeId}-${currentNode.id}`,
        source: itemNodeId,
        target: currentNode.id,
      };
      edgesToAdd.push(newEdge);
    }
  }

  // Delete edges that are no longer part of the context items
  for (const edge of relatedEdges ?? []) {
    if (!itemNodeIdSet.has(edge.source)) {
      edgesToDelete.push(edge);
    }
  }

  return {
    edgesToAdd,
    edgesToDelete,
  };
};

/**
 * Purge the metadata from the context items
 * @param items
 * @returns purged context items
 */
export const purgeContextItems = (items: IContextItem[]): IContextItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => {
    if (
      ['image', 'video', 'audio', 'resource', 'document', 'codeArtifact', 'file'].includes(
        item.type as string,
      )
    ) {
      return item;
    }
    return {
      ...omit(item, ['metadata']),
      metadata: {
        withHistory: item.metadata?.withHistory,
      },
    };
  });
};

export const purgeContextForActionResult = (context: SkillContext) => {
  // remove actual content from context to save storage
  const contextCopy: SkillContext = safeParseJSON(JSON.stringify(context ?? {}));
  if (contextCopy.resources) {
    for (const { resource } of contextCopy.resources) {
      if (resource) {
        resource.content = '';
      }
    }
  }
  if (contextCopy.documents) {
    for (const { document } of contextCopy.documents) {
      if (document) {
        document.content = '';
      }
    }
  }

  if (contextCopy.codeArtifacts) {
    for (const { codeArtifact } of contextCopy.codeArtifacts) {
      if (codeArtifact) {
        codeArtifact.content = '';
      }
    }
  }

  if (contextCopy.files) {
    for (const { file } of contextCopy.files) {
      if (file) {
        file.content = '';
      }
    }
  }

  if (contextCopy.results) {
    for (const item of contextCopy.results) {
      item.result = undefined;
    }
  }

  return contextCopy;
};
