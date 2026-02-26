/**
 * Response utilities
 * Helper functions for processing tool execution responses
 */

import type { HandlerResponse } from '@refly/openapi-schema';

/**
 * Extract all resource fields (fileId, files) from nested response data to top level
 * This ensures frontend can easily access file references regardless of nesting depth
 *
 * @param response - Handler response to process
 * @returns Response with resource fields extracted to top level
 */
export function extractFileIdToTopLevel(response: HandlerResponse): HandlerResponse {
  if (!response.success || !response.data || typeof response.data !== 'object') {
    return response;
  }

  const extractedResources: {
    fileId?: string;
    files?: Array<{ fileId: string; mimeType?: string; name?: string }>;
  } = {};

  /**
   * Recursively traverse object to find fileId and files fields
   */
  const findResources = (obj: unknown, depth = 0): void => {
    // Prevent infinite recursion
    if (depth > 10 || !obj || typeof obj !== 'object') {
      return;
    }

    const objRecord = obj as Record<string, unknown>;

    // Check for fileId field
    if ('fileId' in objRecord && typeof objRecord.fileId === 'string') {
      if (!extractedResources.fileId) {
        extractedResources.fileId = objRecord.fileId;
      }
    }

    // Check for files array field
    if ('files' in objRecord && Array.isArray(objRecord.files)) {
      if (!extractedResources.files) {
        extractedResources.files = objRecord.files
          .filter((file) => file && typeof file === 'object' && 'fileId' in file)
          .map((file) => ({
            url: file.url,
            fileId: String(file.fileId),
            mimeType: 'mimeType' in file ? String(file.mimeType) : undefined,
            name: 'name' in file ? String(file.name) : undefined,
          }));
      }
    }

    // Recursively traverse nested objects and arrays
    for (const value of Object.values(objRecord)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          findResources(item, depth + 1);
        }
      } else if (value && typeof value === 'object') {
        findResources(value, depth + 1);
      }
    }
  };

  // Find all resources in the response data
  findResources(response.data);

  // If resources found, add them to top level of response.data
  if (extractedResources.fileId || extractedResources.files?.length) {
    return {
      ...response,
      data: {
        ...(response.data as Record<string, unknown>),
        ...extractedResources,
      },
    };
  }

  return response;
}
