/**
 * Builder commit - create workflow from validated draft
 */

import { BuilderSession, BuilderState } from './schema.js';
import { saveSession, setCurrent } from './store.js';
import { requireCommittable } from './state.js';
import { apiRequest } from '../api/client.js';

export interface WorkflowCreateRequest {
  name: string;
  description?: string;
  spec: {
    version: number;
    nodes: Array<{
      id: string;
      type: string;
      input: Record<string, unknown>;
      dependsOn: string[];
    }>;
    metadata?: {
      tags?: string[];
      owner?: string;
    };
  };
}

export interface WorkflowCreateResponse {
  workflowId: string;
  name: string;
  createdAt: string;
}

/**
 * Commit the builder session and create a workflow
 */
export async function commitSession(session: BuilderSession): Promise<WorkflowCreateResponse> {
  // Guard: must be validated
  requireCommittable(session);

  const draft = session.workflowDraft;

  // Build workflow spec
  const request: WorkflowCreateRequest = {
    name: draft.name,
    description: draft.description,
    spec: {
      version: 1,
      nodes: draft.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        input: n.input,
        dependsOn: n.dependsOn,
      })),
      metadata: draft.metadata,
    },
  };

  // Call API to create workflow
  const response = await apiRequest<WorkflowCreateResponse>('/v1/cli/workflow', {
    method: 'POST',
    body: request,
  });

  // Update session state
  session.state = BuilderState.COMMITTED;
  session.commit = {
    workflowId: response.workflowId,
    committedAt: new Date().toISOString(),
  };
  saveSession(session);

  // Clear current pointer
  setCurrent(null);

  return response;
}
