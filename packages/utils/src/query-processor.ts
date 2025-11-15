import type { Resource, WorkflowVariable } from '@refly/openapi-schema';

export interface MentionCommonData {
  type: 'var' | 'resource';
  id: string;
  name: string;
}

export interface MentionParseResult {
  variables: WorkflowVariable[];
}

// input query: this is a test @{type=var,id=var-1,name=cv_folder_url}, with resource @{type=resource,id=resource-1,name=resource_1}
// output: [{ type: 'var', id: 'var-1', name: 'cv_folder_url' }, { type: 'resource', id: 'resource-1', name: 'resource_1' }]
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

      return { type: type as 'var' | 'resource', id, name };
    })
    .filter((mention): mention is MentionCommonData => mention !== null);
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
    resources?: Resource[];
  },
): { processedQuery: string; updatedQuery: string; resourceVars: WorkflowVariable[] } {
  const { replaceVars = false, variables = [], resources = [] } = options ?? {};

  if (!query) {
    return { processedQuery: query, updatedQuery: query, resourceVars: [] };
  }

  let processedQuery = query;
  let updatedQuery = query;
  const resourceVars: WorkflowVariable[] = [];

  // Regex to match mentions like @{type=var,id=var-1,name=cv_folder_url}
  const mentionRegex = /@\{([^}]+)\}/g;

  processedQuery = processedQuery.replace(mentionRegex, (match, paramsStr) => {
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
            resourceVars.push({ ...variable, value: variable.value });
            return '';
          } else {
            // Replace non-resource variables with their actual values when replaceVars is true
            const values = variable.value;
            const textValues =
              values
                ?.filter((v) => v.type === 'text' && v.text)
                .map((v) => v.text)
                .filter(Boolean) ?? [];

            const stringValue = textValues.length > 0 ? textValues.join(', ') : '';
            return stringValue;
          }
        }
      }

      // When replaceVars is false or variable not found, replace with @name format
      return `@${name}`;
    }

    if (type === 'resource') {
      // If resources are provided, find the resource by resourceId and use its title
      if (resources.length > 0) {
        const resource = resources.find((r) => r.resourceId === id);
        if (resource) {
          const resourceName = resource.title;
          const updatedMention = `@{type=resource,id=${id},name=${resourceName}}`;
          updatedQuery = updatedQuery.replace(match, updatedMention);
          return `@${resourceName}`;
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
        // Check if already added to avoid duplicates
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

        return `@${variableResourceName}`;
      }

      // Replace resource mentions with the @name format
      return `@${name}`;
    }

    if (type === 'step' || type === 'toolset' || type === 'tool') {
      // Replace step, toolset and tool mentions with the @name format
      return `@${name}`;
    }

    return `@${name ?? match}`;
  });

  return { processedQuery, updatedQuery, resourceVars };
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
    const params: Record<string, string> = {};
    for (const param of paramsStr.split(',')) {
      const [key, value] = param.split('=');
      if (key && value) {
        params[key.trim()] = value.trim();
      }
    }

    const { type, id, name } = params;

    // Only process resource type mentions, leave other types unchanged
    if (type !== 'resource') {
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
