import { User } from '../../generated/client';
import {
  CreateWorkflowAppRequest,
  WorkflowVariable,
  GenericToolset,
  CanvasNode,
  RawCanvasData,
} from '@refly/openapi-schema';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CanvasService } from '../canvas/canvas.service';
import { MiscService } from '../misc/misc.service';
import { genCanvasID, genWorkflowAppID } from '@refly/utils';
import { WorkflowService } from '../workflow/workflow.service';
import { workflowAppPO2DTO } from './workflow-app.dto';
import { Injectable } from '@nestjs/common';
import { ShareCommonService } from '../share/share-common.service';
import { ShareCreationService } from '../share/share-creation.service';
import { ShareNotFoundError } from '@refly/errors';
import { ToolService } from '../tool/tool.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { initEmptyCanvasState } from '@refly/canvas-common';

/**
 * Structure of shared workflow app data
 */
interface SharedWorkflowAppData {
  appId: string;
  title: string;
  description?: string;
  query?: string;
  variables: WorkflowVariable[];
  canvasData: RawCanvasData;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class WorkflowAppService {
  private logger = new Logger(WorkflowAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly canvasService: CanvasService,
    private readonly miscService: MiscService,
    private readonly workflowService: WorkflowService,
    private readonly shareCommonService: ShareCommonService,
    private readonly shareCreationService: ShareCreationService,
    private readonly toolService: ToolService,
    private readonly canvasSyncService: CanvasSyncService,
  ) {}

  async createWorkflowApp(user: User, body: CreateWorkflowAppRequest) {
    const { canvasId, title, query, variables, description } = body;

    const existingWorkflowApp = await this.prisma.workflowApp.findFirst({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });

    const appId = existingWorkflowApp?.appId ?? genWorkflowAppID();

    const canvas = await this.prisma.canvas.findUnique({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });

    if (!canvas) {
      throw new Error('canvas not found');
    }

    const canvasData = await this.canvasService.getCanvasRawData(user, canvasId);

    if (title) {
      canvasData.title = title;
    }

    // Publish minimap
    if (canvas.minimapStorageKey) {
      const minimapUrl = await this.miscService.publishFile(canvas.minimapStorageKey);
      canvasData.minimapUrl = minimapUrl;
    }

    // Upload public canvas data to Minio
    const { storageKey } = await this.miscService.uploadBuffer(user, {
      fpath: 'canvas.json',
      buf: Buffer.from(JSON.stringify(canvasData)),
      entityId: canvasId,
      entityType: 'canvas',
      visibility: 'public',
    });

    if (existingWorkflowApp) {
      await this.prisma.workflowApp.update({
        where: { appId },
        data: {
          title: canvasData.title,
          query,
          variables: JSON.stringify(variables),
          description,
          storageKey,
          updatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.workflowApp.create({
        data: {
          appId,
          title: canvasData.title,
          uid: user.uid,
          query,
          variables: JSON.stringify(variables),
          description,
          canvasId,
          storageKey,
        },
      });
    }

    // Create share for workflow app
    try {
      const { shareRecord } = await this.shareCreationService.createShareForWorkflowApp(user, {
        entityId: appId,
        entityType: 'workflowApp',
        title: canvasData.title,
        parentShareId: null,
        allowDuplication: true,
      });

      // Update WorkflowApp record with shareId
      await this.prisma.workflowApp.update({
        where: { appId },
        data: {
          shareId: shareRecord.shareId,
        },
      });

      this.logger.log(`Created share for workflow app: ${appId}, shareId: ${shareRecord.shareId}`);
    } catch (error) {
      this.logger.error(`Failed to create share for workflow app ${appId}: ${error.stack}`);
      // Don't throw error, just log it - workflow app creation should still succeed
    }

    const workflowApp = await this.prisma.workflowApp.findUnique({
      where: { appId, uid: user.uid, deletedAt: null },
    });

    return workflowAppPO2DTO(workflowApp);
  }

  async getWorkflowAppDetail(user: User, appId: string) {
    const workflowApp = await this.prisma.workflowApp.findUnique({
      where: { appId, uid: user.uid, deletedAt: null },
    });

    if (!workflowApp) {
      throw new ShareNotFoundError();
    }

    return workflowAppPO2DTO(workflowApp);
  }

  async executeWorkflowApp(user: User, shareId: string, variables: WorkflowVariable[]) {
    const shareRecord = await this.prisma.shareRecord.findFirst({
      where: { shareId, deletedAt: null },
    });

    if (!shareRecord) {
      throw new ShareNotFoundError('Share record not found');
    }

    const workflowApp = await this.prisma.workflowApp.findFirst({
      where: { shareId, deletedAt: null },
    });

    this.logger.log(`Executing workflow app via shareId: ${shareId} for user: ${user.uid}`);

    const shareDataRaw = await this.shareCommonService.getSharedData(shareRecord.storageKey);
    if (!shareDataRaw) {
      throw new ShareNotFoundError('Workflow app data not found');
    }

    let canvasData: RawCanvasData;

    if (shareDataRaw.canvasData) {
      const shareData = shareDataRaw as SharedWorkflowAppData;
      canvasData = shareData.canvasData;
    } else if (shareDataRaw.nodes && shareDataRaw.edges) {
      canvasData = shareDataRaw as RawCanvasData;
    } else {
      throw new ShareNotFoundError('Canvas data not found in workflow app storage');
    }

    const { nodes = [], edges = [] } = canvasData;

    const { replaceToolsetMap } = await this.toolService.importToolsetsFromNodes(user, nodes);

    const updatedNodes: CanvasNode[] = nodes.map((node) => {
      if (node.type === 'skillResponse' && node.data?.metadata?.selectedToolsets) {
        const selectedToolsets = node.data.metadata.selectedToolsets as GenericToolset[];
        node.data.metadata.selectedToolsets = selectedToolsets.map((toolset) => {
          return replaceToolsetMap[toolset.id] || toolset;
        });
      }
      return node;
    });

    const executionCanvasId = genCanvasID();
    const state = initEmptyCanvasState();

    await this.canvasService.createCanvasWithState(
      user,
      {
        canvasId: executionCanvasId,
        title: `${canvasData.title} (Execution)`,
        variables: variables || canvasData.variables || [],
        visibility: false,
      },
      state,
    );

    state.nodes = updatedNodes;
    state.edges = edges;
    await this.canvasSyncService.saveState(executionCanvasId, state);

    try {
      const executionId = await this.workflowService.initializeWorkflowExecution(
        user,
        executionCanvasId,
        executionCanvasId, // Use the same canvas ID to avoid creating a second canvas
        variables,
        { appId: workflowApp?.appId },
      );

      this.logger.log(`Started workflow execution: ${executionId} for shareId: ${shareId}`);
      return executionId;
    } finally {
    }
  }

  async listWorkflowApps(user: User, query: { canvasId: string }) {
    const whereClause: any = {
      uid: user.uid,
      deletedAt: null,
    };

    if (query.canvasId) {
      whereClause.canvasId = query.canvasId;
    }

    const workflowApps = await this.prisma.workflowApp.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
      take: 1, // Only get the latest one
    });

    return workflowApps.map(workflowAppPO2DTO).filter(Boolean);
  }
}
