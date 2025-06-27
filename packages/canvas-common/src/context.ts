import { ActionResult, CanvasNodeType, SkillContext } from '@refly/openapi-schema';
import { IContextItem } from '@refly/common-types';
import { Node, Edge } from '@xyflow/react';
import { getClientOrigin, omit } from '@refly/utils';
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
      title: item.title,
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

  // Handle images separately - they're not part of the standard contentList
  // Images are handled specially in useInvokeAction.ts via findImages
  // if (context?.images && Array.isArray(context.input.images)) {
  //   for (const imageKey of context.input.images) {
  //     // Add image context items
  //     items.push({
  //       type: 'image',
  //       entityId: typeof imageKey === 'object' ? imageKey.entityId || '' : '',
  //       title: typeof imageKey === 'object' ? imageKey.title || 'Image' : 'Image',
  //       metadata: {
  //         storageKey: typeof imageKey === 'object' ? imageKey.storageKey : imageKey,
  //         imageUrl: typeof imageKey === 'object' ? imageKey.imageUrl || '' : '',
  //         // Other image-specific metadata
  //         ...(typeof imageKey === 'object' ? imageKey.metadata || {} : {}),
  //       },
  //     });
  //   }
  // }

  return purgeContextItems(items);
};

export const convertContextItemsToNodeFilters = (items: IContextItem[]): CanvasNodeFilter[] => {
  const uniqueItems = new Map<string, CanvasNodeFilter>();

  for (const item of items ?? []) {
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
  getHistory: (item: IContextItem) => ActionResult[],
  getMemo?: (item: IContextItem) => { content: string; title: string }[],
  getImages?: (
    item: IContextItem,
  ) => { storageKey: string; title: string; entityId: string; metadata: any }[],
  getWebsite?: (item: IContextItem) => { url: string; title: string }[],
): { context: SkillContext; resultHistory: ActionResult[]; images: string[] } => {
  const purgedItems = purgeContextItems(items);

  // Create content list with selections
  const selectionContentList =
    purgedItems
      ?.filter((item) => item.selection)
      ?.map((item) => ({
        content: item.selection?.content ?? '',
        metadata: {
          domain: item.selection?.sourceEntityType ?? '',
          entityId: item.selection?.sourceEntityId ?? '',
          title: item.selection?.sourceTitle ?? '',
          ...(item.metadata?.sourceType === 'extensionWeblinkSelection' && {
            url: item.metadata?.url || getClientOrigin(),
          }),
        },
      })) ?? [];

  // Create content list with memos
  const memoContentList =
    purgedItems
      ?.filter((item) => item.type === 'memo' && getMemo)
      ?.flatMap((item) =>
        getMemo(item).map((memo) => ({
          content: memo.content,
          metadata: {
            domain: 'memo',
            entityId: item.entityId,
            title: memo.title,
          },
        })),
      ) ?? [];

  // Combine all content lists and deduplicate by content and entityId
  const combinedContentList = deduplicate(
    [...selectionContentList, ...memoContentList],
    (item) => `${item.metadata.entityId}-${(item.content || '').substring(0, 100)}`,
  );

  const context = {
    contentList: combinedContentList,
    resources: deduplicate(
      purgedItems
        ?.filter((item) => item?.type === 'resource')
        .map((item) => ({
          resourceId: item.entityId,
          resource: {
            resourceId: item.entityId,
            resourceType: item.metadata?.resourceType,
            title: item.title,
          },
          isCurrent: item.isCurrentContext,
          metadata: {
            ...item.metadata,
          },
        })),
      (item) => item.resourceId,
    ),
    documents: deduplicate(
      purgedItems
        ?.filter((item) => item?.type === 'document')
        .map((item) => ({
          docId: item.entityId,
          document: {
            docId: item.entityId,
            title: item.title,
          },
          isCurrent: item.isCurrentContext,
          metadata: {
            ...item.metadata,
            url: getClientOrigin(),
          },
        })),
      (item) => item.docId,
    ),
    codeArtifacts: deduplicate(
      purgedItems
        ?.filter((item) => item?.type === 'codeArtifact')
        .map((item) => ({
          artifactId: item.entityId,
          codeArtifact: {
            artifactId: item.entityId,
            title: item.title,
            type: item.metadata?.artifactType ?? 'unknown',
          },
          isCurrent: item.isCurrentContext,
          metadata: {
            ...item.metadata,
          },
        })),
      (item) => item.artifactId,
    ),
    urls: deduplicate(
      purgedItems
        ?.filter((item) => item?.type === 'website')
        .flatMap((item) => {
          if (getWebsite) {
            return getWebsite(item).map((site) => ({
              url: site.url || '',
              metadata: {
                title: site.title,
                ...item.metadata,
              },
            }));
          }

          return [
            {
              url: item.metadata?.url || '',
              metadata: {
                title: item.title,
                ...item.metadata,
              },
            },
          ];
        }),
      (item) => item.url,
    ),
  };
  // Process history items - get all skill responses
  const skillResponseItems = purgedItems.filter((item) => item.type === 'skillResponse');

  // Process items with history differently than single items
  const historyItems = skillResponseItems
    .filter((item) => item.metadata?.withHistory)
    .flatMap((item) => getHistory(item));

  // Process single items (without history)
  const singleHistoryItems = skillResponseItems
    .filter((item) => !item.metadata?.withHistory)
    .map((item) => ({ title: item.title, resultId: item.entityId }));

  // Combine and deduplicate by resultId
  const resultHistory = deduplicate(
    [...historyItems, ...singleHistoryItems],
    (item) => item.resultId,
  );

  // Process image items - extract only storageKeys
  const images = purgedItems
    ?.filter((item) => item.type === 'image')
    .flatMap((item) => {
      if (getImages) {
        return getImages(item)
          .map((img) => img.storageKey)
          .filter(Boolean);
      }
      // Direct storageKey extraction for standard image items
      if (item.metadata?.storageKey) {
        return [item.metadata.storageKey];
      }
      return [];
    });

  return { context, resultHistory, images };
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

  const currentNode = nodes.find((node) => node.data?.entityId === resultId);
  if (!currentNode) {
    console.warn('currentNode not found');
    return { edgesToAdd, edgesToDelete };
  }

  const relatedEdges = edges.filter((edge) => edge.target === currentNode.id) ?? [];

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
    if (!edgeSourceIdSet.has(itemNodeId)) {
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
  return items.map((item) => ({
    ...omit(item, ['metadata']),
    metadata: {
      withHistory: item.metadata?.withHistory,
    },
  }));
};
