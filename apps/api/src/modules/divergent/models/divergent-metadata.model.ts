/**
 * Divergent role types for skill response nodes
 */
export type DivergentRole = 'summary' | 'execution' | 'final_output';

/**
 * Metadata interface for DivergentAgent nodes
 * This extends the existing ActionResult metadata to identify and manage divergent nodes
 */
export interface DivergentMetadata {
  /** Role of this node in the divergent process */
  divergentRole: DivergentRole;

  /** Divergent level (0-5) indicating the depth in the total-divide-total loop */
  divergentLevel: number;

  /** ID of the divergent session this node belongs to */
  divergentSessionId: string;

  /** Optional list of parent node IDs for dependency tracking */
  parentNodeIds?: string[];

  /** Optional completion score for summary nodes (0-1) */
  completionScore?: number;
}

/**
 * Type guard to check if metadata contains divergent information
 */
export function isDivergentMetadata(metadata: any): metadata is DivergentMetadata {
  return (
    metadata !== null &&
    metadata !== undefined &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    typeof metadata.divergentRole === 'string' &&
    ['summary', 'execution', 'final_output'].includes(metadata.divergentRole) &&
    typeof metadata.divergentLevel === 'number' &&
    metadata.divergentLevel >= 0 &&
    metadata.divergentLevel <= 5 &&
    typeof metadata.divergentSessionId === 'string' &&
    metadata.divergentSessionId.length > 0
  );
}

/**
 * Creates a new divergent metadata object
 */
export function createDivergentMetadata(
  role: DivergentRole,
  level: number,
  sessionId: string,
  parentNodeIds?: string[],
  completionScore?: number,
): DivergentMetadata {
  if (level < 0 || level > 5) {
    throw new Error('Divergent level must be between 0 and 5');
  }

  if (completionScore !== undefined && (completionScore < 0 || completionScore > 1)) {
    throw new Error('Completion score must be between 0 and 1');
  }

  return {
    divergentRole: role,
    divergentLevel: level,
    divergentSessionId: sessionId,
    parentNodeIds,
    completionScore,
  };
}
