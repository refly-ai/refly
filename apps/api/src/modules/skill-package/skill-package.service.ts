/**
 * Skill Package Service - manages skill package CRUD and workflow operations.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { User } from '@refly/openapi-schema';
import { genSkillPackageID, genSkillPackageWorkflowID, genInviteCode } from '@refly/utils';
import {
  CreateSkillPackageDto,
  CreateSkillPackageCliDto,
  CreateSkillPackageCliResponse,
  UpdateSkillPackageDto,
  SkillPackageFilterDto,
  SearchSkillsDto,
  AddWorkflowDto,
  WorkflowDependencyDto,
  PaginatedResult,
  SkillPackageResponse,
  SkillWorkflowResponse,
} from './skill-package.dto';
import { SkillPackage, SkillWorkflow, Prisma } from '@prisma/client';
import { CopilotAutogenService } from '../copilot-autogen/copilot-autogen.service';
import { WorkflowCliService } from '../workflow/workflow-cli.service';
import { CreateWorkflowRequest } from '../workflow/workflow-cli.dto';

@Injectable()
export class SkillPackageService {
  private readonly logger = new Logger(SkillPackageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly copilotAutogenService: CopilotAutogenService,
    private readonly workflowCliService: WorkflowCliService,
  ) {}

  // ===== Package CRUD =====

  async createSkillPackage(
    user: User,
    input: CreateSkillPackageDto,
  ): Promise<SkillPackageResponse> {
    const skillId = genSkillPackageID();

    const skillPackage = await this.prisma.skillPackage.create({
      data: {
        skillId,
        name: input.name,
        version: input.version,
        description: input.description,
        uid: user.uid,
        icon: input.icon ? JSON.stringify(input.icon) : null,
        triggers: input.triggers ?? [],
        tags: input.tags ?? [],
        inputSchema: input.inputSchema ? JSON.stringify(input.inputSchema) : null,
        outputSchema: input.outputSchema ? JSON.stringify(input.outputSchema) : null,
        status: 'draft',
        isPublic: false,
      },
    });

    this.logger.log(`Created skill package: ${skillId} by user ${user.uid}`);
    return this.toSkillPackageResponse(skillPackage);
  }

  async createSkillPackageWithWorkflow(
    user: User,
    input: CreateSkillPackageCliDto,
  ): Promise<CreateSkillPackageCliResponse> {
    const normalizedWorkflowIds = this.normalizeWorkflowIds(input.workflowId, input.workflowIds);
    const createdWorkflowIds: string[] = [];
    const workflowBindings: Array<{
      workflowId: string;
      name: string;
      description?: string;
    }> = [];

    try {
      if (!input.noWorkflow) {
        if (input.workflowSpec) {
          const workflowName = input.workflowName || `${input.name} workflow`;
          const workflowRequest: CreateWorkflowRequest = {
            name: workflowName,
            description: input.workflowDescription,
            variables: (input.workflowVariables as any) || undefined,
            spec: input.workflowSpec as any,
          };
          const created = await this.workflowCliService.createWorkflowFromSpec(
            user,
            workflowRequest,
          );
          createdWorkflowIds.push(created.workflowId);
          workflowBindings.push({
            workflowId: created.workflowId,
            name: created.name || workflowName,
            description: input.workflowDescription,
          });
        }

        const shouldGenerate =
          !input.workflowSpec && (input.workflowQuery || normalizedWorkflowIds.length === 0);

        if (shouldGenerate) {
          const query = input.workflowQuery || this.buildWorkflowQueryFromSkill(input);
          const generated = await this.copilotAutogenService.generateWorkflowForCli(user, {
            query,
            variables: (input.workflowVariables as any) || undefined,
          });
          createdWorkflowIds.push(generated.canvasId);
          workflowBindings.push({
            workflowId: generated.canvasId,
            name: generated.workflowPlan?.title || input.workflowName || `${input.name} workflow`,
            description: input.workflowDescription,
          });
        }

        if (normalizedWorkflowIds.length > 0) {
          const existingSummaries = await this.loadWorkflowSummaries(user, normalizedWorkflowIds);
          for (const workflowId of normalizedWorkflowIds) {
            const summary = existingSummaries.get(workflowId);
            workflowBindings.push({
              workflowId,
              name: summary?.name || input.workflowName || `${input.name} workflow`,
              description: input.workflowDescription,
            });
          }
        }

        if (workflowBindings.length === 0) {
          throw new Error('No workflow could be generated or attached');
        }

        await this.assertWorkflowsExist(
          user,
          workflowBindings.map((w) => w.workflowId),
        );
      }

      const skillId = genSkillPackageID();

      const result = await this.prisma.$transaction(async (tx) => {
        const skillPackage = await tx.skillPackage.create({
          data: {
            skillId,
            name: input.name,
            version: input.version,
            description: input.description,
            uid: user.uid,
            icon: input.icon ? JSON.stringify(input.icon) : null,
            triggers: input.triggers ?? [],
            tags: input.tags ?? [],
            inputSchema: input.inputSchema ? JSON.stringify(input.inputSchema) : null,
            outputSchema: input.outputSchema ? JSON.stringify(input.outputSchema) : null,
            status: 'draft',
            isPublic: false,
          },
        });

        if (!input.noWorkflow) {
          for (const workflow of workflowBindings) {
            await tx.skillWorkflow.create({
              data: {
                skillWorkflowId: genSkillPackageWorkflowID(),
                skillId,
                name: workflow.name,
                description: workflow.description,
                canvasStorageKey: `canvas/${workflow.workflowId}`,
                sourceCanvasId: workflow.workflowId,
                isEntry: true,
              },
            });
          }
        }

        return skillPackage;
      });

      this.logger.log(`Created skill package: ${skillId} by user ${user.uid}`);

      const workflowIds = workflowBindings.map((w) => w.workflowId);
      return {
        skillId: result.skillId,
        name: result.name,
        status: result.status,
        createdAt: result.createdAt.toJSON(),
        workflowId: workflowIds[0],
        workflowIds,
        workflows: workflowBindings.length > 0 ? workflowBindings : undefined,
      };
    } catch (error) {
      // Compensation: Clean up orphan workflows created during failed skill creation
      if (createdWorkflowIds.length > 0) {
        this.logger.warn(
          `Cleaning up orphan workflows from failed skill creation: ${createdWorkflowIds.join(', ')}`,
        );
        await this.cleanupOrphanWorkflows(user, createdWorkflowIds);
      }
      throw error;
    }
  }

  /**
   * Clean up orphan workflows that were created during a failed skill package creation.
   * Uses soft delete (setting deletedAt) to preserve audit trail.
   */
  private async cleanupOrphanWorkflows(user: User, canvasIds: string[]): Promise<void> {
    for (const canvasId of canvasIds) {
      try {
        // Soft delete the canvas (workflow) by setting deletedAt
        await this.prisma.canvas.updateMany({
          where: {
            canvasId,
            uid: user.uid,
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
          },
        });
        this.logger.log(`Cleaned up orphan workflow: ${canvasId}`);
      } catch (cleanupError) {
        // Log but don't throw - cleanup is best-effort
        this.logger.error(
          `Failed to clean up orphan workflow ${canvasId}: ${(cleanupError as Error).message}`,
        );
      }
    }
  }

  async updateSkillPackage(
    user: User,
    skillId: string,
    input: UpdateSkillPackageDto,
  ): Promise<SkillPackageResponse> {
    // Verify access before updating
    await this.getSkillPackageOrThrow(skillId, user.uid);

    const updateData: Prisma.SkillPackageUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.version !== undefined) updateData.version = input.version;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.icon !== undefined) updateData.icon = JSON.stringify(input.icon);
    if (input.triggers !== undefined) updateData.triggers = input.triggers;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.inputSchema !== undefined) updateData.inputSchema = JSON.stringify(input.inputSchema);
    if (input.outputSchema !== undefined)
      updateData.outputSchema = JSON.stringify(input.outputSchema);
    if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;

    const updated = await this.prisma.skillPackage.update({
      where: { skillId },
      data: updateData,
    });

    this.logger.log(`Updated skill package: ${skillId}`);
    return this.toSkillPackageResponse(updated);
  }

  async deleteSkillPackage(user: User, skillId: string): Promise<void> {
    await this.getSkillPackageOrThrow(skillId, user.uid);

    await this.prisma.skillPackage.update({
      where: { skillId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Soft-deleted skill package: ${skillId}`);
  }

  async getSkillPackage(
    skillId: string,
    options?: { includeWorkflows?: boolean; userId?: string; shareId?: string },
  ): Promise<SkillPackageResponse | null> {
    const skillPackage = await this.prisma.skillPackage.findFirst({
      where: {
        skillId,
        deletedAt: null,
      },
      include: options?.includeWorkflows
        ? {
            workflows: {
              where: { deletedAt: null },
              include: {
                dependencies: true,
              },
            },
          }
        : undefined,
    });

    if (!skillPackage) {
      return null;
    }

    // Access control check
    const hasAccess = await this.checkAccess(skillPackage, options?.userId, options?.shareId);
    if (!hasAccess) {
      return null;
    }

    return this.toSkillPackageResponse(
      skillPackage,
      options?.includeWorkflows ? (skillPackage as any).workflows : undefined,
    );
  }

  async listSkillPackages(
    user: User,
    filter: SkillPackageFilterDto,
  ): Promise<PaginatedResult<SkillPackageResponse>> {
    const { page, pageSize } = this.normalizePagination(filter.page, filter.pageSize);
    const skip = (page - 1) * pageSize;

    const where: Prisma.SkillPackageWhereInput = {
      deletedAt: null,
    };

    if (filter.mine) {
      where.uid = user.uid;
    } else {
      // Show user's own packages + public packages
      where.OR = [{ uid: user.uid }, { isPublic: true, status: 'published' }];
    }

    if (filter.status) {
      where.status = filter.status;
    }

    const normalizedTags = this.normalizeTags(filter.tags);
    if (normalizedTags.length > 0) {
      where.tags = { hasSome: normalizedTags };
    }

    const [items, total] = await Promise.all([
      this.prisma.skillPackage.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.skillPackage.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toSkillPackageResponse(item)),
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  // ===== Workflow Management =====

  async addWorkflowToSkill(
    user: User,
    skillId: string,
    input: AddWorkflowDto,
  ): Promise<SkillWorkflowResponse> {
    await this.getSkillPackageOrThrow(skillId, user.uid);
    await this.assertWorkflowExists(user, input.canvasId);

    const skillWorkflowId = genSkillPackageWorkflowID();

    // TODO: Snapshot canvas data to S3
    // For now, use canvas ID as storage key placeholder
    const canvasStorageKey = `canvas/${input.canvasId}`;

    const workflow = await this.prisma.skillWorkflow.create({
      data: {
        skillWorkflowId,
        skillId,
        name: input.name,
        description: input.description,
        canvasStorageKey,
        sourceCanvasId: input.canvasId,
        inputSchema: input.inputSchema ? JSON.stringify(input.inputSchema) : null,
        outputSchema: input.outputSchema ? JSON.stringify(input.outputSchema) : null,
        isEntry: input.isEntry ?? false,
      },
    });

    this.logger.log(`Added workflow ${skillWorkflowId} to skill ${skillId}`);
    return this.toSkillWorkflowResponse(workflow);
  }

  async updateWorkflowDependencies(
    user: User,
    skillWorkflowId: string,
    dependencies: WorkflowDependencyDto[],
  ): Promise<void> {
    const workflow = await this.prisma.skillWorkflow.findUnique({
      where: { skillWorkflowId },
      include: { skillPackage: true },
    });

    if (!workflow || workflow.deletedAt) {
      throw new Error(`Workflow not found: ${skillWorkflowId}`);
    }

    if (workflow.skillPackage.uid !== user.uid) {
      throw new Error('Access denied');
    }

    // Delete existing dependencies
    await this.prisma.skillWorkflowDependency.deleteMany({
      where: { dependentWorkflowId: skillWorkflowId },
    });

    // Create new dependencies
    if (dependencies.length > 0) {
      await this.prisma.skillWorkflowDependency.createMany({
        data: dependencies.map((dep) => ({
          dependentWorkflowId: skillWorkflowId,
          dependencyWorkflowId: dep.dependencyWorkflowId,
          dependencyType: dep.dependencyType,
          condition: dep.condition,
          inputMapping: dep.inputMapping ? JSON.stringify(dep.inputMapping) : null,
          outputSelector: dep.outputSelector ? JSON.stringify(dep.outputSelector) : null,
          mergeStrategy: dep.mergeStrategy,
          customMerge: dep.customMerge,
        })),
      });
    }

    // Update isEntry flag - workflows with no dependencies are entry points
    await this.prisma.skillWorkflow.update({
      where: { skillWorkflowId },
      data: { isEntry: dependencies.length === 0 },
    });

    this.logger.log(`Updated dependencies for workflow ${skillWorkflowId}`);
  }

  async removeWorkflowFromSkill(user: User, skillWorkflowId: string): Promise<void> {
    const workflow = await this.prisma.skillWorkflow.findUnique({
      where: { skillWorkflowId },
      include: { skillPackage: true },
    });

    if (!workflow || workflow.deletedAt) {
      throw new Error(`Workflow not found: ${skillWorkflowId}`);
    }

    if (workflow.skillPackage.uid !== user.uid) {
      throw new Error('Access denied');
    }

    await this.prisma.skillWorkflow.update({
      where: { skillWorkflowId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Removed workflow ${skillWorkflowId}`);
  }

  // ===== Publishing =====

  async publishSkillPackage(user: User, skillId: string): Promise<SkillPackageResponse> {
    const existing = await this.getSkillPackageOrThrow(skillId, user.uid);

    // Generate share ID only if not exists (preserve existing share links)
    const shareId = existing.shareId || genInviteCode();

    const updated = await this.prisma.skillPackage.update({
      where: { skillId },
      data: {
        status: 'published',
        isPublic: true,
        shareId,
      },
    });

    this.logger.log(`Published skill package: ${skillId}`);
    return this.toSkillPackageResponse(updated);
  }

  async unpublishSkillPackage(user: User, skillId: string): Promise<void> {
    await this.getSkillPackageOrThrow(skillId, user.uid);

    await this.prisma.skillPackage.update({
      where: { skillId },
      data: {
        status: 'draft',
        isPublic: false,
      },
    });

    this.logger.log(`Unpublished skill package: ${skillId}`);
  }

  // ===== Discovery =====

  async searchPublicSkills(query: SearchSkillsDto): Promise<PaginatedResult<SkillPackageResponse>> {
    const { page, pageSize } = this.normalizePagination(query.page, query.pageSize);
    const skip = (page - 1) * pageSize;
    const searchText = typeof query.query === 'string' ? query.query.trim() : '';

    const where: Prisma.SkillPackageWhereInput = {
      isPublic: true,
      status: 'published',
      deletedAt: null,
    };

    if (searchText) {
      where.OR = [
        { name: { contains: searchText, mode: 'insensitive' } },
        { description: { contains: searchText, mode: 'insensitive' } },
        { triggers: { hasSome: [searchText] } },
      ];
    }

    const normalizedTags = this.normalizeTags(query.tags);
    if (normalizedTags.length > 0) {
      where.tags = { hasSome: normalizedTags };
    }

    const [items, total] = await Promise.all([
      this.prisma.skillPackage.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { downloadCount: 'desc' },
      }),
      this.prisma.skillPackage.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toSkillPackageResponse(item)),
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  async getSkillByShareId(shareId: string): Promise<SkillPackageResponse | null> {
    const skillPackage = await this.prisma.skillPackage.findFirst({
      where: {
        shareId,
        deletedAt: null,
      },
      include: {
        workflows: {
          where: { deletedAt: null },
          include: { dependencies: true },
        },
      },
    });

    if (!skillPackage) {
      return null;
    }

    return this.toSkillPackageResponse(skillPackage, skillPackage.workflows);
  }

  // ===== Helper Methods =====

  private async getSkillPackageOrThrow(skillId: string, uid: string): Promise<SkillPackage> {
    const skillPackage = await this.prisma.skillPackage.findFirst({
      where: {
        skillId,
        uid,
        deletedAt: null,
      },
    });

    if (!skillPackage) {
      throw new Error(`Skill package not found or access denied: ${skillId}`);
    }

    return skillPackage;
  }

  private normalizeWorkflowIds(workflowId?: string, workflowIds?: string[]): string[] {
    const ids = new Set<string>();
    if (workflowId) ids.add(workflowId);
    if (workflowIds?.length) {
      for (const id of workflowIds) {
        if (id) ids.add(id);
      }
    }
    return Array.from(ids);
  }

  private buildWorkflowQueryFromSkill(input: CreateSkillPackageCliDto): string {
    const parts: string[] = [];
    if (input.description) {
      parts.push(input.description);
    } else if (input.name) {
      parts.push(`Create a workflow for ${input.name}`);
    }
    if (input.triggers?.length) {
      parts.push(`Triggers: ${input.triggers.join(', ')}`);
    }
    if (parts.length === 0) {
      return 'Generate a workflow based on the provided skill definition.';
    }
    return parts.join(' ');
  }

  private async loadWorkflowSummaries(
    user: User,
    canvasIds: string[],
  ): Promise<Map<string, { name: string }>> {
    const records = await this.prisma.canvas.findMany({
      where: { canvasId: { in: canvasIds }, uid: user.uid, deletedAt: null },
      select: { canvasId: true, title: true },
    });
    const map = new Map<string, { name: string }>();
    for (const record of records) {
      map.set(record.canvasId, { name: record.title });
    }
    if (records.length !== canvasIds.length) {
      const found = new Set(records.map((r) => r.canvasId));
      const missing = canvasIds.filter((id) => !found.has(id));
      throw new Error(`Workflow not found or access denied: ${missing.join(', ')}`);
    }
    return map;
  }

  private async assertWorkflowsExist(user: User, canvasIds: string[]): Promise<void> {
    for (const canvasId of canvasIds) {
      await this.assertWorkflowExists(user, canvasId);
    }
  }

  private async assertWorkflowExists(user: User, canvasId: string): Promise<void> {
    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });

    if (!canvas) {
      throw new Error(`Workflow not found or access denied: ${canvasId}`);
    }
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

  private normalizeTags(tags?: string[] | string): string[] {
    if (!tags) return [];
    if (Array.isArray(tags)) {
      return tags.filter((tag) => typeof tag === 'string' && tag.trim().length > 0);
    }
    if (typeof tags === 'string') {
      const trimmed = tags.trim();
      return trimmed ? [trimmed] : [];
    }
    return [];
  }

  private async checkAccess(
    skillPackage: SkillPackage,
    userId?: string,
    shareId?: string,
  ): Promise<boolean> {
    // Owner always has access
    if (userId && skillPackage.uid === userId) {
      return true;
    }

    // Public packages are accessible to all
    if (skillPackage.isPublic) {
      return true;
    }

    // Private packages with matching shareId are accessible
    if (shareId && skillPackage.shareId === shareId) {
      return true;
    }

    return false;
  }

  private toSkillPackageResponse(
    skillPackage: SkillPackage,
    workflows?: (SkillWorkflow & { dependencies?: any[] })[],
  ): SkillPackageResponse {
    return {
      skillId: skillPackage.skillId,
      name: skillPackage.name,
      version: skillPackage.version,
      description: skillPackage.description ?? undefined,
      uid: skillPackage.uid,
      icon: skillPackage.icon ? JSON.parse(skillPackage.icon) : undefined,
      triggers: skillPackage.triggers,
      tags: skillPackage.tags,
      inputSchema: skillPackage.inputSchema ? JSON.parse(skillPackage.inputSchema) : undefined,
      outputSchema: skillPackage.outputSchema ? JSON.parse(skillPackage.outputSchema) : undefined,
      status: skillPackage.status,
      isPublic: skillPackage.isPublic,
      coverStorageKey: skillPackage.coverStorageKey ?? undefined,
      downloadCount: skillPackage.downloadCount,
      shareId: skillPackage.shareId ?? undefined,
      createdAt: skillPackage.createdAt.toISOString(),
      updatedAt: skillPackage.updatedAt.toISOString(),
      workflows: workflows?.map((w) => this.toSkillWorkflowResponse(w)),
    };
  }

  private toSkillWorkflowResponse(
    workflow: SkillWorkflow & { dependencies?: any[] },
  ): SkillWorkflowResponse {
    return {
      skillWorkflowId: workflow.skillWorkflowId,
      skillId: workflow.skillId,
      name: workflow.name,
      description: workflow.description ?? undefined,
      sourceCanvasId: workflow.sourceCanvasId ?? undefined,
      inputSchema: workflow.inputSchema ? JSON.parse(workflow.inputSchema) : undefined,
      outputSchema: workflow.outputSchema ? JSON.parse(workflow.outputSchema) : undefined,
      isEntry: workflow.isEntry,
      dependencies: workflow.dependencies?.map((d: any) => ({
        dependencyWorkflowId: d.dependencyWorkflowId,
        dependencyType: d.dependencyType,
        condition: d.condition ?? undefined,
        inputMapping: d.inputMapping ? JSON.parse(d.inputMapping) : undefined,
        outputSelector: d.outputSelector ? JSON.parse(d.outputSelector) : undefined,
        mergeStrategy: d.mergeStrategy ?? undefined,
        customMerge: d.customMerge ?? undefined,
      })),
    };
  }
}
