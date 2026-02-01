import type { WorkflowVariable, VariableValue } from '@refly/openapi-schema';

/**
 * Get all resource values from a resource type variable
 */
export function getResourceFiles(variable: WorkflowVariable): VariableValue[] {
  if (variable.variableType !== 'resource') return [];
  return variable.value?.filter((v) => v.type === 'resource' && v.resource) ?? [];
}

/**
 * Get the first resource file from a resource type variable (for single file scenarios)
 */
export function getFirstResourceFile(variable: WorkflowVariable): VariableValue | undefined {
  const files = getResourceFiles(variable);
  return files[0];
}

/**
 * Check if a resource variable has any values
 */
export function hasResourceValue(variable: WorkflowVariable): boolean {
  return getResourceFiles(variable).length > 0;
}

/**
 * Get all fileIds from a resource variable
 */
export function getResourceFileIds(variable: WorkflowVariable): string[] {
  return getResourceFiles(variable)
    .map((v) => v.resource?.fileId)
    .filter((id): id is string => !!id);
}

/**
 * Get all entityIds from a resource variable
 */
export function getResourceEntityIds(variable: WorkflowVariable): string[] {
  return getResourceFiles(variable)
    .map((v) => v.resource?.entityId)
    .filter((id): id is string => !!id);
}

/**
 * Check if a variable is a single-file resource variable
 */
export function isSingleFileVariable(variable: WorkflowVariable): boolean {
  return variable.variableType === 'resource' && variable.isSingle !== false;
}

/**
 * Check if a variable is a multi-file resource variable
 */
export function isMultiFileVariable(variable: WorkflowVariable): boolean {
  return variable.variableType === 'resource' && variable.isSingle === false;
}
