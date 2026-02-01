/**
 * Skill Installation Service - manages skill installation lifecycle.
 */

import { Injectable, Logger, forwardRef, Inject, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { SkillPackageService } from './skill-package.service';
import { CanvasService } from '../canvas/canvas.service';
import { WorkflowService } from '../workflow/workflow.service';
import { User, WorkflowVariable } from '@refly/openapi-schema';
import { genSkillPackageInstallationID, safeParseJSON } from '@refly/utils';
import {
  InstallSkillDto,
  InstallationFilterDto,
  RunSkillDto,
  PaginatedResult,
  SkillInstallationResponse,
  SkillExecutionResult,
  WorkflowMappingRecord,
  UpdateInstallationDto,
} from './skill-package.dto';
import { Prisma, SkillInstallation } from '@prisma/client';
import { SkillPackageExecutorService } from './skill-package-executor.service';
import { SKILL_CLI_ERROR_CODES, throwCliError } from './skill-package.errors';

@Injectable()
export class SkillInstallationService {
  private readonly logger = new Logger(SkillInstallationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skillPackageService: SkillPackageService,
    private readonly canvasService: CanvasService,
    @Inject(forwardRef(() => SkillPackageExecutorService))
    private readonly executorService: SkillPackageExecutorService,
    @Inject(forwardRef(() => WorkflowService))
    private readonly workflowService: WorkflowService,
    private readonly redisService: RedisService,
  ) {}

  // ===== Installation Lifecycle =====

  /**
   * Download a skill package - creates installation record without initializing.
   * Uses Redis distributed lock to prevent concurrent downloads of the same skill by the same user.
   */
  async downloadSkill(
    user: User,
    skillId: string,
    shareId?: string,
    force?: boolean,
  ): Promise<SkillInstallationResponse> {
    // Acquire distributed lock to prevent concurrent downloads
    const lockKey = `skill:download:${user.uid}:${skillId}`;
    const releaseLock = await this.redisService.waitLock(lockKey, {
      ttlSeconds: 30,
      maxRetries: 3,
      initialDelay: 100,
      noThrow: true,
    });

    if (!releaseLock) {
      throw new Error(
        `Failed to acquire lock for skill download: skillId=${skillId}, uid=${user.uid}. Another download operation may be in progress. Please retry after a few seconds.`,
      );
    }

    try {
      // Verify skill exists and is accessible
      const skillPackage = await this.skillPackageService.getSkillPackage(skillId, {
        includeWorkflows: true,
        userId: user.uid,
        shareId,
      });

      if (!skillPackage) {
        throw new Error(`Skill package not found or access denied: ${skillId}`);
      }

      // Check if already installed (including soft-deleted)
      const existing = await this.prisma.skillInstallation.findFirst({
        where: {
          skillId,
          uid: user.uid,
        },
      });

      // Initialize workflow mapping with pending status
      const workflowMapping: WorkflowMappingRecord = {};
      if (skillPackage.workflows) {
        for (const workflow of skillPackage.workflows) {
          workflowMapping[workflow.skillWorkflowId] = {
            workflowId: null,
            status: 'pending',
          };
        }
      }

      let installation: SkillInstallation;
      if (existing) {
        if (existing.deletedAt) {
          // Restore soft-deleted installation instead of hard deleting
          // This avoids foreign key constraint issues with skill_executions
          installation = await this.prisma.skillInstallation.update({
            where: { installationId: existing.installationId },
            data: {
              deletedAt: null,
              status: 'downloaded',
              workflowMapping: JSON.stringify(workflowMapping),
              installedVersion: skillPackage.version,
            },
          });
          this.logger.log(`Restored soft-deleted installation: ${existing.installationId}`);
        } else if (force) {
          // Force reinstall: reset the existing installation
          installation = await this.prisma.skillInstallation.update({
            where: { installationId: existing.installationId },
            data: {
              status: 'downloaded',
              workflowMapping: JSON.stringify(workflowMapping),
              installedVersion: skillPackage.version,
              errorMessage: null,
            },
          });
          this.logger.log(`Force reinstalled skill: ${existing.installationId}`);
        } else {
          throwCliError(
            SKILL_CLI_ERROR_CODES.ALREADY_INSTALLED,
            `Skill already installed: ${skillId}`,
            'Use --force to reinstall',
            HttpStatus.CONFLICT,
          );
        }
      } else {
        const installationId = genSkillPackageInstallationID();
        installation = await this.prisma.skillInstallation.create({
          data: {
            installationId,
            skillId,
            uid: user.uid,
            status: 'downloaded',
            workflowMapping: JSON.stringify(workflowMapping),
            installedVersion: skillPackage.version,
          },
        });
      }

      // Increment download count
      await this.prisma.skillPackage.update({
        where: { skillId },
        data: { downloadCount: { increment: 1 } },
      });

      this.logger.log(`Downloaded skill ${skillId} for user ${user.uid}`);
      return this.toInstallationResponse(installation, skillPackage);
    } finally {
      await releaseLock();
    }
  }

  /**
   * Install a skill package - download + initialize as a single operation.
   */
  async installSkill(user: User, input: InstallSkillDto): Promise<SkillInstallationResponse> {
    // Download first (pass force option to allow reinstall)
    const installation = await this.downloadSkill(user, input.skillId, input.shareId, input.force);

    // Then initialize
    return this.initializeSkill(user, installation.installationId);
  }

  /**
   * Initialize an installed skill - clones workflows to user's account.
   * Uses Redis distributed lock to prevent concurrent initialization which could create duplicate workflows.
   */
  async initializeSkill(user: User, installationId: string): Promise<SkillInstallationResponse> {
    // Acquire distributed lock to prevent concurrent initialization
    const lockKey = `skill:init:${installationId}`;
    const releaseLock = await this.redisService.waitLock(lockKey, {
      ttlSeconds: 60,
      maxRetries: 5,
      initialDelay: 200,
      maxLifetimeSeconds: 300,
      noThrow: true,
    });

    if (!releaseLock) {
      throw new Error(
        `Failed to acquire lock for skill initialization: installationId=${installationId}. Another initialization may be in progress. Please retry after a few seconds.`,
      );
    }

    try {
      const installation = await this.getInstallationOrThrow(installationId, user.uid);

      // Fetch skill package early so we can include it in all responses
      const skillPackage = await this.skillPackageService.getSkillPackage(installation.skillId, {
        includeWorkflows: true,
        userId: user.uid,
      });

      // Allow initializing from: downloaded, partial_failed, failed, or initializing (for upgrade flow)
      if (
        !['downloaded', 'partial_failed', 'failed', 'initializing'].includes(installation.status)
      ) {
        if (installation.status === 'ready') {
          return this.toInstallationResponse(installation, skillPackage);
        }
        throw new Error(`Cannot initialize skill in status: ${installation.status}`);
      }

      // Update status to initializing
      await this.prisma.skillInstallation.update({
        where: { installationId },
        data: { status: 'initializing' },
      });

      if (!skillPackage?.workflows) {
        throw new Error('Skill package has no workflows');
      }

      // Get current workflow mapping
      const workflowMapping: WorkflowMappingRecord = installation.workflowMapping
        ? JSON.parse(installation.workflowMapping)
        : {};

      // Get topologically sorted workflows
      const sortedWorkflows = this.topologicalSort(skillPackage.workflows);

      // Clone each workflow (skip already ready ones)
      let failedCount = 0;
      let readyCount = 0;

      for (const workflow of sortedWorkflows) {
        const existing = workflowMapping[workflow.skillWorkflowId];
        if (existing?.status === 'ready') {
          readyCount++;
          continue;
        }

        try {
          // Check if user owns the source workflow
          const sourceCanvas = await this.prisma.canvas.findFirst({
            where: { canvasId: workflow.sourceCanvasId, deletedAt: null },
            select: { uid: true },
          });

          const isOwner = sourceCanvas?.uid === user.uid;
          let generatedWorkflowId: string;

          if (isOwner) {
            // Owner: use source workflow directly, no cloning
            generatedWorkflowId = workflow.sourceCanvasId!;
            this.logger.log(
              `User owns workflow ${workflow.skillWorkflowId}, using source directly: ${generatedWorkflowId}`,
            );
          } else {
            // Not owner: clone the workflow
            generatedWorkflowId = await this.cloneWorkflowCanvas(
              user,
              workflow.sourceCanvasId,
              workflow.name,
            );
          }

          workflowMapping[workflow.skillWorkflowId] = {
            workflowId: generatedWorkflowId,
            status: 'ready',
          };
          readyCount++;

          this.logger.log(
            `Generated workflow ${workflow.skillWorkflowId} -> ${generatedWorkflowId}`,
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          workflowMapping[workflow.skillWorkflowId] = {
            workflowId: null,
            status: 'failed',
            error: errorMessage,
          };
          failedCount++;

          this.logger.error(
            `Failed to clone workflow ${workflow.skillWorkflowId}: ${errorMessage}`,
          );
        }
      }

      // Determine final status
      let finalStatus: string;
      if (failedCount === 0) {
        finalStatus = 'ready';
      } else if (readyCount === 0) {
        finalStatus = 'failed';
      } else {
        finalStatus = 'partial_failed';
      }

      // Update installation
      const updated = await this.prisma.skillInstallation.update({
        where: { installationId },
        data: {
          status: finalStatus,
          workflowMapping: JSON.stringify(workflowMapping),
        },
      });

      this.logger.log(`Initialized skill ${installation.skillId}: ${finalStatus}`);
      return this.toInstallationResponse(updated, skillPackage);
    } finally {
      await releaseLock();
    }
  }

  /**
   * Uninstall a skill - soft delete installation record.
   */
  async uninstallSkill(
    user: User,
    installationId: string,
    options?: { deleteWorkflows?: boolean },
  ): Promise<void> {
    const installation = await this.getInstallationOrThrow(installationId, user.uid);

    if (options?.deleteWorkflows && installation.workflowMapping) {
      const mapping: WorkflowMappingRecord = JSON.parse(installation.workflowMapping);
      for (const [, entry] of Object.entries(mapping)) {
        if (entry.workflowId && entry.status === 'ready') {
          // TODO: Delete cloned workflow via canvasService
          this.logger.log(`Would delete workflow: ${entry.workflowId}`);
        }
      }
    }

    await this.prisma.skillInstallation.update({
      where: { installationId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Uninstalled skill (soft delete): ${installationId}`);
  }

  /**
   * Upgrade an installed skill to the latest version.
   */
  async upgradeSkill(user: User, installationId: string): Promise<SkillInstallationResponse> {
    const installation = await this.getInstallationOrThrow(installationId, user.uid);

    // Fetch latest skill package
    const skillPackage = await this.skillPackageService.getSkillPackage(installation.skillId, {
      includeWorkflows: true,
      userId: user.uid,
    });

    if (!skillPackage) {
      throw new Error(`Skill package not found: ${installation.skillId}`);
    }

    // Store old workflow mapping for potential rollback
    const oldWorkflowMapping = installation.workflowMapping;

    // Reset workflow mapping for re-initialization
    const newWorkflowMapping: WorkflowMappingRecord = {};
    if (skillPackage.workflows) {
      for (const workflow of skillPackage.workflows) {
        newWorkflowMapping[workflow.skillWorkflowId] = {
          workflowId: null,
          status: 'pending',
        };
      }
    }

    // Update to initializing status
    await this.prisma.skillInstallation.update({
      where: { installationId },
      data: {
        status: 'initializing',
        workflowMapping: JSON.stringify(newWorkflowMapping),
      },
    });

    try {
      // Re-initialize
      const result = await this.initializeSkill(user, installationId);

      if (result.status === 'ready') {
        // Success - delete old workflows
        if (oldWorkflowMapping) {
          const oldMapping: WorkflowMappingRecord = JSON.parse(oldWorkflowMapping);
          for (const [, entry] of Object.entries(oldMapping)) {
            if (entry.workflowId && entry.status === 'ready') {
              // TODO: Delete old cloned workflow
              this.logger.log(`Would delete old workflow: ${entry.workflowId}`);
            }
          }
        }

        // Update version info
        await this.prisma.skillInstallation.update({
          where: { installationId },
          data: {
            installedVersion: skillPackage.version,
            hasUpdate: false,
            availableVersion: null,
          },
        });
      }

      return result;
    } catch (error) {
      // Rollback - restore old workflow mapping
      await this.prisma.skillInstallation.update({
        where: { installationId },
        data: {
          status: installation.status,
          workflowMapping: oldWorkflowMapping,
        },
      });
      throw error;
    }
  }

  /**
   * Update an installation's metadata (name, description, triggers, tags, version).
   * Note: skillId and installationId cannot be modified.
   */
  async updateInstallation(
    user: User,
    installationId: string,
    dto: UpdateInstallationDto,
  ): Promise<SkillInstallationResponse> {
    const installation = await this.getInstallationOrThrow(installationId, user.uid);

    // Build update data for skill package - only include defined fields
    const packageUpdateData: Record<string, unknown> = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.triggers !== undefined && { triggers: dto.triggers }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
      ...(dto.version !== undefined && { version: dto.version }),
    };

    // Update skill package if user owns it and there are changes
    if (Object.keys(packageUpdateData).length > 0) {
      // Check ownership before updating
      const skillPackage = await this.prisma.skillPackage.findUnique({
        where: { skillId: installation.skillId },
        select: { uid: true },
      });

      if (skillPackage?.uid === user.uid) {
        await this.prisma.skillPackage.update({
          where: { skillId: installation.skillId },
          data: packageUpdateData,
        });
        this.logger.log(
          `Updated skill package ${installation.skillId} fields: ${Object.keys(packageUpdateData).join(', ')}`,
        );
      }
    }

    // Update installation version if provided
    const updated = dto.version
      ? await this.prisma.skillInstallation.update({
          where: { installationId },
          data: { installedVersion: dto.version },
        })
      : installation;

    // Fetch updated skill package for response
    const updatedSkillPackage = await this.skillPackageService.getSkillPackage(
      installation.skillId,
      {
        includeWorkflows: true,
        userId: user.uid,
      },
    );

    this.logger.log(`Updated installation ${installationId}`);
    return this.toInstallationResponse(updated, updatedSkillPackage);
  }

  // ===== Installation Queries =====

  async getInstallation(installationId: string): Promise<SkillInstallationResponse | null> {
    const installation = await this.prisma.skillInstallation.findFirst({
      where: {
        installationId,
        deletedAt: null,
      },
    });

    return installation ? this.toInstallationResponse(installation) : null;
  }

  async getUserInstallations(
    user: User,
    filter: InstallationFilterDto,
  ): Promise<PaginatedResult<SkillInstallationResponse>> {
    const { page, pageSize } = this.normalizePagination(filter.page, filter.pageSize);
    const skip = (page - 1) * pageSize;

    const where: Prisma.SkillInstallationWhereInput = {
      uid: user.uid,
      deletedAt: null,
    };

    if (filter.status) {
      where.status = filter.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.skillInstallation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          skillPackage: true,
        },
      }),
      this.prisma.skillInstallation.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toInstallationResponse(item, item.skillPackage)),
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  async isSkillInstalled(user: User, skillId: string): Promise<boolean> {
    const count = await this.prisma.skillInstallation.count({
      where: {
        skillId,
        uid: user.uid,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  // ===== Execution =====

  async runInstalledSkill(
    user: User,
    installationId: string,
    input: RunSkillDto,
  ): Promise<SkillExecutionResult> {
    const installation = await this.getInstallationOrThrow(installationId, user.uid);

    if (!['ready', 'partial_failed'].includes(installation.status)) {
      throw new Error(`Cannot run skill in status: ${installation.status}`);
    }

    const workflowMapping: WorkflowMappingRecord = installation.workflowMapping
      ? JSON.parse(installation.workflowMapping)
      : {};

    // Use the executor service to start the skill execution
    const executionId = await this.executorService.startExecution({
      installationId,
      user,
      input: input.input,
    });

    // Fetch the created execution for response
    const execution = await this.prisma.skillExecution.findUnique({
      where: { executionId },
      include: {
        workflowExecutions: {
          orderBy: [{ executionLevel: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    // Map status values: database uses 'success' but DTO expects 'completed'
    const mapStatus = (dbStatus: string): 'pending' | 'running' | 'completed' | 'failed' => {
      if (dbStatus === 'success') return 'completed';
      if (['pending', 'running', 'failed'].includes(dbStatus)) {
        return dbStatus as 'pending' | 'running' | 'failed';
      }
      return 'pending';
    };

    const mapExecutionStatus = (dbStatus: string): 'running' | 'completed' | 'failed' => {
      if (dbStatus === 'success') return 'completed';
      if (dbStatus === 'failed' || dbStatus === 'partial_failed') return 'failed';
      return 'running';
    };

    const workflowExecutions =
      execution?.workflowExecutions.map((wf) => ({
        skillWorkflowId: wf.skillWorkflowId,
        workflowId: wf.workflowId,
        status: mapStatus(wf.status),
      })) ??
      Object.entries(workflowMapping)
        .filter(([, entry]) => entry.status === 'ready')
        .map(([skillWorkflowId, entry]) => ({
          skillWorkflowId,
          workflowId: entry.workflowId!,
          status: 'pending' as const,
        }));

    this.logger.log(`Running skill ${installationId} with ${workflowExecutions.length} workflows`);

    return {
      executionId,
      installationId,
      status: mapExecutionStatus(execution?.status ?? 'running'),
      workflowExecutions,
    };
  }

  /**
   * Stop all running executions for a skill installation.
   * Aborts all running workflows and marks executions as cancelled.
   */
  async stopRunningExecutions(
    user: User,
    installationId: string,
  ): Promise<{
    message: string;
    installationId: string;
    stoppedExecutions: Array<{
      executionId: string;
      workflowsAborted: number;
    }>;
  }> {
    // Verify installation belongs to user
    await this.getInstallationOrThrow(installationId, user.uid);

    // Find all running or pending executions for this installation
    const runningExecutions = await this.prisma.skillExecution.findMany({
      where: {
        installationId,
        uid: user.uid,
        status: { in: ['pending', 'running'] },
      },
      include: {
        workflowExecutions: {
          where: {
            status: { in: ['pending', 'queued', 'running'] },
          },
        },
      },
    });

    if (runningExecutions.length === 0) {
      throw new Error('No running executions for this installation');
    }

    const stoppedExecutions: Array<{
      executionId: string;
      workflowsAborted: number;
    }> = [];

    // Abort each execution
    for (const execution of runningExecutions) {
      let workflowsAborted = 0;

      // Abort each running workflow
      for (const workflowExecution of execution.workflowExecutions) {
        try {
          // Find the workflow execution ID from WorkflowExecution table
          const wfExecution = await this.prisma.workflowExecution.findFirst({
            where: {
              canvasId: workflowExecution.workflowId,
              uid: user.uid,
              status: { in: ['pending', 'executing'] },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (wfExecution) {
            await this.workflowService.abortWorkflow(user, wfExecution.executionId);
            workflowsAborted++;
          }

          // Update skill execution workflow status
          await this.prisma.skillExecutionWorkflow.update({
            where: { executionWorkflowId: workflowExecution.executionWorkflowId },
            data: {
              status: 'failed',
              errorMessage: 'Cancelled by user',
              completedAt: new Date(),
            },
          });
        } catch (error) {
          this.logger.warn(
            `Failed to abort workflow ${workflowExecution.workflowId}: ${(error as Error).message}`,
          );
        }
      }

      // Update skill execution status to cancelled
      await this.prisma.skillExecution.update({
        where: { executionId: execution.executionId },
        data: {
          status: 'cancelled',
          errorMessage: 'Cancelled by user',
          completedAt: new Date(),
        },
      });

      stoppedExecutions.push({
        executionId: execution.executionId,
        workflowsAborted,
      });
    }

    const totalStopped = stoppedExecutions.length;
    this.logger.log(`Stopped ${totalStopped} execution(s) for installation ${installationId}`);

    return {
      message: `Stopped ${totalStopped} execution(s)`,
      installationId,
      stoppedExecutions,
    };
  }

  // ===== Helper Methods =====

  private async getInstallationOrThrow(
    installationId: string,
    uid: string,
  ): Promise<SkillInstallation> {
    const installation = await this.prisma.skillInstallation.findFirst({
      where: {
        installationId,
        uid,
        deletedAt: null,
      },
    });

    if (!installation) {
      throw new Error(`Installation not found or access denied: ${installationId}`);
    }

    return installation;
  }

  private normalizePagination(
    page?: number,
    pageSize?: number,
  ): { page: number; pageSize: number } {
    const parsedPage = Number(page);
    const parsedPageSize = Number(pageSize);

    const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
    const safePageSize =
      Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? Math.floor(parsedPageSize) : 20;

    return { page: safePage, pageSize: Math.min(safePageSize, 100) };
  }

  /**
   * Clone a workflow canvas for the installing user.
   * This duplicates the source canvas so the user has their own copy.
   */
  private async cloneWorkflowCanvas(
    user: User,
    sourceCanvasId: string | null | undefined,
    workflowName: string,
  ): Promise<string> {
    if (!sourceCanvasId) {
      throw new Error(`Workflow "${workflowName}" has no source canvas ID`);
    }

    try {
      // Step 1: Fetch source canvas workflow variables directly (bypassing uid check)
      // This is needed because duplicateCanvas.getWorkflowVariables requires uid match
      const sourceCanvas = await this.prisma.canvas.findFirst({
        where: { canvasId: sourceCanvasId, deletedAt: null },
        select: { workflow: true },
      });

      let sourceVariables: WorkflowVariable[] = [];
      if (sourceCanvas?.workflow) {
        const workflowData = safeParseJSON(sourceCanvas.workflow);
        sourceVariables = workflowData?.variables ?? [];
      }

      // Step 2: Use canvasService.duplicateCanvas to clone the canvas for the user
      // checkOwnership: false allows cloning from another user's canvas (skill author)
      const clonedCanvas = await this.canvasService.duplicateCanvas(
        user,
        {
          canvasId: sourceCanvasId,
          title: workflowName,
          duplicateEntities: true,
        },
        { checkOwnership: false },
      );

      // Step 3: If source has workflow variables, update the cloned canvas
      // Clear resource entity references since they point to source canvas entities
      if (sourceVariables.length > 0) {
        const cleanedVariables = sourceVariables.map((variable) => {
          if (variable.variableType !== 'resource') {
            return variable;
          }
          // Clear resource values - user will provide their own resources
          return {
            ...variable,
            value: [],
          };
        });

        await this.canvasService.updateWorkflowVariables(user, {
          canvasId: clonedCanvas.canvasId,
          variables: cleanedVariables,
          duplicateDriveFile: false,
        });

        this.logger.log(
          `Updated workflow variables for cloned canvas ${clonedCanvas.canvasId} (${cleanedVariables.length} variables)`,
        );
      }

      return clonedCanvas.canvasId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to clone canvas ${sourceCanvasId} for workflow ${workflowName}: ${errorMessage}`,
      );
      throw new Error(`Failed to clone workflow "${workflowName}": ${errorMessage}`);
    }
  }

  /**
   * Topologically sort workflows based on dependencies.
   */
  private topologicalSort(
    workflows: Array<{
      skillWorkflowId: string;
      sourceCanvasId?: string | null;
      name: string;
      description?: string;
      dependencies?: Array<{ dependencyWorkflowId: string }>;
    }>,
  ): typeof workflows {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    const workflowMap = new Map(workflows.map((w) => [w.skillWorkflowId, w]));

    // Initialize
    for (const workflow of workflows) {
      inDegree.set(workflow.skillWorkflowId, 0);
      adjList.set(workflow.skillWorkflowId, []);
    }

    // Build graph
    for (const workflow of workflows) {
      if (workflow.dependencies) {
        for (const dep of workflow.dependencies) {
          const current = inDegree.get(workflow.skillWorkflowId) ?? 0;
          inDegree.set(workflow.skillWorkflowId, current + 1);

          const adj = adjList.get(dep.dependencyWorkflowId) ?? [];
          adj.push(workflow.skillWorkflowId);
          adjList.set(dep.dependencyWorkflowId, adj);
        }
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    const result: typeof workflows = [];

    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const workflow = workflowMap.get(current);
      if (workflow) {
        result.push(workflow);
      }

      const neighbors = adjList.get(current) ?? [];
      for (const neighbor of neighbors) {
        const degree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, degree);
        if (degree === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (result.length !== workflows.length) {
      throw new Error('Circular dependency detected in workflows');
    }

    return result;
  }

  private toInstallationResponse(
    installation: SkillInstallation,
    skillPackage?: any,
  ): SkillInstallationResponse {
    // Extract first workflow ID from workflow mapping if available
    let workflowId: string | undefined;
    if (installation.workflowMapping) {
      const mapping = JSON.parse(installation.workflowMapping) as WorkflowMappingRecord;
      const firstReady = Object.values(mapping).find((m) => m.status === 'ready' && m.workflowId);
      workflowId = firstReady?.workflowId ?? undefined;
    }

    return {
      installationId: installation.installationId,
      skillId: installation.skillId,
      uid: installation.uid,
      status: installation.status,
      workflowMapping: installation.workflowMapping
        ? JSON.parse(installation.workflowMapping)
        : undefined,
      userConfig: installation.userConfig ? JSON.parse(installation.userConfig) : undefined,
      errorMessage: installation.errorMessage ?? undefined,
      installedVersion: installation.installedVersion,
      hasUpdate: installation.hasUpdate,
      availableVersion: installation.availableVersion ?? undefined,
      createdAt: installation.createdAt.toISOString(),
      updatedAt: installation.updatedAt.toISOString(),
      skillPackage: skillPackage
        ? {
            skillId: skillPackage.skillId,
            name: skillPackage.name,
            version: skillPackage.version,
            description: skillPackage.description ?? undefined,
            uid: skillPackage.uid,
            triggers: skillPackage.triggers,
            tags: skillPackage.tags,
            status: skillPackage.status,
            isPublic: skillPackage.isPublic,
            downloadCount: skillPackage.downloadCount,
            createdAt:
              typeof skillPackage.createdAt === 'string'
                ? skillPackage.createdAt
                : skillPackage.createdAt.toISOString(),
            updatedAt:
              typeof skillPackage.updatedAt === 'string'
                ? skillPackage.updatedAt
                : skillPackage.updatedAt.toISOString(),
            workflowId: workflowId || skillPackage.workflows?.[0]?.sourceCanvasId,
            inputSchema:
              typeof skillPackage.inputSchema === 'string'
                ? JSON.parse(skillPackage.inputSchema)
                : skillPackage.inputSchema,
            outputSchema:
              typeof skillPackage.outputSchema === 'string'
                ? JSON.parse(skillPackage.outputSchema)
                : skillPackage.outputSchema,
          }
        : undefined,
    };
  }
}
