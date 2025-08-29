import type { WorkflowVariable } from '@refly/openapi-schema';

/**
 * Canvas record variable used for step/result records in mention list.
 * Keeps minimal fields needed by UI and mention handling.
 */
export interface CanvasRecordVariable {
  name: string;
  description?: string;
  /** Data source type distinct from regular variables */
  source: 'stepRecord' | 'resultRecord';
  /** Variable type used for icon rendering; aligns with node.type */
  variableType: string;
  /** Optional ids for context linking */
  entityId?: string;
  nodeId?: string;
}

/**
 * Union type for mention-capable variables: regular workflow variables or canvas record variables.
 */
export type MentionVariable = WorkflowVariable | CanvasRecordVariable;
