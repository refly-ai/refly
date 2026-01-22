import type {
  ActionStatus,
  User,
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowNodeExecution,
} from '@refly/openapi-schema';
import {
  WorkflowExecution as WorkflowExecutionPO,
  WorkflowNodeExecution as WorkflowNodeExecutionPO,
} from '@prisma/client';
import { pick } from '@refly/utils';

type JobUser = Pick<User, 'uid'>;

type WorkflowNodeExecutionWithTime = WorkflowNodeExecution & {
  startTime?: string;
  endTime?: string;
};

export interface RunWorkflowJobData {
  user: JobUser;
  executionId: string;
  nodeId: string;
  nodeBehavior?: 'create' | 'update';
}

export interface PollWorkflowJobData {
  user: JobUser;
  executionId: string;
  delayMs?: number;
  nodeBehavior?: 'create' | 'update';
}

const workflowNodeExecutionPO2DTO = (
  nodeExecution: WorkflowNodeExecutionPO,
): WorkflowNodeExecutionWithTime => {
  return {
    ...pick(nodeExecution, [
      'nodeExecutionId',
      'nodeId',
      'nodeType',
      'entityId',
      'title',
      'progress',
      'nodeData',
      'errorMessage',
    ]),
    status: nodeExecution.status as ActionStatus,
    // Use startTime/endTime for execution duration calculation on frontend
    startTime: nodeExecution.startTime ? nodeExecution.startTime.toJSON() : undefined,
    endTime: nodeExecution.endTime ? nodeExecution.endTime.toJSON() : undefined,
    createdAt: nodeExecution.createdAt.toJSON(),
    updatedAt: nodeExecution.updatedAt.toJSON(),
  };
};

export const workflowExecutionPO2DTO = (
  execution: WorkflowExecutionPO & { nodeExecutions?: WorkflowNodeExecutionPO[] },
): WorkflowExecution => {
  return {
    ...pick(execution, ['executionId', 'canvasId', 'title', 'abortedByUser', 'appId']),
    status: execution.status as WorkflowExecutionStatus,
    nodeExecutions: execution.nodeExecutions?.map(workflowNodeExecutionPO2DTO),
    createdAt: execution.createdAt.toJSON(),
    updatedAt: execution.updatedAt.toJSON(),
  };
};
