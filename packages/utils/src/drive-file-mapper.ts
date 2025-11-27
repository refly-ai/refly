import type { DriveFile, CanvasNodeType, WorkflowNodeExecution } from '@refly/openapi-schema';

// Define a minimal CanvasNode type for mapping purposes
// This avoids circular dependencies with @refly/canvas-common
type CanvasNode = {
  id: string;
  type: string;
  data?: {
    title?: string;
    entityId?: string;
    metadata?: Record<string, any>;
    [key: string]: any;
  };
  position?: { x: number; y: number };
  [key: string]: any;
};

/**
 * Map DriveFile category to CanvasNodeType
 */
const CATEGORY_TO_NODE_TYPE_MAP: Record<string, CanvasNodeType> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  document: 'document',
  code: 'codeArtifact',
};

/**
 * Map DriveFile to CanvasNode for display purposes
 * @param file - DriveFile from API
 * @param serverOrigin - Server origin for constructing content URLs
 * @returns CanvasNode or null if category is not supported
 */
export function mapDriveFileToCanvasNode(file: DriveFile, serverOrigin: string): CanvasNode | null {
  const nodeType = CATEGORY_TO_NODE_TYPE_MAP[file.category];
  if (!nodeType) {
    return null;
  }

  // Construct content URL for file access
  const contentUrl = `${serverOrigin}/v1/drive/file/content/${file.fileId}`;

  // Build metadata with all DriveFile fields for FilePreview component
  const metadata: Record<string, any> = {
    fileId: file.fileId,
    canvasId: file.canvasId,
    type: file.type,
    publicURL: (file as unknown as { publicURL?: string })?.publicURL ?? undefined,
    source: file.source,
    scope: file.scope,
    size: file.size,
    summary: file.summary,
    variableId: file.variableId,
    resultId: file.resultId ?? '',
    resultVersion: file.resultVersion ?? null,
    content: file.content,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };

  // Add category-specific URL fields for backward compatibility with existing preview components
  if (file.category === 'image') {
    metadata.imageUrl = contentUrl;
  } else if (file.category === 'video') {
    metadata.videoUrl = contentUrl;
  } else if (file.category === 'audio') {
    metadata.audioUrl = contentUrl;
  }

  return {
    id: file.fileId, // Use fileId as node ID
    type: nodeType,
    data: {
      title: file.name,
      entityId: file.fileId,
      metadata,
    },
    position: { x: 0, y: 0 },
  } as any as CanvasNode;
}

/**
 * Map DriveFile to WorkflowNodeExecution for runtime product display
 * @param file - DriveFile from API
 * @param serverOrigin - Server origin for constructing content URLs
 * @returns WorkflowNodeExecution or null if category is not supported
 */
export function mapDriveFileToWorkflowNodeExecution(
  file: DriveFile,
  serverOrigin: string,
): WorkflowNodeExecution | null {
  const nodeType = CATEGORY_TO_NODE_TYPE_MAP[file.category];
  if (!nodeType) {
    return null;
  }

  // Construct content URL for file access
  const contentUrl = `${serverOrigin}/v1/drive/file/content/${file.fileId}`;

  // Build metadata with all DriveFile fields for FilePreview component
  const metadata: Record<string, any> = {
    fileId: file.fileId,
    canvasId: file.canvasId,
    type: file.type,
    publicURL: (file as unknown as { publicURL?: string })?.publicURL ?? undefined,
    source: file.source,
    scope: file.scope,
    size: file.size,
    summary: file.summary,
    variableId: file.variableId,
    resultId: file.resultId ?? '',
    resultVersion: file.resultVersion ?? null,
    content: file.content,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };

  // Add category-specific URL fields for backward compatibility with existing preview components
  if (file.category === 'image') {
    metadata.imageUrl = contentUrl;
  } else if (file.category === 'video') {
    metadata.videoUrl = contentUrl;
  } else if (file.category === 'audio') {
    metadata.audioUrl = contentUrl;
  }

  return {
    nodeId: file.fileId, // Use fileId as nodeId
    nodeType: nodeType as CanvasNodeType,
    status: 'finish',
    title: file.name,
    nodeData: JSON.stringify({
      data: {
        title: file.name,
        entityId: file.fileId,
        metadata,
      },
    }),
    entityId: file.fileId,
  } as WorkflowNodeExecution;
}

/**
 * Batch map DriveFiles to CanvasNodes
 * @param files - Array of DriveFiles
 * @param serverOrigin - Server origin for constructing content URLs
 * @returns Array of CanvasNodes (filtered for supported categories)
 */
export function mapDriveFilesToCanvasNodes(files: DriveFile[], serverOrigin: string): CanvasNode[] {
  return files
    .map((file) => mapDriveFileToCanvasNode(file, serverOrigin))
    .filter((node): node is CanvasNode => node !== null);
}

/**
 * Batch map DriveFiles to WorkflowNodeExecutions
 * @param files - Array of DriveFiles
 * @param serverOrigin - Server origin for constructing content URLs
 * @returns Array of WorkflowNodeExecutions (filtered for supported categories)
 */
export function mapDriveFilesToWorkflowNodeExecutions(
  files: DriveFile[],
  serverOrigin: string,
): WorkflowNodeExecution[] {
  return files
    .map((file) => mapDriveFileToWorkflowNodeExecution(file, serverOrigin))
    .filter((execution): execution is WorkflowNodeExecution => execution !== null);
}
