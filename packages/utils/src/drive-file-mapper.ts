import type {
  DriveFile,
  CanvasNodeType,
  WorkflowNodeExecution,
  CanvasNode,
  CanvasEdge,
  RawCanvasData,
} from '@refly/openapi-schema';

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
    entityId: file.resultId,
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

// Types for the new workflow app data structure
export interface WorkflowAppPreview {
  nodes: Array<Partial<CanvasNode>>; // Partial because sanitized nodes may not have all fields
  files: Array<Partial<DriveFile>>; // Partial because sanitized files may not have all fields
}

export interface WorkflowAppData {
  appId: string;
  title: string;
  description: string;
  remixEnabled: boolean;
  coverUrl?: string;
  templateContent?: string;
  resultNodeIds: string[];
  query?: string;
  variables: any[];
  creditUsage: number;
  createdAt: Date | string;
  updatedAt: Date | string;

  // Owner information (for display purposes)
  owner?: {
    uid?: string;
    name?: string;
    nickname?: string;
    avatar?: string;
  };

  // NEW: Top-level canvas identifiers
  canvasId?: string;
  minimapUrl?: string;

  // NEW: Sanitized preview data
  preview?: WorkflowAppPreview;

  // LEGACY: Original canvasData (for backward compatibility)
  canvasData?: {
    canvasId?: string;
    title?: string;
    minimapUrl?: string;
    nodes?: Array<Partial<CanvasNode>>; // Partial because sanitized nodes may not have all fields
    files?: Array<Partial<DriveFile>>; // Partial because sanitized files may not have all fields
    edges?: CanvasEdge[];
    resources?: any[]; // Keep as any[] since resources type varies
    variables?: any[]; // Keep as any[] since variables structure can vary
    // Note: owner should be at top level, not in canvasData
    // This is kept for backward compatibility only
    owner?: never; // Explicitly mark as never to prevent incorrect usage
  };
}

/**
 * Get canvas data from workflow app with backward compatibility
 * This helper function provides a unified interface for accessing canvas data
 * regardless of whether the data uses the new preview structure or legacy canvasData
 *
 * CRITICAL: Returns RawCanvasData-compatible structure with edges field for ToolsDependencyChecker
 *
 * @returns Partial RawCanvasData with required fields for frontend consumption
 */
export function getWorkflowAppCanvasData(
  workflowApp: WorkflowAppData | null | undefined,
): Pick<RawCanvasData, 'canvasId' | 'nodes' | 'edges'> & { files: DriveFile[] } {
  if (!workflowApp) {
    return {
      canvasId: '',
      nodes: [],
      files: [],
      edges: [], // Required for ToolsDependencyChecker
    };
  }

  // Priority 1: New preview structure
  if (workflowApp.preview) {
    return {
      canvasId: workflowApp.canvasId || '',
      nodes: (workflowApp.preview.nodes || []) as CanvasNode[],
      files: (workflowApp.preview.files || []) as DriveFile[], // Cast to DriveFile[] for compatibility
      edges: (workflowApp.canvasData?.edges || []) as CanvasEdge[], // Use edges from legacy canvasData if available
    };
  }

  // Priority 2: Legacy canvasData (for backward compatibility)
  if (workflowApp.canvasData) {
    return {
      canvasId: workflowApp.canvasData.canvasId || workflowApp.canvasId || '',
      nodes: (workflowApp.canvasData.nodes || []) as CanvasNode[],
      files: (workflowApp.canvasData.files || []) as DriveFile[], // Cast to DriveFile[] for compatibility
      edges: (workflowApp.canvasData.edges || []) as CanvasEdge[], // Required for ToolsDependencyChecker
    };
  }

  // Fallback: Empty data
  return {
    canvasId: workflowApp.canvasId || '',
    nodes: [],
    files: [],
    edges: [], // Required for ToolsDependencyChecker
  };
}
