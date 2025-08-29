import type { User } from '@refly/openapi-schema';

type JobUser = Pick<User, 'uid'>;

export interface SyncWorkflowJobData {
  user: Pick<User, 'uid'>;
  nodeExecutionId: string;
}

export interface RunWorkflowJobData {
  user: JobUser;
  executionId: string;
  nodeId: string;
  newNodeId?: string; // New node ID for new canvas mode
}

export interface InitializeWorkflowResponse {
  executionId: string;
  success: boolean;
}
