/**
 * Batch replace regex in a string
 * @param s - The string to replace
 * @param replaceMap - The map of old id to new id
 * @returns The processed string
 */
export const batchReplaceRegex = (s: string, replaceMap: Record<string, string>) => {
  if (!s || Object.keys(replaceMap ?? {}).length === 0) {
    return s;
  }

  let processedContext = s;
  for (const [oldId, newId] of Object.entries(replaceMap)) {
    processedContext = processedContext.replace(new RegExp(oldId, 'g'), newId);
  }

  return processedContext;
};
