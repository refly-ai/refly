import { Request } from 'express';
import mime from 'mime';
import path from 'node:path';
import { AuthenticatedUser } from '../../../types/auth.types';
import type {
  ActionStatus,
  WorkflowExecutionStatus,
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

type WorkflowNodeExecutionStatusViaApi = {
  nodeId: string;
  status: ActionStatus;
  title?: string;
  errorMessage?: string;
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

type WorkflowExecutionStatusViaApi = {
  executionId: string;
  status: WorkflowExecutionStatus;
  createdAt: string;
  nodeExecutions?: WorkflowNodeExecutionStatusViaApi[];
};

const workflowNodeExecutionStatusPO2DTO = (
  nodeExecution: WorkflowNodeExecutionPO,
): WorkflowNodeExecutionStatusViaApi => {
  return {
    nodeId: nodeExecution.nodeId,
    status: nodeExecution.status as ActionStatus,
    title: nodeExecution.title ?? undefined,
    errorMessage: nodeExecution.errorMessage ?? undefined,
  };
};

export const workflowExecutionStatusPO2DTO = (
  execution: WorkflowExecutionPO & { nodeExecutions?: WorkflowNodeExecutionPO[] },
): WorkflowExecutionStatusViaApi => {
  return {
    ...pick(execution, ['executionId']),
    status: execution.status as WorkflowExecutionStatus,
    createdAt: execution.createdAt.toJSON(),
    nodeExecutions: execution.nodeExecutions?.map(workflowNodeExecutionStatusPO2DTO),
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
  const resolvedName = resolveDriveFileName(driveFile);
  return {
    ...pick(driveFile, ['type']),
    name: resolvedName,
    size: Number(driveFile.size),
    url: endpoint
      ? `${endpoint}/v1/drive/file/content/${driveFile.fileId}${
          resolvedName ? `/${encodeURIComponent(resolvedName)}` : ''
        }`
      : undefined,
  };
}

function resolveDriveFileName(driveFile: DriveFileModel): string {
  const rawName = driveFile.name || '';
  if (!rawName) {
    return rawName;
  }
  if (path.extname(rawName)) {
    return rawName;
  }
  const extFromType = driveFile.type ? mime.getExtension(driveFile.type) || '' : '';
  const extFromStorage = driveFile.storageKey ? path.extname(driveFile.storageKey) : '';
  const resolvedExt = extFromType || (extFromStorage ? extFromStorage.slice(1) : '');
  return resolvedExt ? `${rawName}.${resolvedExt}` : rawName;
}
