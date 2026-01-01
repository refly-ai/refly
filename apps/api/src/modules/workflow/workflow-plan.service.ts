import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService, LockReleaseFn } from '../common/redis.service';
import {
  GetWorkflowPlanDetailData,
  WorkflowPlan,
  WorkflowPlanRecord,
  User,
} from '@refly/openapi-schema';
import { ParamsError } from '@refly/errors';
import { genWorkflowPlanID, safeParseJSON } from '@refly/utils';
import { WorkflowPlan as WorkflowPlanPO } from '@prisma/client';
import { WorkflowPatchOperation, applyWorkflowPatchOperations } from '@refly/canvas-common';

@Injectable()
export class WorkflowPlanService {
  private readonly logger = new Logger(WorkflowPlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get workflow plan detail by planId
   */
  async getWorkflowPlanDetail(
    user: User,
    params: GetWorkflowPlanDetailData['query'],
  ): Promise<WorkflowPlanRecord | null> {
    const { planId, version } = params;
    if (!planId) {
      throw new ParamsError('Plan ID is required');
    }

    const workflowPlanPO = await this.prisma.workflowPlan.findFirst({
      where: { uid: user.uid, planId, version },
      orderBy: { version: 'desc' },
    });

    if (!workflowPlanPO) {
      return null;
    }

    return this.workflowPlanPO2DTO(workflowPlanPO);
  }

  /**
   * Generate a new workflow plan
   */
  async generateWorkflowPlan(
    user: User,
    params: {
      data: WorkflowPlan;
      copilotSessionId: string;
      resultId: string;
      resultVersion: number;
    },
  ): Promise<WorkflowPlanRecord> {
    const { data, copilotSessionId, resultId, resultVersion } = params;
    if (!copilotSessionId) {
      throw new ParamsError('Copilot session ID is required');
    }

    if (!resultId) {
      throw new ParamsError('Result ID is required');
    }

    // Get the latest version for this copilot session
    const latestPlan = await this.prisma.workflowPlan.findFirst({
      where: { copilotSessionId },
      orderBy: { version: 'desc' },
    });

    const newVersion = latestPlan ? latestPlan.version + 1 : 0;
    const planId = genWorkflowPlanID();

    const workflowPlanPO = await this.prisma.workflowPlan.create({
      data: {
        planId,
        uid: user.uid,
        title: data.title ?? '',
        version: newVersion,
        data: JSON.stringify(data),
        copilotSessionId,
        resultId,
        resultVersion,
      },
    });

    this.logger.log(
      `Generated workflow plan: planId=${planId} version=${newVersion} copilotSessionId=${copilotSessionId}`,
    );

    return this.workflowPlanPO2DTO(workflowPlanPO);
  }

  /**
   * Acquire a lock for the workflow plan to avoid concurrency updates.
   */
  async lockPlan(
    planId: string,
    options?: {
      maxRetries?: number;
      initialDelay?: number;
      ttlSeconds?: number;
    },
  ): Promise<LockReleaseFn> {
    this.logger.debug(`Attempting to acquire lock for workflow plan: ${planId}`);
    const lockKey = `workflow-plan:${planId}`;
    const releaseLock = await this.redis.waitLock(lockKey, {
      maxRetries: options?.maxRetries,
      initialDelay: options?.initialDelay,
      ttlSeconds: options?.ttlSeconds,
    });
    return releaseLock;
  }

  /**
   * Patch an existing workflow plan using semantic operations (create a new version with changes)
   * @param planId - The ID of the workflow plan to patch
   * @param operations - Array of semantic patch operations to apply
   * @param resultId - The result ID for tracking
   * @param resultVersion - The result version for tracking
   */
  async patchWorkflowPlan(
    user: User,
    params: {
      planId: string;
      operations: WorkflowPatchOperation[];
      resultId: string;
      resultVersion: number;
    },
  ): Promise<WorkflowPlan> {
    const { planId, operations, resultId, resultVersion } = params;
    if (!planId) {
      throw new ParamsError('Plan ID is required');
    }

    if (!resultId) {
      throw new ParamsError('Result ID is required');
    }

    if (!Array.isArray(operations) || operations.length === 0) {
      throw new ParamsError('At least one patch operation is required');
    }

    const releaseLock = await this.lockPlan(planId);

    try {
      // Get the current plan
      const currentPlan = await this.prisma.workflowPlan.findFirst({
        where: { uid: user.uid, planId },
        orderBy: { version: 'desc' },
      });

      if (!currentPlan) {
        throw new ParamsError(`Workflow plan not found: ${planId}`);
      }

      // Parse current data
      let currentData: WorkflowPlan;
      try {
        currentData = safeParseJSON(currentPlan.data);
      } catch (error) {
        this.logger.error(`Failed to parse workflow plan data: ${error?.message ?? error}`);
        currentData = { title: '', tasks: [], variables: [] };
      }

      // Ensure required arrays exist
      currentData.tasks = currentData.tasks ?? [];
      currentData.variables = currentData.variables ?? [];

      // Apply semantic patch operations
      const patchResult = applyWorkflowPatchOperations(currentData, operations);

      if (!patchResult.success || !patchResult.data) {
        throw new ParamsError(`Failed to apply patch operations: ${patchResult.error}`);
      }

      const newData = patchResult.data;

      // Create a new version
      const newVersion = currentPlan.version + 1;

      const newWorkflowPlanPO = await this.prisma.workflowPlan.create({
        data: {
          planId: currentPlan.planId,
          uid: currentPlan.uid,
          title: newData.title ?? '',
          version: newVersion,
          data: JSON.stringify(newData),
          patch: JSON.stringify({ operations }), // Store operations for traceability
          copilotSessionId: currentPlan.copilotSessionId,
          resultId,
          resultVersion,
        },
      });

      this.logger.log(
        `Patched workflow plan: planId=${planId} oldVersion=${currentPlan.version} newVersion=${newVersion} operations=${operations.length}`,
      );

      return this.workflowPlanPO2DTO(newWorkflowPlanPO as WorkflowPlanPO);
    } finally {
      await releaseLock();
    }
  }

  /**
   * Get the latest version of a workflow plan by copilot session ID
   */
  async getLatestWorkflowPlan(
    user: User,
    params: { copilotSessionId: string },
  ): Promise<WorkflowPlan | null> {
    const { copilotSessionId } = params;
    if (!copilotSessionId) {
      throw new ParamsError('Copilot session ID is required');
    }

    const latestPlan = await this.prisma.workflowPlan.findFirst({
      where: { uid: user.uid, copilotSessionId },
      orderBy: { version: 'desc' },
    });

    if (!latestPlan) {
      return null;
    }

    return this.workflowPlanPO2DTO(latestPlan as WorkflowPlanPO);
  }

  /**
   * Convert WorkflowPlan PO to DTO
   * The API schema only exposes: planId, version, data, patch, createdAt, updatedAt
   * Internal fields (resultId, resultVersion, copilotSessionId) are not exposed
   */
  private workflowPlanPO2DTO(po: WorkflowPlanPO): WorkflowPlanRecord {
    let data: WorkflowPlan = { title: '', tasks: [], variables: [] };

    try {
      const parsed = safeParseJSON(po.data);
      if (parsed) {
        data = parsed;
      }
    } catch (error) {
      this.logger.error(`Failed to parse workflow plan data: ${error?.message ?? error}`);
    }

    return {
      planId: po.planId,
      version: po.version,
      title: data.title,
      tasks: data.tasks,
      variables: data.variables,
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
    };
  }
}
