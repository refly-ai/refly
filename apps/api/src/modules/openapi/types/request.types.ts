import { Request } from 'express';
import type {
  ActionStatus,
  WorkflowExecutionStatus,
  WorkflowExecution,
  WorkflowNodeExecution,
  ActionMessageType,
  DriveFileViaApi,
  ActionMessageViaApi,
} from '@refly/openapi-schema';
import {
  WorkflowExecution as WorkflowExecutionPO,
  WorkflowNodeExecution as WorkflowNodeExecutionPO,
  DriveFile as DriveFileModel,
} from '@prisma/client';
import { pick } from '@refly/utils';
import { ActionMessage as ActionMessageModel } from '@prisma/client';
/**
 * Extended user object with uid
 */
export interface AuthenticatedUser {
  uid: string;
  [key: string]: any;
}

/**
 * Extended Express Request with custom properties
 */
export interface OpenAPIRequest extends Request {
  user?: AuthenticatedUser;
  uid?: string; // For API key authenticated requests
}

type WorkflowNodeExecutionWithTime = WorkflowNodeExecution & {
  startTime?: string;
  endTime?: string;
};

export const workflowNodeExecutionPO2DTO = (
  nodeExecution: WorkflowNodeExecutionPO,
): WorkflowNodeExecutionWithTime => {
  return {
    ...pick(nodeExecution, ['nodeId', 'title', 'errorMessage']),
    status: nodeExecution.status as ActionStatus,
    startTime: nodeExecution.startTime ? nodeExecution.startTime.toJSON() : undefined,
    endTime: nodeExecution.endTime ? nodeExecution.endTime.toJSON() : undefined,
  };
};

export const workflowExecutionPO2DTO = (
  execution: WorkflowExecutionPO & { nodeExecutions?: WorkflowNodeExecutionPO[] },
): WorkflowExecution => {
  return {
    ...pick(execution, ['executionId', 'canvasId', 'title']),
    status: execution.status as WorkflowExecutionStatus,
    nodeExecutions: execution.nodeExecutions?.map(workflowNodeExecutionPO2DTO),
    createdAt: execution.createdAt.toJSON(),
  };
};

export function actionMessagePO2DTO(message: ActionMessageModel): ActionMessageViaApi {
  return {
    ...pick(message, ['messageId', 'content', 'reasoningContent']),
    type: message.type as ActionMessageType,
  };
}

/**
 * Transform DriveFile Prisma model to DriveFile DTO
 * @param driveFile - Prisma DriveFile model
 * @param endpoint - Server origin for generating content URL (e.g., 'https://api.example.com')
 */
export function driveFilePO2DTO(driveFile: DriveFileModel, endpoint?: string): DriveFileViaApi {
  return {
    ...pick(driveFile, ['canvasId', 'fileId', 'name', 'type']),
    size: Number(driveFile.size),
    createdAt: driveFile.createdAt.toJSON(),
    url: endpoint ? `${endpoint}/v1/drive/file/content/${driveFile.fileId}` : undefined,
  };
}
