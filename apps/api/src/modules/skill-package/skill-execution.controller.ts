/**
 * Skill Execution Controller - REST API for skill execution management.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { SkillPackageExecutorService } from './skill-package-executor.service';
import {
  StartSkillExecutionDto,
  ListExecutionsQueryDto,
  SkillExecutionResponse,
  StartExecutionResponse,
  ListExecutionsResponse,
  WorkflowExecutionStatus,
} from './skill-execution.dto';
import { PrismaService } from '../common/prisma.service';
import { User } from '@prisma/client';
import { safeParseJSON } from '@refly/utils';

@Controller('v1')
@UseGuards(JwtAuthGuard)
export class SkillExecutionController {
  private readonly logger = new Logger(SkillExecutionController.name);

  constructor(
    private readonly executorService: SkillPackageExecutorService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Start a new skill execution.
   * POST /v1/skill-packages/:skillId/executions
   */
  @Post('skill-packages/:skillId/executions')
  async startExecution(
    @Param('skillId') skillId: string,
    @Body() dto: StartSkillExecutionDto,
    @LoginedUser() user: User,
  ): Promise<StartExecutionResponse> {
    this.logger.log(`Starting execution for skill ${skillId} by user ${user.uid}`);

    // Find the installation for this skill and user
    const installation = await this.prisma.skillInstallation.findFirst({
      where: {
        skillId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!installation) {
      throw new NotFoundException(`Skill ${skillId} is not installed for user ${user.uid}`);
    }

    const executionId = await this.executorService.startExecution({
      installationId: installation.installationId,
      user: user as any,
      input: dto.input,
    });

    // Get the created execution
    const execution = await this.prisma.skillExecution.findUnique({
      where: { executionId },
    });

    return {
      executionId,
      status: execution?.status ?? 'pending',
      createdAt: execution?.createdAt.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * Get execution status and details.
   * GET /v1/skill-executions/:executionId
   */
  @Get('skill-executions/:executionId')
  async getExecution(
    @Param('executionId') executionId: string,
    @LoginedUser() user: User,
  ): Promise<SkillExecutionResponse> {
    const execution = await this.prisma.skillExecution.findUnique({
      where: { executionId },
      include: {
        workflowExecutions: true,
      },
    });

    if (!execution) {
      throw new NotFoundException(`Execution ${executionId} not found`);
    }

    if (execution.uid !== user.uid) {
      throw new ForbiddenException('Access denied');
    }

    return this.mapExecutionToResponse(execution);
  }

  /**
   * Get workflow executions for a skill execution.
   * GET /v1/skill-executions/:executionId/workflows
   */
  @Get('skill-executions/:executionId/workflows')
  async getWorkflowExecutions(
    @Param('executionId') executionId: string,
    @LoginedUser() user: User,
  ): Promise<WorkflowExecutionStatus[]> {
    const execution = await this.prisma.skillExecution.findUnique({
      where: { executionId },
      include: {
        workflowExecutions: {
          orderBy: [{ executionLevel: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!execution) {
      throw new NotFoundException(`Execution ${executionId} not found`);
    }

    if (execution.uid !== user.uid) {
      throw new ForbiddenException('Access denied');
    }

    return execution.workflowExecutions.map((wf) => this.mapWorkflowToStatus(wf));
  }

  /**
   * List executions for a skill.
   * GET /v1/skill-packages/:skillId/executions
   */
  @Get('skill-packages/:skillId/executions')
  async listExecutions(
    @Param('skillId') skillId: string,
    @Query() query: ListExecutionsQueryDto,
    @LoginedUser() user: User,
  ): Promise<ListExecutionsResponse> {
    const page = Number.parseInt(query.page ?? '1', 10);
    const pageSize = Number.parseInt(query.pageSize ?? '20', 10);
    const skip = (page - 1) * pageSize;

    const where = {
      skillId,
      uid: user.uid,
      ...(query.status && { status: query.status }),
    };

    const [items, total] = await Promise.all([
      this.prisma.skillExecution.findMany({
        where,
        include: {
          workflowExecutions: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.skillExecution.count({ where }),
    ]);

    return {
      items: items.map((e) => this.mapExecutionToResponse(e)),
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  /**
   * Map execution entity to response DTO.
   */
  private mapExecutionToResponse(execution: {
    executionId: string;
    installationId: string;
    skillId: string;
    status: string;
    input: string | null;
    output: string | null;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    workflowExecutions?: Array<{
      executionWorkflowId: string;
      skillWorkflowId: string;
      workflowId: string;
      executionLevel: number;
      status: string;
      input: string | null;
      output: string | null;
      errorMessage: string | null;
      retryCount: number;
      startedAt: Date | null;
      completedAt: Date | null;
    }>;
  }): SkillExecutionResponse {
    return {
      executionId: execution.executionId,
      installationId: execution.installationId,
      skillId: execution.skillId,
      status: execution.status,
      input: execution.input ? safeParseJSON(execution.input) : undefined,
      output: execution.output ? safeParseJSON(execution.output) : undefined,
      errorMessage: execution.errorMessage ?? undefined,
      startedAt: execution.startedAt?.toISOString(),
      completedAt: execution.completedAt?.toISOString(),
      createdAt: execution.createdAt.toISOString(),
      workflowExecutions: execution.workflowExecutions?.map((wf) => this.mapWorkflowToStatus(wf)),
    };
  }

  /**
   * Map workflow execution entity to status DTO.
   */
  private mapWorkflowToStatus(wf: {
    executionWorkflowId: string;
    skillWorkflowId: string;
    workflowId: string;
    executionLevel: number;
    status: string;
    input: string | null;
    output: string | null;
    errorMessage: string | null;
    retryCount: number;
    startedAt: Date | null;
    completedAt: Date | null;
  }): WorkflowExecutionStatus {
    return {
      executionWorkflowId: wf.executionWorkflowId,
      skillWorkflowId: wf.skillWorkflowId,
      workflowId: wf.workflowId,
      executionLevel: wf.executionLevel,
      status: wf.status,
      input: wf.input ? safeParseJSON(wf.input) : undefined,
      output: wf.output ? safeParseJSON(wf.output) : undefined,
      errorMessage: wf.errorMessage ?? undefined,
      retryCount: wf.retryCount,
      startedAt: wf.startedAt?.toISOString(),
      completedAt: wf.completedAt?.toISOString(),
    };
  }
}
