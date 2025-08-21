import { Logger } from '@nestjs/common';
import { BaseChatModel } from '@refly/providers';
import { extractJsonFromMarkdown } from '@refly/utils';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { PilotSession, PilotStep } from '@refly/openapi-schema';
import {
  multiStepSchema,
  generatePlanningPrompt,
  generateBootstrapPrompt,
  generateFallbackPrompt,
  PilotStepRawOutput,
  getRecommendedStageForEpoch,
} from './prompt';
import { MAX_EPOCH, MAX_STEPS_PER_EPOCH } from './pilot.service';

export class PilotEngine {
  private logger = new Logger(PilotEngine.name);

  constructor(
    private readonly model: BaseChatModel,
    private readonly session: PilotSession,
    private readonly steps: PilotStep[],
  ) {}

  async run(
    contentItems: CanvasContentItem[],
    maxStepsPerEpoch = MAX_STEPS_PER_EPOCH,
    locale?: string,
  ): Promise<PilotStepRawOutput[]> {
    const sessionInput = this.session.input;
    const userQuestion = sessionInput.query;

    try {
      if (!userQuestion) {
        this.logger.warn('No user question provided for research planning');
        return [];
      }

      // Get the current epoch information
      const currentEpoch = this.session?.currentEpoch ?? 0;
      const totalEpochs = this.session?.maxEpoch ?? MAX_EPOCH;
      const recommendedStage = getRecommendedStageForEpoch(currentEpoch, totalEpochs);

      if (currentEpoch > totalEpochs) {
        this.logger.warn('Current epoch exceeds total epochs');
        return [];
      }

      this.logger.log(
        `Planning research steps for "${userQuestion}" with ${contentItems.length} content items. Current epoch: ${currentEpoch + 1}/${totalEpochs + 1}, recommended stage: ${recommendedStage}. Note: Creation tools (generateDoc, codeArtifacts) must ONLY be used in the final 1-2 steps and MUST reference previous context`,
      );

      // First attempt: Use LLM structured output capability
      try {
        const structuredLLM = this.model.withStructuredOutput(multiStepSchema);

        // Generate the full prompt with optimized guidelines
        const fullPrompt = generatePlanningPrompt(
          userQuestion,
          this.session,
          this.steps,
          contentItems,
          maxStepsPerEpoch,
          locale,
        );

        const { steps } = await structuredLLM.invoke(fullPrompt);

        this.logger.log(`Generated research plan: ${JSON.stringify(steps)}`);

        if (recommendedStage === 'creation') {
          return (
            steps
              .filter(
                (step) =>
                  step.skillName === 'generateDoc' ||
                  step.skillName === 'codeArtifacts' ||
                  step.skillName === 'generateMedia' ||
                  step.skillName === 'commonQnA',
              )
              .slice(0, 1) || []
          );
        } else {
          return (
            steps
              .filter(
                (step) =>
                  step.skillName !== 'generateDoc' &&
                  step.skillName !== 'codeArtifacts' &&
                  step.skillName !== 'generateMedia',
              )
              .slice(0, MAX_STEPS_PER_EPOCH) || []
          );
        }
      } catch (structuredError) {
        this.logger.warn(
          `Structured output failed: ${structuredError.message}, trying fallback approach`,
        );
        // Continue to fallback
      }

      // Second attempt: Manual JSON parsing approach
      const fallbackPrompt = generateFallbackPrompt(
        userQuestion,
        this.session,
        this.steps,
        contentItems,
        maxStepsPerEpoch,
        locale,
      );

      const response = await this.model.invoke(fallbackPrompt);
      const responseText = response.content.toString();

      // Extract and parse JSON
      const extraction = extractJsonFromMarkdown(responseText);

      if (extraction.error) {
        throw new Error(
          `JSON extraction failed: ${extraction.error.message}, using final fallback`,
        );
      }

      const { steps } = await multiStepSchema.parseAsync(extraction.result);

      this.logger.log(`Successfully generated research plan with ${steps?.length} steps`);
      return steps;
    } catch (error) {
      this.logger.error(`Error generating research plan: ${error.message}`);
      return [];
    }
  }

  /**
   * Generates research steps based solely on the user question when no canvas content is available
   * @param userQuestion The user's research question
   * @param maxStepsPerEpoch The maximum number of steps to generate
   * @param locale The user's preferred output locale
   */
  private async generateResearchWithoutContent(
    userQuestion: string,
    maxStepsPerEpoch = 3,
    locale?: string,
  ): Promise<PilotStepRawOutput[]> {
    // Create an empty list of content items for the bootstrap process
    const emptyContentItems: CanvasContentItem[] = [];

    // Get the current epoch information
    const currentEpoch = this.session?.currentEpoch ?? 0;
    const totalEpochs = this.session?.maxEpoch ?? 2;
    const recommendedStage = getRecommendedStageForEpoch(currentEpoch, totalEpochs);

    this.logger.log(
      `Bootstrap planning for "${userQuestion}" without content. Current epoch: ${currentEpoch + 1}/${totalEpochs + 1}, recommended stage: ${recommendedStage}`,
    );

    try {
      // First attempt: Use LLM structured output capability with empty context
      try {
        const structuredLLM = this.model.withStructuredOutput(multiStepSchema);

        // Use the bootstrap prompt with optimized guidelines
        const fullPrompt = generateBootstrapPrompt(
          userQuestion,
          this.session,
          this.steps,
          emptyContentItems,
          maxStepsPerEpoch,
          locale,
        );

        const { steps } = await structuredLLM.invoke(fullPrompt);

        this.logger.log(`Generated bootstrap research plan: ${JSON.stringify(steps)}`);

        return steps;
      } catch (structuredError) {
        this.logger.warn(
          `Structured output for bootstrap plan failed: ${structuredError.message}, trying fallback approach`,
        );
        // Continue to fallback
      }

      // Second attempt: Manual JSON parsing approach
      const fallbackPrompt = generateFallbackPrompt(
        userQuestion,
        this.session,
        this.steps,
        emptyContentItems,
        maxStepsPerEpoch,
        locale,
      );

      const response = await this.model.invoke(fallbackPrompt);
      const responseText = response.content.toString();

      // Extract and parse JSON
      const extraction = extractJsonFromMarkdown(responseText);

      if (extraction.error) {
        throw new Error(`JSON extraction failed for bootstrap plan: ${extraction.error.message}`);
      }

      const { steps } = await multiStepSchema.parseAsync(extraction.result);

      this.logger.log(`Successfully generated bootstrap research plan with ${steps?.length} steps`);
      return steps;
    } catch (error) {
      this.logger.error(`Error generating bootstrap research plan: ${error.message}`);
      return [];
    }
  }
}
