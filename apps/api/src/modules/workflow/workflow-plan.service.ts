import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WorkflowPlan, WorkflowPlanData } from '@refly/openapi-schema';
import { ParamsError } from '@refly/errors';
import { genUniqueId, safeParseJSON } from '@refly/utils';
import { WorkflowPlan as WorkflowPlanPO } from '@prisma/client';
import {
  WorkflowPatchOperation,
  applyWorkflowPatchOperations,
  WorkflowPlan as WorkflowPlanType,
} from '@refly/canvas-common';

@Injectable()
export class WorkflowPlanService {
  private readonly logger = new Logger(WorkflowPlanService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get workflow plan detail by planId
   */
  async getWorkflowPlanDetail(planId: string): Promise<WorkflowPlan> {
    if (!planId) {
      throw new ParamsError('Plan ID is required');
    }

    const workflowPlanPO = await this.prisma.workflowPlan.findUnique({
      where: { planId },
    });

    if (!workflowPlanPO) {
      throw new ParamsError(`Workflow plan not found: ${planId}`);
    }

    return this.workflowPlanPO2DTO(workflowPlanPO as WorkflowPlanPO);
  }

  /**
   * Generate a new workflow plan
   */
  async generateWorkflowPlan(
    data: WorkflowPlanData,
    copilotSessionId: string,
    resultId: string,
    resultVersion: number,
  ): Promise<WorkflowPlan> {
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
    const planId = `workflow-plan-${genUniqueId()}`;

    // For the first version, patch is the same as data
    // For subsequent versions, patch represents changes from previous version
    const patchData = data;

    const workflowPlanPO = await this.prisma.workflowPlan.create({
      data: {
        planId,
        title: data.title ?? '',
        version: newVersion,
        data: JSON.stringify(data),
        patch: JSON.stringify(patchData),
        copilotSessionId,
        resultId,
        resultVersion,
      },
    });

    this.logger.log(
      `Generated workflow plan: planId=${planId} version=${newVersion} copilotSessionId=${copilotSessionId}`,
    );

    return this.workflowPlanPO2DTO(workflowPlanPO as WorkflowPlanPO);
  }

  /**
   * Patch an existing workflow plan using semantic operations (create a new version with changes)
   * @param planId - The ID of the workflow plan to patch
   * @param operations - Array of semantic patch operations to apply
   * @param resultId - The result ID for tracking
   * @param resultVersion - The result version for tracking
   */
  async patchWorkflowPlan(
    planId: string,
    operations: WorkflowPatchOperation[],
    resultId: string,
    resultVersion: number,
  ): Promise<WorkflowPlan> {
    if (!planId) {
      throw new ParamsError('Plan ID is required');
    }

    if (!resultId) {
      throw new ParamsError('Result ID is required');
    }

    if (!Array.isArray(operations) || operations.length === 0) {
      throw new ParamsError('At least one patch operation is required');
    }

    // Get the current plan
    const currentPlan = await this.prisma.workflowPlan.findUnique({
      where: { planId },
    });

    if (!currentPlan) {
      throw new ParamsError(`Workflow plan not found: ${planId}`);
    }

    // Parse current data
    let currentData: WorkflowPlanType;
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
  }

  /**
   * Get the latest version of a workflow plan by copilot session ID
   */
  async getLatestWorkflowPlan(copilotSessionId: string): Promise<WorkflowPlan | null> {
    if (!copilotSessionId) {
      throw new ParamsError('Copilot session ID is required');
    }

    const latestPlan = await this.prisma.workflowPlan.findFirst({
      where: { copilotSessionId },
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
  private workflowPlanPO2DTO(po: WorkflowPlanPO): WorkflowPlan {
    let data: Record<string, unknown>;
    let patch: Record<string, unknown>;

    try {
      data = JSON.parse(po.data);
    } catch (error) {
      this.logger.error(`Failed to parse workflow plan data: ${error?.message ?? error}`);
      data = {};
    }

    try {
      patch = safeParseJSON(po.patch);
    } catch (error) {
      this.logger.error(`Failed to parse workflow plan patch: ${error?.message ?? error}`);
      patch = {};
    }

    return {
      planId: po.planId,
      version: po.version,
      data,
      patch,
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
    };
  }
}
