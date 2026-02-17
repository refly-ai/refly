/**
 * Skill Package Executor Service - orchestrates multi-workflow skill execution.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma.service';
import { WorkflowService } from '../workflow/workflow.service';
import { SkillExecutionPlanService, SkillWorkflowInfo } from './skill-execution-plan.service';
import { SkillWorkflowMapperService } from './skill-workflow-mapper.service';
import {
  DEFAULT_EXECUTION_CONFIG,
  ExecutionConfig,
  EXECUTION_STATUS,
  WORKFLOW_STATUS,
  calculateBackoff,
} from './skill-execution.config';
import { SkillExecutionError } from './skill-execution.errors';
import { QUEUE_SKILL_EXECUTION, QUEUE_SKILL_WORKFLOW } from '../../utils/const';
import {
  genSkillPackageExecutionID,
  genSkillPackageWorkflowExecID,
  genVariableID,
  safeParseJSON,
} from '@refly/utils';
import { User } from '@refly/openapi-schema';

export interface SkillExecutionJob {
  executionId: string;
  skillId: string;
  installationId: string;
  uid: string;
  input: Record<string, unknown>;
  retryCount: number;
}

export interface SkillWorkflowJob {
  executionId: string;
  executionWorkflowId: string;
  skillWorkflowId: string;
  workflowId: string;
  input: Record<string, unknown>;
  retryCount: number;
}

export interface StartExecutionParams {
  user: User;
  installationId: string;
  input?: Record<string, unknown>;
  config?: Partial<ExecutionConfig>;
}

export interface ExecutionStatusResult {
  executionId: string;
  installationId: string;
  skillId: string;
  status: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  workflowExecutions: Array<{
    executionWorkflowId: string;
    skillWorkflowId: string;
    workflowId: string;
    executionLevel: number;
    status: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    errorMessage?: string;
    retryCount: number;
    startedAt?: Date;
    completedAt?: Date;
  }>;
}

@Injectable()
export class SkillPackageExecutorService {
  private readonly logger = new Logger(SkillPackageExecutorService.name);
  private readonly config: ExecutionConfig = DEFAULT_EXECUTION_CONFIG;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
    private readonly planService: SkillExecutionPlanService,
    private readonly mapperService: SkillWorkflowMapperService,
    @InjectQueue(QUEUE_SKILL_EXECUTION) private readonly executionQueue: Queue<SkillExecutionJob>,
    @InjectQueue(QUEUE_SKILL_WORKFLOW) private readonly workflowQueue: Queue<SkillWorkflowJob>,
  ) {}

  /**
   * Start a skill execution.
   */
  async startExecution(params: StartExecutionParams): Promise<string> {
    const { user, installationId, input = {} } = params;

    // Get installation
    const installation = await this.prisma.skillInstallation.findFirst({
      where: {
        installationId,
        uid: user.uid,
        deletedAt: null,
      },
      include: {
        skillPackage: {
          include: {
            workflows: {
              include: {
                dependencies: true,
              },
            },
          },
        },
      },
    });

    if (!installation) {
      throw SkillExecutionError.executionNotFound(installationId);
    }

    if (!['ready', 'partial_failed'].includes(installation.status)) {
      throw SkillExecutionError.skillNotReady(installation.skillId, installation.status);
    }

    const skillPackage = installation.skillPackage;
    if (!skillPackage?.workflows?.length) {
      throw new Error('Skill package has no workflows');
    }

    // Parse workflow mapping
    const workflowMapping: Record<string, { workflowId: string | null; status: string }> =
      installation.workflowMapping ? JSON.parse(installation.workflowMapping) : {};

    // Build workflow info for plan
    const workflowInfos: SkillWorkflowInfo[] = skillPackage.workflows.map((wf) => ({
      skillWorkflowId: wf.skillWorkflowId,
      name: wf.name,
      dependencies: wf.dependencies?.map((dep) => ({
        dependencyWorkflowId: dep.dependencyWorkflowId,
        condition: dep.condition ?? undefined,
        inputMapping: dep.inputMapping ?? undefined,
        outputSelector: dep.outputSelector ?? undefined,
        mergeStrategy: dep.mergeStrategy ?? undefined,
      })),
    }));

    // Build execution plan
    const plan = this.planService.buildExecutionPlan(workflowInfos);

    // Create execution record
    const executionId = genSkillPackageExecutionID();

    await this.prisma.skillExecution.create({
      data: {
        executionId,
        installationId,
        skillId: installation.skillId,
        uid: user.uid,
        status: EXECUTION_STATUS.PENDING,
        input: JSON.stringify(input),
      },
    });

    // Create workflow execution records
    for (const level of plan.levels) {
      for (const wf of level.workflows) {
        const mapping = workflowMapping[wf.skillWorkflowId];
        if (!mapping?.workflowId) {
          this.logger.warn(`Workflow ${wf.skillWorkflowId} not cloned, skipping`);
          continue;
        }

        const executionWorkflowId = genSkillPackageWorkflowExecID();
        await this.prisma.skillExecutionWorkflow.create({
          data: {
            executionWorkflowId,
            executionId,
            skillWorkflowId: wf.skillWorkflowId,
            workflowId: mapping.workflowId,
            executionLevel: level.level,
            status: WORKFLOW_STATUS.PENDING,
          },
        });
      }
    }

    // Queue execution job
    await this.executionQueue.add(
      'execute-skill',
      {
        executionId,
        skillId: installation.skillId,
        installationId,
        uid: user.uid,
        input,
        retryCount: 0,
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 1, // Retries handled internally
      },
    );

    this.logger.log(`Started skill execution ${executionId} for installation ${installationId}`);
    return executionId;
  }

  /**
   * Process skill execution (called by BullMQ processor).
   */
  async processExecution(job: SkillExecutionJob): Promise<void> {
    const { executionId } = job;

    // Update status to running
    await this.prisma.skillExecution.update({
      where: { executionId },
      data: {
        status: EXECUTION_STATUS.RUNNING,
        startedAt: new Date(),
      },
    });

    // Get execution with workflows
    const execution = await this.prisma.skillExecution.findUnique({
      where: { executionId },
      include: {
        workflowExecutions: {
          orderBy: { executionLevel: 'asc' },
        },
      },
    });

    if (!execution) {
      this.logger.error(`Execution not found: ${executionId}`);
      return;
    }

    const input: Record<string, unknown> = execution.input ? JSON.parse(execution.input) : {};

    // Process level by level
    const workflowsByLevel = new Map<number, typeof execution.workflowExecutions>();
    for (const wf of execution.workflowExecutions) {
      const level = wf.executionLevel;
      if (!workflowsByLevel.has(level)) {
        workflowsByLevel.set(level, []);
      }
      workflowsByLevel.get(level)!.push(wf);
    }

    const completedWorkflows = new Set<string>();
    const failedWorkflows = new Set<string>();
    const skippedWorkflows = new Set<string>();
    const workflowOutputs = new Map<string, Record<string, unknown>>();

    // Process levels sequentially
    const levels = Array.from(workflowsByLevel.keys()).sort((a, b) => a - b);

    for (const level of levels) {
      const levelWorkflows = workflowsByLevel.get(level)!;

      // Queue all workflows at this level for parallel execution
      const workflowJobs = levelWorkflows
        .filter((wf) => !failedWorkflows.has(wf.skillWorkflowId))
        .map(async (wf) => {
          // Prepare input for this workflow
          const workflowInput = this.prepareWorkflowInput(
            wf.skillWorkflowId,
            input,
            workflowOutputs,
            execution.workflowExecutions,
          );

          // Queue workflow execution
          await this.workflowQueue.add(
            'execute-workflow',
            {
              executionId,
              executionWorkflowId: wf.executionWorkflowId,
              skillWorkflowId: wf.skillWorkflowId,
              workflowId: wf.workflowId,
              input: workflowInput,
              retryCount: 0,
            },
            {
              removeOnComplete: true,
              removeOnFail: false,
            },
          );
        });

      await Promise.all(workflowJobs);

      // Wait for all workflows at this level to complete
      await this.waitForLevelCompletion(executionId, level);

      // Collect results
      const updatedWorkflows = await this.prisma.skillExecutionWorkflow.findMany({
        where: {
          executionId,
          executionLevel: level,
        },
      });

      for (const wf of updatedWorkflows) {
        if (wf.status === WORKFLOW_STATUS.SUCCESS) {
          completedWorkflows.add(wf.skillWorkflowId);
          if (wf.output) {
            workflowOutputs.set(wf.skillWorkflowId, JSON.parse(wf.output));
          }
        } else if (wf.status === WORKFLOW_STATUS.FAILED) {
          failedWorkflows.add(wf.skillWorkflowId);
        } else if (wf.status === WORKFLOW_STATUS.SKIPPED) {
          skippedWorkflows.add(wf.skillWorkflowId);
        }
      }
    }

    // Determine final status
    let finalStatus: string;
    if (failedWorkflows.size === 0) {
      finalStatus = EXECUTION_STATUS.SUCCESS;
    } else if (completedWorkflows.size === 0) {
      finalStatus = EXECUTION_STATUS.FAILED;
    } else {
      finalStatus = EXECUTION_STATUS.PARTIAL_FAILED;
    }

    // Aggregate outputs
    const aggregatedOutput: Record<string, unknown> = {};
    for (const [workflowId, output] of workflowOutputs) {
      aggregatedOutput[workflowId] = output;
    }

    // Update execution record
    await this.prisma.skillExecution.update({
      where: { executionId },
      data: {
        status: finalStatus,
        output: JSON.stringify(aggregatedOutput),
        completedAt: new Date(),
        errorMessage:
          failedWorkflows.size > 0
            ? `Failed workflows: ${Array.from(failedWorkflows).join(', ')}`
            : null,
      },
    });

    this.logger.log(`Completed skill execution ${executionId} with status ${finalStatus}`);
  }

  /**
   * Process a single workflow execution (called by BullMQ processor).
   */
  async processWorkflow(job: SkillWorkflowJob): Promise<void> {
    const { executionId, executionWorkflowId, workflowId, input } = job;

    // Update status to running
    await this.prisma.skillExecutionWorkflow.update({
      where: { executionWorkflowId },
      data: {
        status: WORKFLOW_STATUS.RUNNING,
        input: JSON.stringify(input),
        startedAt: new Date(),
      },
    });

    try {
      // Get user for workflow execution
      const execution = await this.prisma.skillExecution.findUnique({
        where: { executionId },
      });

      if (!execution) {
        throw new Error(`Execution not found: ${executionId}`);
      }

      // Initialize and run workflow
      // Note: This creates a WorkflowExecution record and queues the workflow for execution

      // Get existing canvas variables to preserve variableId mapping
      // This ensures that variable references in node queries (e.g., @{type=var,id=var-xxx,...})
      // can be correctly matched with the variables passed at runtime
      const canvas = await this.prisma.canvas.findFirst({
        where: { canvasId: workflowId, deletedAt: null },
        select: { workflow: true },
      });
      const existingVariables = canvas?.workflow
        ? (safeParseJSON(canvas.workflow)?.variables ?? [])
        : [];

      // Merge input variables with existing variables
      // Strategy: preserve all existing variables, override values for matching names, add new ones
      const inputNames = new Set(Object.keys(input));

      // Start with existing variables, update values if they appear in input
      const mergedVariables = existingVariables.map((v: any) => {
        if (inputNames.has(v.name)) {
          // Variable exists in both - update the value
          return {
            variableId: v.variableId,
            name: v.name,
            variableType: 'string' as const,
            value: [{ type: 'text' as const, text: String(input[v.name]) }],
          };
        }
        // Variable only exists in workflow - keep as is
        return v;
      });

      // Add new variables that don't exist in workflow
      const newVariables = Object.entries(input)
        .filter(([name]) => !existingVariables.some((v: any) => v.name === name))
        .map(([name, value]) => ({
          variableId: genVariableID(),
          name,
          variableType: 'string' as const,
          value: [{ type: 'text' as const, text: String(value) }],
        }));

      const runtimeVariables = [...mergedVariables, ...newVariables];

      const workflowExecutionId = await this.workflowService.initializeWorkflowExecution(
        { uid: execution.uid } as User,
        workflowId,
        runtimeVariables,
        { checkCanvasOwnership: false },
      );

      // Wait for workflow completion (polling)
      const result = await this.waitForWorkflowCompletion(workflowExecutionId);

      // Update workflow execution record
      await this.prisma.skillExecutionWorkflow.update({
        where: { executionWorkflowId },
        data: {
          status: result.success ? WORKFLOW_STATUS.SUCCESS : WORKFLOW_STATUS.FAILED,
          output: result.output ? JSON.stringify(result.output) : null,
          errorMessage: result.error ?? null,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Workflow ${executionWorkflowId} failed: ${errorMessage}`);

      // Check if we should retry
      const workflowExec = await this.prisma.skillExecutionWorkflow.findUnique({
        where: { executionWorkflowId },
      });

      if (workflowExec && workflowExec.retryCount < this.config.retryPolicy.maxRetries) {
        // Retry
        const backoff = calculateBackoff(workflowExec.retryCount, this.config.retryPolicy);
        await this.prisma.skillExecutionWorkflow.update({
          where: { executionWorkflowId },
          data: { retryCount: workflowExec.retryCount + 1 },
        });

        await this.workflowQueue.add(
          'execute-workflow',
          { ...job, retryCount: workflowExec.retryCount + 1 },
          { delay: backoff },
        );
      } else {
        // Mark as failed
        await this.prisma.skillExecutionWorkflow.update({
          where: { executionWorkflowId },
          data: {
            status: WORKFLOW_STATUS.FAILED,
            errorMessage,
            completedAt: new Date(),
          },
        });
      }
    }
  }

  /**
   * Get execution status.
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionStatusResult | null> {
    const execution = await this.prisma.skillExecution.findUnique({
      where: { executionId },
      include: {
        workflowExecutions: true,
      },
    });

    if (!execution) {
      return null;
    }

    return {
      executionId: execution.executionId,
      installationId: execution.installationId,
      skillId: execution.skillId,
      status: execution.status,
      input: execution.input ? JSON.parse(execution.input) : undefined,
      output: execution.output ? JSON.parse(execution.output) : undefined,
      errorMessage: execution.errorMessage ?? undefined,
      startedAt: execution.startedAt ?? undefined,
      completedAt: execution.completedAt ?? undefined,
      createdAt: execution.createdAt,
      workflowExecutions: execution.workflowExecutions.map((wf) => ({
        executionWorkflowId: wf.executionWorkflowId,
        skillWorkflowId: wf.skillWorkflowId,
        workflowId: wf.workflowId,
        executionLevel: wf.executionLevel,
        status: wf.status,
        input: wf.input ? JSON.parse(wf.input) : undefined,
        output: wf.output ? JSON.parse(wf.output) : undefined,
        errorMessage: wf.errorMessage ?? undefined,
        retryCount: wf.retryCount,
        startedAt: wf.startedAt ?? undefined,
        completedAt: wf.completedAt ?? undefined,
      })),
    };
  }

  /**
   * Prepare input for a workflow by applying data mapping.
   */
  private prepareWorkflowInput(
    _skillWorkflowId: string,
    baseInput: Record<string, unknown>,
    _workflowOutputs: Map<string, Record<string, unknown>>,
    _allWorkflows: Array<{ skillWorkflowId: string }>,
  ): Record<string, unknown> {
    // For now, just pass through the base input
    // TODO: Apply InputMapping/OutputSelector from dependencies
    return baseInput;
  }

  /**
   * Wait for all workflows at a level to complete.
   */
  private async waitForLevelCompletion(executionId: string, level: number): Promise<void> {
    const maxWaitTime = this.config.skillTimeoutMs;
    const pollInterval = 2000;
    let elapsed = 0;

    while (elapsed < maxWaitTime) {
      const workflows = await this.prisma.skillExecutionWorkflow.findMany({
        where: {
          executionId,
          executionLevel: level,
        },
      });

      const allComplete = workflows.every((wf) =>
        [
          WORKFLOW_STATUS.SUCCESS,
          WORKFLOW_STATUS.FAILED,
          WORKFLOW_STATUS.SKIPPED,
          WORKFLOW_STATUS.BLOCKED,
        ].includes(wf.status as any),
      );

      if (allComplete) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      elapsed += pollInterval;
    }

    this.logger.warn(`Level ${level} did not complete within timeout for execution ${executionId}`);
  }

  /**
   * Wait for a workflow execution to complete.
   */
  private async waitForWorkflowCompletion(
    workflowExecutionId: string,
  ): Promise<{ success: boolean; output?: Record<string, unknown>; error?: string }> {
    const maxWaitTime = this.config.workflowTimeoutMs;
    const pollInterval = 2000;
    let elapsed = 0;

    while (elapsed < maxWaitTime) {
      const execution = await this.prisma.workflowExecution.findUnique({
        where: { executionId: workflowExecutionId },
      });

      if (!execution) {
        return { success: false, error: 'Workflow execution not found' };
      }

      if (execution.status === 'finished' || execution.status === 'finish') {
        return { success: true, output: {} };
      }

      if (execution.status === 'failed') {
        return { success: false, error: 'Workflow execution failed' };
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      elapsed += pollInterval;
    }

    return { success: false, error: 'Workflow execution timed out' };
  }
}
