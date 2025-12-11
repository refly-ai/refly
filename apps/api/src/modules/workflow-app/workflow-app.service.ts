import { Prisma, User } from '@prisma/client';
import {
  CreateWorkflowAppRequest,
  WorkflowVariable,
  GenericToolset,
  CanvasNode,
  RawCanvasData,
  ListWorkflowAppsData,
} from '@refly/openapi-schema';
import { Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
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
import { NotificationService } from '../notification/notification.service';
import { ConfigService } from '@nestjs/config';
import {
  generateWorkflowAppReviewEmailHTML,
  WORKFLOW_APP_REVIEW_EMAIL_TEMPLATE,
} from './email-templates';
import type { GenerateWorkflowAppTemplateJobData } from './workflow-app.dto';
import { QUEUE_WORKFLOW_APP_TEMPLATE } from '../../utils/const';
import type { Queue } from 'bullmq';

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
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
    @Optional()
    @InjectQueue(QUEUE_WORKFLOW_APP_TEMPLATE)
    private readonly templateQueue?: Queue<GenerateWorkflowAppTemplateJobData>,
  ) {}

  /**
   * Build a deterministic fingerprint string for workflow variables.
   * This ignores volatile fields (like entityId) and sorts entries for stability.
   */
  private buildVariablesFingerprint(variables: WorkflowVariable[] | undefined | null): string {
    const safeVars = Array.isArray(variables) ? variables : [];
    const simplified = safeVars
      .map((v) => ({
        name: v?.name ?? '',
        description: v?.description ?? '',
        variableType: v?.variableType ?? '',
        value:
          (Array.isArray(v?.value)
            ? v.value.map((item) => {
                if (item?.type === 'text') {
                  return { type: 'text', text: item?.text ?? '' };
                }
                if (item?.type === 'resource') {
                  return {
                    type: 'resource',
                    resource: {
                      name: item?.resource?.name ?? '',
                      fileType: item?.resource?.fileType ?? '',
                      storageKey: item?.resource?.storageKey ?? '',
                    },
                  };
                }
                return { type: item?.type ?? '' };
              })
            : []) ?? [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return JSON.stringify(simplified);
  }

  /**
   * Build a deterministic fingerprint string for skill response nodes.
   * Only stable fields that affect prompt are included (type, title/data.title, query).
   * Query is included because it's used to extract variable references in filterUsedVariables.
   */
  private buildSkillResponsesFingerprint(nodes: RawCanvasData['nodes'] | undefined | null): string {
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    const responses = safeNodes
      .filter((n) => (n as any)?.type === 'skillResponse')
      .map((n) => {
        const node = n as CanvasNode;
        const type = (node?.type as string) ?? '';
        const title = (node as any)?.title ?? (node?.data as any)?.title ?? '';
        // Query from metadata.structuredData.query (used by filterUsedVariables) or metadata.query
        const query =
          (node?.data as any)?.metadata?.structuredData?.query ??
          (node?.data as any)?.metadata?.query ??
          '';
        return { type, title: title ?? '', query: query ?? '' };
      })
      .sort((a, b) => {
        // Include query in sort key to ensure consistent ordering
        const ka = `${a.title}|${a.type}|${a.query}`;
        const kb = `${b.title}|${b.type}|${b.query}`;
        return ka.localeCompare(kb);
      });
    return JSON.stringify(responses);
  }

  /**
   * Validate if templateContent matches the provided variables.
   * This checks if all variables are present in the template as placeholders.
   * Reference: workflow-app.processor.ts validation logic
   */
  private validateTemplateContentMatchesVariables(
    templateContent: string | null | undefined,
    variables: WorkflowVariable[] | undefined | null,
  ): boolean {
    // If no templateContent, it's invalid (previous generation might have failed)
    if (!templateContent) {
      return false;
    }

    // If no variables, template should have no placeholders
    const safeVars = Array.isArray(variables) ? variables : [];
    if (safeVars.length === 0) {
      // No variables means template should have no placeholders
      const placeholderRegex = /\{\{[^}]+\}\}/g;
      const matches = templateContent.match(placeholderRegex);
      return !matches || matches.length === 0;
    }

    // Extract placeholders from templateContent
    const placeholderRegex = /\{\{[^}]+\}\}/g;
    const placeholders = templateContent.match(placeholderRegex) ?? [];

    // Check if placeholder count matches variable count
    if (placeholders.length !== safeVars.length) {
      return false;
    }

    // Check if every variable has a corresponding placeholder
    return safeVars.every((v) => {
      const varName = v?.name ?? '';
      return placeholders.includes(`{{${varName}}}` as never);
    });
  }

  async createWorkflowApp(user: User, body: CreateWorkflowAppRequest) {
    const { canvasId, title, query, description } = body;
    const coverStorageKey = (body as any).coverStorageKey;
    const remixEnabled = (body as any).remixEnabled ?? false;
    const publishToCommunity = (body as any).publishToCommunity ?? false;
    const resultNodeIds = (body as any).resultNodeIds ?? [];

    const existingWorkflowApp = await this.prisma.workflowApp.findFirst({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });

    const appId = existingWorkflowApp?.appId ?? genWorkflowAppID();

    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });

    if (!canvas) {
      throw new Error('canvas not found');
    }

    // Get workflow variables from Canvas service
    const variables = await this.canvasService.getWorkflowVariables(user, {
      canvasId,
    });
    const canvasData = await this.canvasService.getCanvasRawData(user, canvasId);

    // Calculate raw credit usage from canvas
    const rawCreditUsage = await this.creditService.countCanvasCreditUsage(user, canvasData);

    // Apply markup coefficient to get final credit usage (same as what's saved in JSON)
    const creditUsage = Math.ceil(
      rawCreditUsage * this.configService.get('credit.executionCreditMarkup'),
    );

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
    let isTemplateContentValid = false;

    // Decide whether to enqueue template generation (stable mode comparison)
    try {
      let shouldSkipGeneration = false;
      if (existingWorkflowApp) {
        // Previous variables fingerprint
        const prevVariables: WorkflowVariable[] = (() => {
          try {
            return existingWorkflowApp?.variables
              ? (JSON.parse(existingWorkflowApp.variables) as WorkflowVariable[])
              : [];
          } catch {
            return [];
          }
        })();
        const prevVarsFp = this.buildVariablesFingerprint(prevVariables);
        const curVarsFp = this.buildVariablesFingerprint(variables);

        // Previous canvas data (from stored public JSON)
        let prevTitle = existingWorkflowApp?.title ?? '';
        const prevDescription = existingWorkflowApp?.description ?? null;
        let prevSkillResponsesFp = '';
        try {
          const prevStorageKey = (existingWorkflowApp as any)?.storageKey as string | undefined;
          if (prevStorageKey) {
            const prevBuf = await this.miscService.downloadFile({
              storageKey: prevStorageKey,
              visibility: 'public',
            });
            if (prevBuf) {
              const prevCanvasJson = JSON.parse(prevBuf.toString('utf8')) as RawCanvasData;
              prevTitle = (prevCanvasJson as any)?.title ?? prevTitle ?? '';
              // Description comes from DB, not canvas JSON
              prevSkillResponsesFp = this.buildSkillResponsesFingerprint(prevCanvasJson?.nodes);
            }
          }
        } catch (error) {
          // If previous canvas cannot be loaded, fall back to DB fields only
          // Log error but don't fail - we'll compare with empty fingerprint which will trigger regeneration
          this.logger.warn(
            `Failed to load previous canvas data for comparison (appId=${appId}): ${error?.message}`,
          );
          prevSkillResponsesFp = '';
        }

        // Current canvas stable fields
        const curTitle = canvasData?.title ?? '';
        const curDescription = description ?? null;
        const curSkillResponsesFp = this.buildSkillResponsesFingerprint(canvasData?.nodes);

        // Validate previous templateContent matches current variables
        // This handles cases where previous async generation failed or variables changed
        const prevTemplateContent = (existingWorkflowApp as any)?.templateContent as
          | string
          | null
          | undefined;
        isTemplateContentValid = this.validateTemplateContentMatchesVariables(
          prevTemplateContent,
          variables,
        );

        // Stable mode comparison:
        // - canvas title (from canvas JSON)
        // - description (from request body, stored in DB)
        // - skillResponses fingerprint (type/title)
        // - variables fingerprint (name/type/description/values)
        // - templateContent validation (ensures previous template matches current variables)
        shouldSkipGeneration =
          prevTitle === curTitle &&
          prevDescription === curDescription &&
          prevSkillResponsesFp === curSkillResponsesFp &&
          prevVarsFp === curVarsFp &&
          isTemplateContentValid;
      }

      if (shouldSkipGeneration) {
        this.logger.log(
          `Skip template generation for workflow app ${appId}: stable prompt dependencies unchanged`,
        );
      } else if (this.templateQueue) {
        await this.templateQueue.add(
          'generate',
          { appId, canvasId, uid: user.uid },
          {
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
        this.logger.log(`Enqueued template generation for workflow app: ${appId}`);
      } else {
        // Always async: do not perform sync generation even if queue is unavailable
        this.logger.log(
          `Skip sync template generation for workflow app ${appId}: queue unavailable, enforce async-only`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to start template generation for workflow app ${appId}: ${error?.stack}`,
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
          remixEnabled,
          publishToCommunity,
          publishReviewStatus: publishToCommunity ? 'reviewing' : 'init',
          resultNodeIds,
          creditUsage,
          updatedAt: new Date(),
          ...{ ...(isTemplateContentValid ? {} : { templateContent: null }) },
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
          remixEnabled,
          publishToCommunity,
          publishReviewStatus: publishToCommunity ? 'reviewing' : 'init',
          resultNodeIds,
          creditUsage,
        },
      });
    }

    // Create share for workflow app
    let shareId: string | null = null;
    let templateShareId: string | null = null;
    try {
      const { shareRecord, templateShareRecord } =
        await this.shareCreationService.createShareForWorkflowApp(user, {
          entityId: appId,
          entityType: 'workflowApp',
          title: canvasData.title,
          parentShareId: null,
          allowDuplication: true,
          creditUsage,
        });

      shareId = shareRecord.shareId;
      templateShareId = templateShareRecord?.shareId ?? null;

      // Update WorkflowApp record with shareId and templateShareId
      await this.prisma.workflowApp.update({
        where: { appId },
        data: {
          shareId: shareRecord.shareId,
          templateShareId,
        },
      });

      this.logger.log(`Created share for workflow app: ${appId}, shareId: ${shareRecord.shareId}`);
      if (templateShareId) {
        this.logger.log(
          `Created template share for workflow app: ${appId}, templateShareId: ${templateShareId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to create share for workflow app ${appId}: ${error.stack}`);
      // Don't throw error, just log it - workflow app creation should still succeed
    }

    // Send email notification if template is submitted for review
    if (publishToCommunity && shareId) {
      try {
        const origin = this.configService.get<string>('origin')?.split(',')[0] || '';
        const templateLink = `${origin}/app/${shareId}`;
        const templateName = canvasData.title || 'Untitled Template';
        const emailHTML = generateWorkflowAppReviewEmailHTML(templateName, templateLink);
        const subject = WORKFLOW_APP_REVIEW_EMAIL_TEMPLATE.subject.replace(
          '{{template_name}}',
          templateName,
        );

        await this.notificationService.sendEmail(
          {
            subject,
            html: emailHTML,
          },
          user,
        );

        this.logger.log(
          `Sent review notification email for workflow app: ${appId} to user: ${user.uid}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send review notification email for workflow app ${appId}: ${error.stack}`,
        );
        // Don't throw error, just log it - workflow app creation should still succeed
      }
    }

    const workflowApp = await this.prisma.workflowApp.findFirst({
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
    const workflowApp = await this.prisma.workflowApp.findFirst({
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

    // Try to locate workflow app by shareId first
    let workflowApp = await this.prisma.workflowApp.findFirst({
      where: { shareId, deletedAt: null },
    });

    // Fallback 1: for historical records that did not persist shareId in workflowApp
    if (!workflowApp && shareRecord?.entityId) {
      this.logger.warn(
        `Workflow app not found by shareId=${shareId}. Fallback to appId=${shareRecord.entityId}`,
      );
      workflowApp = await this.prisma.workflowApp.findFirst({
        where: { appId: shareRecord.entityId, deletedAt: null },
      });
    }

    // Fallback 2: when client passes template share id
    if (!workflowApp) {
      this.logger.warn(
        `Workflow app not found by shareId/appId. Fallback to templateShareId=${shareId}`,
      );
      workflowApp = await this.prisma.workflowApp.findFirst({
        where: { templateShareId: shareId, deletedAt: null },
      });
    }

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

    const tempCanvasId = genCanvasID();

    const finalVariables = await this.canvasService.processResourceVariables(
      user,
      tempCanvasId,
      oldVariables,
      true,
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
        metadata.query = replaceResourceMentionsInQuery(
          metadata.query,
          finalVariables,
          entityIdMap,
        );
      }

      if (metadata.structuredData?.query) {
        (node.data.metadata as ResponseNodeMeta).structuredData.query =
          replaceResourceMentionsInQuery(
            metadata.structuredData.query as string,
            finalVariables,
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
