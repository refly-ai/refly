import {
  SkillContext,
  ActionResult,
  SkillContextResourceItem,
  SkillContextDocumentItem,
  SkillContextContentItem,
  SkillContextUrlItem,
} from '@refly-packages/openapi-schema';

/**
 * Merges context from result history with the current context.
 * Current context items have priority and duplicates are removed.
 *
 * @param currentContext - The current context
 * @param resultHistory - Array of previous action results containing contexts
 * @returns Merged context with deduplication and prioritization
 */
export const mergeContextWithHistory = (
  currentContext: SkillContext = {},
  resultHistory?: ActionResult[],
): SkillContext => {
  if (!resultHistory?.length) {
    return currentContext;
  }

  // Extract all contexts from history
  const historicalContexts: SkillContext[] = resultHistory
    .filter((result) => result?.context)
    .map((result) => result.context as SkillContext);

  if (!historicalContexts.length) {
    return currentContext;
  }

  // Create result context with empty arrays or undefined
  const mergedContext: SkillContext = {};

  // Process resources - using resourceId as unique key
  const resourceIds = new Set<string>();
  let mergedResources: SkillContextResourceItem[] = [];

  // Add current resources first (higher priority)
  if (currentContext.resources?.length) {
    mergedResources = [...currentContext.resources];
    // Track added resourceIds
    for (const item of currentContext.resources) {
      if (item.resourceId) {
        resourceIds.add(item.resourceId);
      }
    }
  }

  // Add unique resources from history
  for (const context of historicalContexts) {
    if (context.resources?.length) {
      const uniqueResources = context.resources.filter((item) => {
        // Skip if no resourceId or already added
        if (!item.resourceId || resourceIds.has(item.resourceId)) {
          return false;
        }
        resourceIds.add(item.resourceId);
        return true;
      });

      if (uniqueResources.length) {
        mergedResources = [...mergedResources, ...uniqueResources];
      }
    }
  }

  // Only set resources if we have any
  if (mergedResources.length > 0) {
    mergedContext.resources = mergedResources;
  }

  // Process documents - using docId as unique key
  const docIds = new Set<string>();
  let mergedDocuments: SkillContextDocumentItem[] = [];

  // Add current documents first (higher priority)
  if (currentContext.documents?.length) {
    mergedDocuments = [...currentContext.documents];
    // Track added docIds
    for (const item of currentContext.documents) {
      if (item.docId) {
        docIds.add(item.docId);
      }
    }
  }

  // Add unique documents from history
  for (const context of historicalContexts) {
    if (context.documents?.length) {
      const uniqueDocs = context.documents.filter((item) => {
        // Skip if no docId or already added
        if (!item.docId || docIds.has(item.docId)) {
          return false;
        }
        docIds.add(item.docId);
        return true;
      });

      if (uniqueDocs.length) {
        mergedDocuments = [...mergedDocuments, ...uniqueDocs];
      }
    }
  }

  // Only set documents if we have any
  if (mergedDocuments.length > 0) {
    mergedContext.documents = mergedDocuments;
  }

  // Process contentList - using content as unique key
  const contentSet = new Set<string>();
  let mergedContent: SkillContextContentItem[] = [];

  // Add current content first (higher priority)
  if (currentContext.contentList?.length) {
    mergedContent = [...currentContext.contentList];
    // Track added content
    for (const item of currentContext.contentList) {
      contentSet.add(item.content);
    }
  }

  // Add unique content from history
  for (const context of historicalContexts) {
    if (context.contentList?.length) {
      const uniqueContent = context.contentList.filter((item) => {
        // Skip if already added
        if (contentSet.has(item.content)) {
          return false;
        }
        contentSet.add(item.content);
        return true;
      });

      if (uniqueContent.length) {
        mergedContent = [...mergedContent, ...uniqueContent];
      }
    }
  }

  // Only set contentList if we have any
  if (mergedContent.length > 0) {
    mergedContext.contentList = mergedContent;
  }

  // Process urls - using url as unique key
  const urlSet = new Set<string>();
  let mergedUrls: SkillContextUrlItem[] = [];

  // Add current urls first (higher priority)
  if (currentContext.urls?.length) {
    mergedUrls = [...currentContext.urls];
    // Track added urls
    for (const item of currentContext.urls) {
      urlSet.add(item.url);
    }
  }

  // Add unique urls from history
  for (const context of historicalContexts) {
    if (context.urls?.length) {
      const uniqueUrls = context.urls.filter((item) => {
        // Skip if already added
        if (urlSet.has(item.url)) {
          return false;
        }
        urlSet.add(item.url);
        return true;
      });

      if (uniqueUrls.length) {
        mergedUrls = [...mergedUrls, ...uniqueUrls];
      }
    }
  }

  // Only set urls if we have any
  if (mergedUrls.length > 0) {
    mergedContext.urls = mergedUrls;
  }

  return mergedContext;
};
