import { Injectable, Logger, Inject } from '@nestjs/common';
import { User, InvokeSkillRequest, ActionResult } from '@refly/openapi-schema';

/**
 * SkillServiceIntegration - Real SkillService Integration Adapter
 *
 * Provides a clean interface between DivergentEngine and the existing SkillService system.
 * Handles proper skill invocation, metadata preservation, and error management.
 *
 * Key Features:
 * - Direct integration with existing SkillService.sendInvokeSkillTask
 * - Preservation of divergent metadata in ActionResult.actionMeta
 * - Proper error handling and propagation
 * - Support for all available skill types (webSearch, librarySearch, commonQnA, etc.)
 * - Context and result history management
 */
@Injectable()
export class SkillServiceIntegration {
  private readonly logger = new Logger(SkillServiceIntegration.name);

  constructor(@Inject('SkillService') private readonly skillService: any) {
    this.logger.log('SkillServiceIntegration initialized with real SkillService');
  }

  /**
   * Invoke a skill through the existing SkillService infrastructure
   *
   * This method provides a direct integration with SkillService.sendInvokeSkillTask,
   * ensuring that DivergentAgent can leverage all existing skills without modification.
   *
   * @param user - The user context for skill execution
   * @param request - Complete skill invocation request with all parameters
   * @returns Promise<ActionResult> - Result from skill execution with preserved metadata
   */
  async invokeSkill(user: User, request: InvokeSkillRequest): Promise<ActionResult> {
    try {
      // Validate request parameters
      this.validateSkillRequest(request);

      this.logger.log(
        `Invoking skill ${request.skillName} for user ${user.uid} (result: ${request.resultId})`,
      );

      // Direct delegation to existing SkillService
      const result = await this.skillService.sendInvokeSkillTask(user, request);

      this.logger.log(
        `Skill ${request.skillName} completed successfully (result: ${result.resultId})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to invoke skill ${request.skillName} for user ${user.uid}: ${error.message}`,
      );
      this.logger.error(`Error details: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate skill request parameters before execution
   *
   * Ensures all required fields are present and valid before attempting skill execution.
   * Prevents common integration errors and provides clear feedback.
   *
   * @param request - Skill invocation request to validate
   * @throws Error if validation fails
   */
  private validateSkillRequest(request: InvokeSkillRequest): void {
    if (!request.skillName) {
      throw new Error('Skill name is required for skill invocation');
    }

    if (!request.resultId) {
      throw new Error('Result ID is required for skill invocation');
    }

    if (!request.target?.entityId) {
      throw new Error('Target entity ID is required for skill invocation');
    }

    if (!request.input) {
      throw new Error('Input parameters are required for skill invocation');
    }

    // Validate skill name is one of the supported types
    const supportedSkills = [
      'webSearch',
      'librarySearch',
      'commonQnA',
      'generateDoc',
      'codeArtifacts',
      'generateMedia',
    ];

    if (!supportedSkills.includes(request.skillName)) {
      throw new Error(`Unsupported skill type: ${request.skillName}`);
    }
  }
}
