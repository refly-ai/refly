import {
  Canvas as CanvasModel,
  ShareRecord as ShareRecordModel,
  User as UserModel,
  WorkflowApp as WorkflowAppModel,
  WorkflowSchedule as WorkflowScheduleModel,
} from '@prisma/client';
import { Canvas, Entity, EntityType, WorkflowSchedule } from '@refly/openapi-schema';
import { pick } from '../../utils';
import { shareRecordPO2DTO } from '../share/share.dto';
import { safeParseJSON } from '@refly/utils';
import { workflowAppPO2DTO } from '../workflow-app/workflow-app.dto';
import { populateToolsets } from '../tool/tool.dto';

export interface SyncCanvasEntityJobData {
  canvasId: string;
}

export interface DeleteCanvasNodesJobData {
  entities: Entity[];
}

export interface AutoNameCanvasJobData {
  uid: string;
  canvasId: string;
}

export interface DeleteCanvasJobData {
  uid: string;
  canvasId: string;
  deleteAllFiles: boolean;
}

export interface CanvasContentItem {
  id: string;
  title: string;
  type: EntityType;
  content?: string;
  contentPreview?: string;
  inputIds?: string[];
  input?: {
    originalQuery?: string;
    query?: string;
    [key: string]: unknown;
  };
}

export interface CanvasDetailModel extends CanvasModel {
  minimapUrl?: string;
  owner?: Pick<UserModel, 'uid' | 'name' | 'nickname' | 'avatar'>;
  shareRecord?: ShareRecordModel;
  workflowApp?: WorkflowAppModel & {
    owner: Pick<UserModel, 'name' | 'nickname' | 'avatar'> | null;
  };
  schedule?: Omit<WorkflowScheduleModel, 'pk'>;
}

export function schedulePO2DTO(schedule: Omit<WorkflowScheduleModel, 'pk'>): WorkflowSchedule {
  return {
    scheduleId: schedule.scheduleId,
    name: schedule.name,
    cronExpression: schedule.cronExpression,
    scheduleConfig: schedule.scheduleConfig ?? undefined,
    timezone: schedule.timezone ?? undefined,
    isEnabled: schedule.isEnabled,
    nextRunAt: schedule.nextRunAt?.toISOString(),
    lastRunAt: schedule.lastRunAt?.toISOString(),
  };
}

export function canvasPO2DTO(canvas: CanvasDetailModel): Canvas {
  return {
    ...pick(canvas, ['canvasId', 'title', 'minimapUrl', 'minimapStorageKey']),
    createdAt: canvas.createdAt.toJSON(),
    updatedAt: canvas.updatedAt.toJSON(),
    usedToolsets: populateToolsets(safeParseJSON(canvas.usedToolsets)),
    owner: canvas.owner ? pick(canvas.owner, ['uid', 'name', 'nickname', 'avatar']) : undefined,
    shareRecord: canvas.shareRecord ? shareRecordPO2DTO(canvas.shareRecord) : undefined,
    workflowApp: canvas.workflowApp ? workflowAppPO2DTO(canvas.workflowApp) : undefined,
    schedule: canvas.schedule ? schedulePO2DTO(canvas.schedule) : undefined,
  };
}
