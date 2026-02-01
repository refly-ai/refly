/**
 * Skill Package Service - manages skill package CRUD and workflow operations.
 */

import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { User } from '@refly/openapi-schema';
import {
  genSkillPackageID,
  genSkillPackageWorkflowID,
  genSkillPackageInstallationID,
  genInviteCode,
} from '@refly/utils';
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
  PublishSkillDto,
  ReflySkillMeta,
  WorkflowMappingRecord,
} from './skill-package.dto';
import { SkillPackage, SkillWorkflow, Prisma } from '@prisma/client';
import { SKILL_CLI_ERROR_CODES, throwCliError } from './skill-package.errors';
import { CopilotAutogenService } from '../copilot-autogen/copilot-autogen.service';
import { WorkflowCliService } from '../workflow/workflow-cli.service';
import { CreateWorkflowRequest } from '../workflow/workflow-cli.dto';
import { SkillGithubService } from './skill-github.service';

@Injectable()
export class SkillPackageService {
  private readonly logger = new Logger(SkillPackageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly copilotAutogenService: CopilotAutogenService,
    private readonly workflowCliService: WorkflowCliService,
    private readonly githubService: SkillGithubService,
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
    // Validate description - must be at least 20 words for Claude Code discovery
    this.validateSkillDescription(input.description, input.name, input.workflowQuery);

    const normalizedWorkflowIds = this.normalizeWorkflowIds(input.workflowId, input.workflowIds);
    const createdWorkflowIds: string[] = [];
    const workflowBindings: Array<{
      workflowId: string;
      name: string;
      description?: string;
    }> = [];

    // Track generated input schema from workflow plan variables
    let generatedInputSchema: Record<string, unknown> | undefined;

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

          // Extract input schema from workflow plan variables
          this.logger.log(
            `[SkillCreate] Workflow plan variables: ${JSON.stringify(generated.workflowPlan?.variables ?? [])}`,
          );
          if (generated.workflowPlan?.variables?.length) {
            generatedInputSchema = this.convertVariablesToInputSchema(
              generated.workflowPlan.variables,
            );
            this.logger.log(
              `[SkillCreate] Generated input schema from ${generated.workflowPlan.variables.length} variables`,
            );
          } else {
            // Fallback: Generate a default input schema based on the workflow query
            // This ensures skills always have a meaningful input example
            this.logger.log(
              '[SkillCreate] No variables in workflow plan, generating default input schema from query',
            );
            generatedInputSchema = {
              query: input.workflowQuery || input.description || `Input for ${input.name}`,
            };
          }
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

          // Extract variables from the first existing workflow if no schema generated yet
          if (!generatedInputSchema && normalizedWorkflowIds.length > 0) {
            const workflowVariables = await this.getWorkflowVariables(
              user,
              normalizedWorkflowIds[0],
            );
            this.logger.log(
              `[SkillCreate] Existing workflow variables: ${JSON.stringify(workflowVariables ?? [])}`,
            );
            if (workflowVariables?.length) {
              generatedInputSchema = this.convertVariablesToInputSchema(workflowVariables);
              this.logger.log(
                `[SkillCreate] Generated input schema from ${workflowVariables.length} existing workflow variables`,
              );
            } else {
              // Fallback for existing workflow without variables
              this.logger.log(
                '[SkillCreate] No variables in existing workflow, generating default input schema',
              );
              generatedInputSchema = {
                query: input.description || `Input for ${input.name}`,
              };
            }
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

      // Use generated input schema if not explicitly provided
      const finalInputSchema = input.inputSchema || generatedInputSchema;

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
            inputSchema: finalInputSchema ? JSON.stringify(finalInputSchema) : null,
            outputSchema: input.outputSchema ? JSON.stringify(input.outputSchema) : null,
            status: 'draft',
            isPublic: false,
          },
        });

        // Track skillWorkflowIds for installation mapping
        const skillWorkflowIds: string[] = [];

        if (!input.noWorkflow) {
          for (const workflow of workflowBindings) {
            const skillWorkflowId = genSkillPackageWorkflowID();
            skillWorkflowIds.push(skillWorkflowId);
            await tx.skillWorkflow.create({
              data: {
                skillWorkflowId,
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

        // Auto-create installation for the skill creator
        // Creator uses source workflows directly (no cloning needed)
        const installationId = genSkillPackageInstallationID();
        const workflowMapping: WorkflowMappingRecord = {};

        for (let i = 0; i < skillWorkflowIds.length; i++) {
          workflowMapping[skillWorkflowIds[i]] = {
            workflowId: workflowBindings[i].workflowId,
            status: 'ready',
          };
        }

        await tx.skillInstallation.create({
          data: {
            installationId,
            skillId,
            uid: user.uid,
            status: 'ready', // Creator is auto-ready (owns the workflows)
            workflowMapping: JSON.stringify(workflowMapping),
            installedVersion: input.version,
          },
        });

        return { skillPackage, installationId };
      });

      this.logger.log(
        `Created skill package: ${skillId} with installation ${result.installationId} by user ${user.uid}`,
      );

      const workflowIds = workflowBindings.map((w) => w.workflowId);
      return {
        skillId: result.skillPackage.skillId,
        name: result.skillPackage.name,
        status: result.skillPackage.status,
        createdAt: result.skillPackage.createdAt.toJSON(),
        workflowId: workflowIds[0],
        workflowIds,
        workflows: workflowBindings.length > 0 ? workflowBindings : undefined,
        inputSchema: finalInputSchema,
        outputSchema: input.outputSchema,
        installationId: result.installationId,
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

  async publishSkillPackage(
    user: User,
    skillId: string,
    dto?: PublishSkillDto,
  ): Promise<SkillPackageResponse> {
    const existing = await this.getSkillPackageOrThrow(skillId, user.uid);

    // If skillContent is provided, parse and validate it
    let parsedMeta: ReflySkillMeta | undefined;
    if (dto?.skillContent) {
      const parsed = this.parseReflySkillMd(dto.skillContent);
      parsedMeta = parsed.meta;

      // Validate skillId matches
      if (parsedMeta.skillId !== skillId) {
        throw new Error(
          `skillId mismatch: SKILL.md contains '${parsedMeta.skillId}' but publishing to '${skillId}'`,
        );
      }

      // Update DB with parsed metadata from SKILL.md
      await this.prisma.skillPackage.update({
        where: { skillId },
        data: {
          name: parsedMeta.name,
          description: parsedMeta.description,
          triggers: parsedMeta.triggers ?? [],
          tags: parsedMeta.tags ?? [],
          version: parsedMeta.version ?? existing.version,
        },
      });

      this.logger.log(`Updated skill package from SKILL.md: ${skillId}`);
    }

    // Generate share ID only if not exists (preserve existing share links)
    const shareId = existing.shareId || genInviteCode();

    let updated = await this.prisma.skillPackage.update({
      where: { skillId },
      data: {
        status: 'published',
        isPublic: true,
        shareId,
      },
    });

    // Submit to GitHub registry (non-blocking - failure doesn't block publish)
    try {
      // Get full user record for GitHub submission
      const userRecord = await this.prisma.user.findUnique({
        where: { uid: user.uid },
      });

      if (userRecord) {
        const { prUrl, prNumber } = await this.githubService.submitSkillToRegistry(
          updated,
          userRecord,
          dto?.skillContent, // Pass skillContent for GitHub submission
        );
        updated = await this.prisma.skillPackage.update({
          where: { skillId },
          data: {
            githubPrNumber: prNumber,
            githubPrUrl: prUrl,
            githubSubmittedAt: new Date(),
          },
        });
        this.logger.log(`Submitted to GitHub: PR #${prNumber}`);
      }
    } catch (error) {
      this.logger.error(`Failed to submit to GitHub: ${error.message}`);
      // Continue - GitHub failure doesn't block publish
    }

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

  /**
   * Get workflow variables from an existing canvas/workflow.
   */
  private async getWorkflowVariables(
    user: User,
    canvasId: string,
  ): Promise<
    Array<{
      variableId?: string;
      name: string;
      description?: string;
      variableType?: string;
      required?: boolean;
    }>
  > {
    try {
      const canvas = await this.prisma.canvas.findFirst({
        select: { workflow: true },
        where: { canvasId, uid: user.uid, deletedAt: null },
      });
      if (!canvas?.workflow) return [];

      const workflow = JSON.parse(canvas.workflow);
      return workflow?.variables ?? [];
    } catch (error) {
      this.logger.warn(`Failed to get workflow variables for ${canvasId}: ${error}`);
      return [];
    }
  }

  /**
   * Convert workflow plan variables to input schema format.
   * Variables have structure: { variableId, name, description, variableType, required }
   * Output is a JSON schema-like structure with example values.
   */
  private convertVariablesToInputSchema(
    variables: Array<{
      variableId?: string;
      name: string;
      description?: string;
      variableType?: string;
      required?: boolean;
    }>,
  ): Record<string, unknown> {
    const schema: Record<string, unknown> = {};

    for (const variable of variables) {
      // Use example value based on variable type
      let exampleValue: unknown;
      const varType = variable.variableType?.toLowerCase();

      if (varType === 'resource' || varType === 'file') {
        exampleValue = '<file-reference>';
      } else if (varType === 'number' || varType === 'integer') {
        exampleValue = 0;
      } else if (varType === 'boolean') {
        exampleValue = false;
      } else if (varType === 'array' || varType === 'list') {
        exampleValue = [];
      } else {
        // Default to string with description as hint
        exampleValue = variable.description || `<${variable.name}>`;
      }

      schema[variable.name] = exampleValue;
    }

    return schema;
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
      githubPrNumber: skillPackage.githubPrNumber ?? undefined,
      githubPrUrl: skillPackage.githubPrUrl ?? undefined,
      githubSubmittedAt: skillPackage.githubSubmittedAt?.toISOString() ?? undefined,
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

  /**
   * Validate skill description for Claude Code compatibility.
   * Description must be at least 20 words for effective skill discovery.
   *
   * Format: "[What it does]. Use when [scenarios]: (1) [case1], (2) [case2], or [catch-all]."
   */
  private validateSkillDescription(
    description: string | undefined,
    skillName: string,
    workflowQuery?: string,
  ): void {
    const MIN_WORD_COUNT = 20;

    if (!description) {
      const example = this.generateDescriptionExample(skillName, workflowQuery);
      throwCliError(
        SKILL_CLI_ERROR_CODES.DESCRIPTION_REQUIRED,
        'Skill description is required for Claude Code discovery',
        `Add --description with at least ${MIN_WORD_COUNT} words`,
        HttpStatus.BAD_REQUEST,
        undefined, // details
        {
          field: '--description',
          format: '[What it does]. Use when [scenarios]: (1) [case1], (2) [case2], or [catch-all].',
          example,
        },
        true, // recoverable
      );
    }

    const wordCount = this.countWords(description);
    if (wordCount < MIN_WORD_COUNT) {
      const example = this.generateDescriptionExample(skillName, workflowQuery);
      throwCliError(
        SKILL_CLI_ERROR_CODES.DESCRIPTION_REQUIRED,
        `Skill description must be at least ${MIN_WORD_COUNT} words (current: ${wordCount} words)`,
        'Provide a richer description for better Claude Code skill discovery',
        HttpStatus.BAD_REQUEST,
        undefined, // details
        {
          field: '--description',
          format: '[What it does]. Use when [scenarios]: (1) [case1], (2) [case2], or [catch-all].',
          example,
        },
        true, // recoverable
      );
    }
  }

  /**
   * Generate an example description based on skill name and workflow query.
   */
  private generateDescriptionExample(skillName: string, workflowQuery?: string): string {
    const baseName = skillName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    if (workflowQuery) {
      // Use workflow query to generate a more relevant example
      return `${baseName}: ${workflowQuery}. Use when Claude needs to: (1) [specific scenario based on your workflow], (2) [related task], or similar automation tasks.`;
    }

    return `${baseName} automation and processing. Use when Claude needs to: (1) [describe primary use case], (2) [describe secondary use case], or [general catch-all scenario].`;
  }

  /**
   * Count words in a string, handling both CJK (Chinese/Japanese/Korean) and Western text.
   * CJK characters are counted individually (each character = 1 word unit).
   * Western words are counted by splitting on whitespace.
   */
  private countWords(text: string): number {
    if (!text || !text.trim()) {
      return 0;
    }

    const trimmed = text.trim();

    // CJK character ranges: Chinese, Japanese Hiragana/Katakana, Korean Hangul
    const cjkRegex =
      /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;

    // Count CJK characters (each character = 1 word unit)
    const cjkMatches = trimmed.match(cjkRegex);
    const cjkCount = cjkMatches ? cjkMatches.length : 0;

    // Remove CJK characters and count remaining words by whitespace
    const nonCjkText = trimmed.replace(cjkRegex, ' ').trim();
    const nonCjkWords = nonCjkText.split(/\s+/).filter((word) => word.length > 0);
    const nonCjkCount = nonCjkWords.length;

    return cjkCount + nonCjkCount;
  }

  /**
   * Parse SKILL.md content and extract metadata and body.
   * Used when publishing a skill from local SKILL.md content.
   */
  parseReflySkillMd(content: string): {
    meta: ReflySkillMeta;
    body: string;
  } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      throw new Error('Invalid SKILL.md format: missing frontmatter');
    }

    const [, frontmatterStr, body] = match;
    const meta: Partial<ReflySkillMeta> = {};

    // Parse YAML-like frontmatter
    const lines = frontmatterStr.split('\n');
    let currentKey: string | null = null;
    let currentArray: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for array item (starts with "  - ")
      if (trimmed.startsWith('- ')) {
        if (currentKey) {
          currentArray.push(trimmed.slice(2).trim());
        }
        continue;
      }

      // If we were collecting an array, save it
      if (currentKey && currentArray.length > 0) {
        (meta as Record<string, unknown>)[currentKey] = currentArray;
        currentArray = [];
        currentKey = null;
      }

      // Parse key: value pairs
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();

        if (value === '') {
          // This is an array key
          currentKey = key;
          currentArray = [];
        } else {
          (meta as Record<string, unknown>)[key] = value;
        }
      }
    }

    // Save any remaining array
    if (currentKey && currentArray.length > 0) {
      (meta as Record<string, unknown>)[currentKey] = currentArray;
    }

    // Validate required fields
    if (!meta.name) {
      throw new Error('Invalid SKILL.md: missing required field "name"');
    }
    if (!meta.description) {
      throw new Error('Invalid SKILL.md: missing required field "description"');
    }
    if (!meta.skillId) {
      throw new Error('Invalid SKILL.md: missing required field "skillId"');
    }
    if (!meta.workflowId) {
      throw new Error('Invalid SKILL.md: missing required field "workflowId"');
    }

    return {
      meta: meta as ReflySkillMeta,
      body: body.trim(),
    };
  }
}
