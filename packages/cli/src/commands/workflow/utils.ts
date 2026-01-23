/**
 * Shared utilities for workflow commands
 */

/**
 * ID type detection based on prefix:
 * - workflowId: starts with 'c-' (canvas)
 * - runId: starts with 'we-' (workflow execution)
 */
export type IdType = 'workflow' | 'run';

/**
 * Detect ID type based on prefix
 */
export function detectIdType(id: string): IdType {
  if (id.startsWith('we-')) {
    return 'run';
  }
  // Default to workflow (c- prefix or other)
  return 'workflow';
}

/**
 * Build API URL that supports both workflowId and runId
 *
 * For workflowId (c-xxx): uses /v1/cli/workflow/{workflowId}/{endpoint}
 * For runId (we-xxx): uses /v1/cli/workflow/run/{runId}/{endpoint}
 */
export function buildWorkflowApiUrl(
  id: string,
  endpoint: string,
  params?: URLSearchParams,
): string {
  const idType = detectIdType(id);
  let basePath: string;

  if (idType === 'run') {
    // Run-specific endpoint
    basePath = `/v1/cli/workflow/run/${id}`;
    if (endpoint) {
      basePath += `/${endpoint}`;
    }
  } else {
    // Workflow-based endpoint (uses latest run)
    basePath = `/v1/cli/workflow/${id}`;
    if (endpoint) {
      basePath += `/${endpoint}`;
    }
  }

  const queryString = params?.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

/**
 * Format ID for display, showing the type
 */
export function formatIdForDisplay(id: string): string {
  const idType = detectIdType(id);
  return idType === 'run' ? `Run ${id}` : `Workflow ${id}`;
}
