import { Prisma, User } from '../../generated/client';
import {
  CreateWorkflowAppRequest,
  WorkflowVariable,
  GenericToolset,
  CanvasNode,
  RawCanvasData,
  ListWorkflowAppsData,
} from '@refly/openapi-schema';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CanvasService } from '../canvas/canvas.service';
import { MiscService } from '../misc/misc.service';
import { genCanvasID, genWorkflowAppID, replaceResourceMentionsInQuery } from '@refly/utils';
import { WorkflowService } from '../workflow/workflow.service';
import { Injectable } from '@nestjs/common';
import { ShareCommonService } from '../share/share-common.service';
import { ShareCreationService } from '../share/share-creation.service';
import { ShareNotFoundError, WorkflowAppNotFoundError } from '@refly/errors';
import { ToolService } from '../tool/tool.service';
import { VariableExtractionService } from '../variable-extraction/variable-extraction.service';
import { ResponseNodeMeta } from '@refly/canvas-common';
import { CreditService } from '../credit/credit.service';
import { AppTemplateResult } from '../variable-extraction/variable-extraction.dto';

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
    private readonly variableExtractionService: VariableExtractionService,
    private readonly creditService: CreditService,
  ) {}

  async createWorkflowApp(user: User, body: CreateWorkflowAppRequest) {
    const { canvasId, title, query, variables, description } = body;
    const coverStorageKey = (body as any).coverStorageKey;
    const remixEnabled = (body as any).remixEnabled ?? false;
    const resultNodeIds = (body as any).resultNodeIds ?? [];

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

    const creditUsage = await this.creditService.countCanvasCreditUsage(user, canvasData);

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

    // Generate app template content
    let templateResult: AppTemplateResult | null = null;
    try {
      const _templateResult = await this.variableExtractionService.generateAppPublishTemplate(
        user,
        canvasId,
      );

      this.logger.log(
        `generateAppPublishTemplate result for workflow app: ${JSON.stringify(_templateResult)}`,
      );

      if (
        _templateResult?.templateContent &&
        _templateResult?.templateContentPlaceholders?.length === variables?.length &&
        variables?.every((variable) =>
          _templateResult?.templateContentPlaceholders?.includes(`{{${variable.name}}}`),
        )
      ) {
        templateResult = _templateResult;
      }

      this.logger.log(`Generated template content for workflow app: ${appId}`);
    } catch (error) {
      this.logger.error(
        `Failed to generate template content for workflow app ${appId}: ${error.stack}`,
      );
    }

    if (existingWorkflowApp) {
      await this.prisma.workflowApp.update({
        where: { appId },
        data: {
          title: canvasData.title,
          query,
          variables: JSON.stringify(variables),
          description,
          storageKey,
          coverStorageKey: coverStorageKey as any,
          templateContent: templateResult?.templateContent,
          remixEnabled,
          resultNodeIds,
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
          coverStorageKey: coverStorageKey as any,
          templateContent: null,
          remixEnabled,
          resultNodeIds,
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
        creditUsage,
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

    const userPo = await this.prisma.user.findUnique({
      select: {
        name: true,
        nickname: true,
        avatar: true,
      },
      where: { uid: user.uid },
    });

    return { ...workflowApp, owner: userPo };
  }

  async getWorkflowAppDetail(user: User, appId: string) {
    const workflowApp = await this.prisma.workflowApp.findUnique({
      where: { appId, uid: user.uid, deletedAt: null },
    });

    if (!workflowApp) {
      throw new WorkflowAppNotFoundError();
    }

    const userPo = await this.prisma.user.findUnique({
      select: {
        name: true,
        nickname: true,
        avatar: true,
      },
      where: { uid: user.uid },
    });

    return { ...workflowApp, owner: userPo };
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

    if (!workflowApp) {
      throw new WorkflowAppNotFoundError();
    }

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

    let replaceToolsetMap: Record<string, GenericToolset> = {};

    // Only import toolsets for shared workflow apps that are not owned by the user
    if (shareRecord.uid !== user.uid) {
      const { replaceToolsetMap: newReplaceToolsetMap } =
        await this.toolService.importToolsetsFromNodes(user, nodes);
      replaceToolsetMap = newReplaceToolsetMap;
    }

    // variables with old resource entity ids (need to be replaced)
    const oldVariables = variables || canvasData.variables || [];

    // variables without resource entity ids (to be generated in the new canvas)
    const processedOldVariables = await this.processVariablesForResource(user, oldVariables);

    const tempCanvasId = genCanvasID();

    const finalVariables = await this.canvasService.processResourceVariables(
      user,
      tempCanvasId,
      processedOldVariables,
    );

    // Resource entity id map from old resource entity ids to new resource entity ids
    const entityIdMap = this.buildEntityIdMap(oldVariables, finalVariables);

    const updatedNodes: CanvasNode[] = nodes.map((node) => {
      if (node.type !== 'skillResponse') {
        return node;
      }

      const metadata = node.data.metadata as ResponseNodeMeta;

      // Replace the resource variable with the new entity id
      if (metadata.query) {
        metadata.query = replaceResourceMentionsInQuery(metadata.query, variables, entityIdMap);
      }

      if (metadata.structuredData?.query) {
        (node.data.metadata as ResponseNodeMeta).structuredData.query =
          replaceResourceMentionsInQuery(
            metadata.structuredData.query as string,
            variables,
            entityIdMap,
          );
      }

      // Replace the selected toolsets with the new toolsets
      if (metadata.selectedToolsets) {
        const selectedToolsets = node.data.metadata.selectedToolsets as GenericToolset[];
        node.data.metadata.selectedToolsets = selectedToolsets.map((toolset) => {
          return replaceToolsetMap[toolset.id] || toolset;
        });
      }

      // Replace the context items with the new context items
      if (metadata.contextItems) {
        metadata.contextItems = metadata.contextItems.map((item) => {
          if (item.type !== 'resource') {
            return item;
          }
          const newEntityId = entityIdMap[item.entityId];
          if (newEntityId) {
            return {
              ...item,
              entityId: newEntityId,
            };
          }
          return item;
        });
      }

      return node;
    });

    const sourceCanvasData: RawCanvasData = {
      title: canvasData.title,
      variables: finalVariables,
      nodes: updatedNodes,
      edges,
    };

    const newCanvasId = genCanvasID();

    const executionId = await this.workflowService.initializeWorkflowExecution(
      user,
      newCanvasId,
      finalVariables,
      {
        appId: workflowApp.appId,
        sourceCanvasData,
        createNewCanvas: true,
        nodeBehavior: 'create',
      },
    );

    this.logger.log(`Started workflow execution: ${executionId} for shareId: ${shareId}`);
    return executionId;
  }

  async listWorkflowApps(user: User, query: ListWorkflowAppsData['query']) {
    const { canvasId, page = 1, pageSize = 10, order = 'creationDesc', keyword } = query;

    const whereClause: Prisma.WorkflowAppWhereInput = {
      uid: user.uid,
      deletedAt: null,
    };

    if (canvasId) {
      whereClause.canvasId = canvasId;
    }

    // Add keyword search functionality
    if (keyword?.trim()) {
      const searchKeyword = keyword.trim();
      whereClause.OR = [
        { title: { contains: searchKeyword, mode: 'insensitive' } },
        { description: { contains: searchKeyword, mode: 'insensitive' } },
        { query: { contains: searchKeyword, mode: 'insensitive' } },
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Determine order by field and direction
    let orderBy: any = { updatedAt: 'desc' };
    if (order === 'creationAsc') {
      orderBy = { createdAt: 'asc' };
    } else if (order === 'creationDesc') {
      orderBy = { createdAt: 'desc' };
    }

    const workflowApps = await this.prisma.workflowApp.findMany({
      where: whereClause,
      orderBy,
      skip,
      take,
    });

    const userPo = await this.prisma.user.findUnique({
      select: {
        name: true,
        nickname: true,
        avatar: true,
      },
      where: { uid: user.uid },
    });

    return workflowApps.map((workflowApp) => ({ ...workflowApp, owner: userPo }));
  }

  async deleteWorkflowApp(user: User, appId: string) {
    const workflowApp = await this.prisma.workflowApp.findFirst({
      where: { appId, uid: user.uid, deletedAt: null },
    });

    if (!workflowApp) {
      throw new WorkflowAppNotFoundError();
    }

    // Mark the workflow app as deleted
    await this.prisma.workflowApp.update({
      where: { appId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Deleted workflow app: ${appId} for user: ${user.uid}`);
  }

  /**
   * Process workflow variables to remove entityId field from resource values
   */
  private async processVariablesForResource(
    user: User,
    variables: WorkflowVariable[],
  ): Promise<WorkflowVariable[]> {
    const resourceStorageKeys = variables
      .flatMap((variable) => variable.value.map((val) => val.resource?.storageKey))
      .filter(Boolean);

    const staticFiles = await this.prisma.staticFile.findMany({
      select: {
        storageKey: true,
        entityId: true,
        entityType: true,
      },
      where: {
        storageKey: { in: resourceStorageKeys },
      },
    });

    // If the file is already owned by existing entity, it needs to be duplicated
    const needDuplicateFiles = staticFiles.filter((file) => file.entityId && file.entityType);
    const duplicatedFiles = await Promise.all(
      needDuplicateFiles.map(async (file) => [
        file.storageKey, // source storage key
        (
          await this.miscService.duplicateFile(user, {
            sourceFile: file,
          })
        ).storageKey, // target storage key
      ]),
    );
    const duplicatedFilesMap = new Map<string, string>(
      duplicatedFiles.map((file) => [file[0], file[1]]),
    );

    return variables.map((variable) => ({
      ...variable,
      value: variable.value?.map((val) => {
        if (val.resource) {
          const { name, fileType, storageKey } = val.resource;
          return {
            ...val,
            resource: {
              name,
              fileType,
              storageKey: duplicatedFilesMap.get(storageKey) ?? storageKey,
            },
          };
        }
        return val;
      }),
    }));
  }

  /**
   * Build a map from old resource entityIds to new resource entityIds.
   * Matches resources between old and new variables by variableId and maps their entityIds.
   *
   * @param oldVariables - Variables with original resource entityIds
   * @param newVariables - Variables with newly generated resource entityIds
   * @returns Map from old entityId to new entityId
   */
  private buildEntityIdMap(
    oldVariables: WorkflowVariable[],
    newVariables: WorkflowVariable[],
  ): Record<string, string> {
    const entityIdMap: Record<string, string> = {};

    // Create a map of new variables by variableId for quick lookup
    const newVariablesMap = new Map<string, WorkflowVariable>();
    for (const newVar of newVariables) {
      newVariablesMap.set(newVar.variableId, newVar);
    }

    // For each old variable, find matching new variable by variableId
    for (const oldVar of oldVariables) {
      const newVar = newVariablesMap.get(oldVar.variableId);
      if (!newVar) continue;

      // For each resource value in the old variable
      for (const oldValue of oldVar.value ?? []) {
        if (oldValue.type === 'resource' && oldValue.resource?.entityId) {
          const oldEntityId = oldValue.resource.entityId;

          // Find corresponding new value (assuming same index or first resource value)
          const newValue = newVar.value.find((v) => v.type === 'resource' && v.resource);
          if (newValue?.resource?.entityId) {
            const newEntityId = newValue.resource.entityId;
            entityIdMap[oldEntityId] = newEntityId;
          }
        }
      }
    }

    return entityIdMap;
  }
}
