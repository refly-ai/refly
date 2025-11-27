import type { DriveFile, WorkflowVariable } from '@refly/openapi-schema';

export type MentionItemType = 'var' | 'agent' | 'file' | 'toolset' | 'tool';

export interface MentionCommonData {
  type: MentionItemType;
  id: string;
  name: string;
}

export interface MentionParseResult {
  variables: WorkflowVariable[];
}

// input query: this is a test @{type=var,id=var-1,name=cv_folder_url}, with file @{type=file,id=file-1,name=file_1.txt}
// output: [{ type: 'var', id: 'var-1', name: 'cv_folder_url' }, { type: 'file', id: 'file-1', name: 'file_1.txt' }]
export function parseMentionsFromQuery(query: string): MentionCommonData[] {
  const mentionRegex = /@\{([^}]+)\}/g;
  const matches = query.match(mentionRegex);
  if (!matches) {
    return [];
  }

  return matches
    .map((match) => {
      // Extract the content inside the braces
      const paramsStr = match.match(/@\{([^}]+)\}/)?.[1];
      if (!paramsStr) return null;

      // Skip malformed mentions that contain nested braces
      if (paramsStr.includes('@{') || paramsStr.includes('}')) {
        return null;
      }

      const params: Record<string, string> = {};
      for (const param of paramsStr.split(',')) {
        const [key, value] = param.split('=');
        if (key && value) {
          params[key.trim()] = value.trim();
        }
      }

      const { type, id, name } = params;

      // Validate required fields
      if (!type || !id || !name) {
        return null;
      }

      // Validate type is one of the allowed types
      if (!['var', 'resource'].includes(type)) {
        return null;
      }

      return { type: type as MentionItemType, id, name };
    })
    .filter((mention): mention is MentionCommonData => mention !== null);
}

export interface ProcessQueryResult {
  processedQuery: string;
  llmInputQuery: string;
  updatedQuery: string;
  resourceVars: WorkflowVariable[];
}

type MentionFormatMode = 'display' | 'llm_input';

/**
 * Format mention based on type and mode
 */
function formatMention(type: string, name: string, mode: MentionFormatMode): string {
  if (mode === 'display') {
    return `@${name}`;
  } else {
    // llm_input mode
    if (type === 'var') {
      return `@var:${name}`;
    } else if (type === 'file') {
      return `@file:${name}`;
    } else {
      return `@${type}:${name}`;
    }
  }
}

/**
 * Process a single mention and return the replacement string
 */
function processMention(
  match: string,
  paramsStr: string,
  options: {
    replaceVars: boolean;
    variables: WorkflowVariable[];
    files: DriveFile[];
    mode: MentionFormatMode;
    resourceVars: WorkflowVariable[];
    updatedQuery: string;
  },
): { replacement: string; updatedQuery: string } {
  const { replaceVars, variables, files, mode, resourceVars } = options;
  let updatedQuery = options.updatedQuery;

  const params: Record<string, string> = {};
  for (const param of paramsStr.split(',')) {
    const [key, value] = param.split('=');
    if (key && value) {
      params[key.trim()] = value.trim();
    }
  }

  const { type, id, name } = params;

  if (type === 'var') {
    if (replaceVars && variables.length > 0) {
      // Find variable by id
      const variable = variables.find((v) => 'variableId' in v && v.variableId === id);

      if (variable && 'value' in variable) {
        if (variable.variableType === 'resource') {
          // Mark resource variables for injection when replaceVars is true
          // Only add to resourceVars once (when processing display mode)
          if (mode === 'display') {
            resourceVars.push({ ...variable, value: variable.value });
          }
          return { replacement: '', updatedQuery };
        } else {
          // Replace non-resource variables with their actual values when replaceVars is true
          const values = variable.value;
          const textValues =
            values
              ?.filter((v) => v.type === 'text' && v.text)
              .map((v) => v.text)
              .filter(Boolean) ?? [];

          const stringValue = textValues.length > 0 ? textValues.join(', ') : '';
          return { replacement: stringValue, updatedQuery };
        }
      }
    }

    // When replaceVars is false or variable not found, replace with formatted mention
    return { replacement: formatMention(type, name, mode), updatedQuery };
  }

  if (type === 'file') {
    // If files are provided, find the file by fileId and use its title
    if (files.length > 0) {
      const file = files.find((f) => f.fileId === id);
      if (file) {
        const fileName = file.name;
        // Only update updatedQuery once (when processing display mode)
        if (mode === 'display') {
          const updatedMention = `@{type=file,id=${id},name=${fileName}}`;
          updatedQuery = updatedQuery.replace(match, updatedMention);
        }
        return { replacement: formatMention('file', fileName, mode), updatedQuery };
      }
    }

    // Check if there's a resource variable with the same entityId
    // If found, use the variable's name instead of the mention's name
    const matchingVariable = variables.find(
      (v) =>
        'value' in v &&
        v.variableType === 'resource' &&
        v.value?.some((val) => val.type === 'resource' && val.resource?.entityId === id),
    );

    if (matchingVariable) {
      // Mark for resource injection and use variable's name
      // Only add to resourceVars once (when processing display mode)
      if (mode === 'display') {
        const alreadyAdded = resourceVars.some(
          (rv) => rv.variableId === matchingVariable.variableId,
        );
        if (!alreadyAdded) {
          resourceVars.push({ ...matchingVariable, value: matchingVariable.value });
        }

        // Update the updatedQuery with the correct resource name
        const variableResourceName = matchingVariable.value[0]?.resource?.name ?? '';
        const updatedMention = `@{type=resource,id=${id},name=${variableResourceName}}`;
        updatedQuery = updatedQuery.replace(match, updatedMention);
      }

      const variableResourceName = matchingVariable.value[0]?.resource?.name ?? '';
      return { replacement: formatMention('file', variableResourceName, mode), updatedQuery };
    }

    // Replace resource mentions with the formatted name
    return { replacement: formatMention(type, name, mode), updatedQuery };
  }

  if (type === 'agent' || type === 'toolset' || type === 'tool') {
    // Replace step, toolset and tool mentions with the formatted name
    return { replacement: formatMention(type, name, mode), updatedQuery };
  }

  return { replacement: formatMention(type, name ?? match, mode), updatedQuery };
}

/**
 * Process query with workflow variables and mentions using regex replacement
 * Supports mention types: var, resource, step, toolset, and tool
 * @param query - The original query string
 * @param options - Options for processing query
 * @returns Processed query string and resource variables
 */
export function processQueryWithMentions(
  query: string,
  options?: {
    replaceVars?: boolean;
    variables?: WorkflowVariable[];
    files?: DriveFile[];
  },
): ProcessQueryResult {
  const { replaceVars = false, variables = [], files = [] } = options ?? {};

  if (!query) {
    return { processedQuery: query, llmInputQuery: query, updatedQuery: query, resourceVars: [] };
  }

  const resourceVars: WorkflowVariable[] = [];
  let updatedQuery = query;

  // Regex to match mentions like @{type=var,id=var-1,name=cv_folder_url}
  const mentionRegex = /@\{([^}]+)\}/g;

  // Process display mode
  const processedQuery = query.replace(mentionRegex, (match, paramsStr) => {
    const result = processMention(match, paramsStr, {
      replaceVars,
      variables,
      files,
      mode: 'display',
      resourceVars,
      updatedQuery,
    });
    updatedQuery = result.updatedQuery;
    return result.replacement;
  });

  // Process llm_input mode (don't modify resourceVars or updatedQuery again)
  const llmInputQuery = query.replace(mentionRegex, (match, paramsStr) => {
    const result = processMention(match, paramsStr, {
      replaceVars,
      variables,
      files,
      mode: 'llm_input',
      resourceVars: [], // Don't modify resourceVars in llm_input mode
      updatedQuery: '', // Don't modify updatedQuery in llm_input mode
    });
    return result.replacement;
  });

  return { processedQuery, llmInputQuery, updatedQuery, resourceVars };
}

/**
 * Replace resource mentions in a query string with updated entity IDs and names.
 *
 * This function processes resource mentions in the format `@{type=resource,id=entityId,name=resourceName}`
 * and updates them based on the provided variables and entity ID mapping.
 *
 * @param query - The input query string containing resource mentions
 * @param variables - Array of workflow variables to match against resource mentions
 * @param entityIdMap - Mapping from old entity IDs to new entity IDs
 * @returns The query string with updated resource mentions
 *
 * @example
 * ```typescript
 * // Input query with old resource mention
 * const query = "open the file @{type=resource,id=entity-123,name=oldResourceName}";
 *
 * // Variables containing the resource with updated info
 * const variables = [{
 *   variableId: 'resource-1',
 *   name: 'resourceVar',
 *   variableType: 'resource',
 *   value: [{
 *     type: 'resource',
 *     resource: {
 *       name: 'newResourceName',
 *       entityId: 'entity-456'
 *     }
 *   }]
 * }];
 *
 * // Entity ID mapping
 * const entityIdMap = { 'entity-123': 'entity-456' };
 *
 * // Result: "open the file @{type=resource,id=entity-456,name=newResourceName}"
 * const result = replaceResourceMentionsInQuery(query, variables, entityIdMap);
 * ```
 */
export const replaceResourceMentionsInQuery = (
  query: string,
  variables: WorkflowVariable[],
  entityIdMap: Record<string, string>,
): string => {
  // Return empty query as-is
  if (!query) {
    return query;
  }

  // Regex to match resource mentions in the format @{type=resource,id=entity-123,name=oldResourceName}
  const resourceMentionRegex = /@\{([^}]+)\}/g;

  return query.replace(resourceMentionRegex, (match, paramsStr) => {
    // Parse the mention parameters into a key-value object
    const params: Partial<MentionCommonData> = {};
    for (const param of paramsStr.split(',')) {
      const [key, value] = param.split('=');
      if (key && value) {
        params[key.trim()] = value.trim();
      }
    }

    const { type, id, name } = params;

    // Only process file type mentions, leave other types unchanged
    if (type !== 'file') {
      return match;
    }

    // Find the corresponding workflow variable that contains this resource entity
    const matchingVariable = variables.find(
      (v) =>
        'value' in v &&
        v.variableType === 'resource' &&
        v.value?.some((val) => val.type === 'resource' && val.resource?.entityId === id),
    );

    // If a matching variable is found, update both entityId and name
    if (matchingVariable?.value?.[0]?.resource) {
      const resource = matchingVariable.value[0].resource;
      // Use entityIdMap to get new entityId, fallback to resource's entityId
      const newEntityId = entityIdMap[id] ?? resource.entityId;
      // Use the resource's current name from the variable
      const newName = resource.name;

      return `@{type=resource,id=${newEntityId},name=${newName}}`;
    }

    // If no matching variable found, try to update only the entityId using entityIdMap
    const newEntityId = entityIdMap[id];
    if (newEntityId) {
      return `@{type=resource,id=${newEntityId},name=${name}}`;
    }

    // Return original mention if no updates are needed
    return match;
  });
};
