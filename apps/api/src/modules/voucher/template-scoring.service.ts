import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { z } from 'zod';
import { User } from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { ProviderService } from '../provider/provider.service';
import { VariableExtractionService } from '../variable-extraction/variable-extraction.service';
import { buildTemplateScoringPrompt, TemplateScoringInput } from './template-scoring.prompt';
import { TemplateScoringResult, TemplateScoringBreakdown } from './voucher.dto';
import { DEFAULT_LLM_SCORE, SCORING_TIMEOUT_MS } from './voucher.constants';

/**
 * Zod Schema for structured output from LLM
 */
const TemplateScoringResultSchema = z.object({
  score: z.number().min(0).max(100).describe('Total score 0-100'),
  breakdown: z.object({
    structure: z.number().min(0).max(30).describe('Structure completeness 0-30'),
    inputDesign: z.number().min(0).max(25).describe('Input design 0-25'),
    promptQuality: z.number().min(0).max(25).describe('Prompt quality 0-25'),
    reusability: z.number().min(0).max(20).describe('Reusability 0-20'),
  }),
  feedback: z.string().describe('Brief improvement suggestion'),
});

@Injectable()
export class TemplateScoringService implements OnModuleInit {
  private readonly logger = new Logger(TemplateScoringService.name);

  // Lazy-loaded to avoid circular dependency
  private variableExtractionService: VariableExtractionService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerService: ProviderService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    // Use moduleRef.get with { strict: false } to resolve circular dependency at runtime
    this.variableExtractionService = this.moduleRef.get(VariableExtractionService, {
      strict: false,
    });
  }

  /**
   * Score a template by canvas ID
   * This is the main entry point - fetches canvas data internally
   *
   * @param user - User info for LLM provider access
   * @param canvasId - Canvas ID to score
   * @returns Scoring result with score (0-100)
   */
  async scoreTemplateByCanvasId(user: User, canvasId: string): Promise<TemplateScoringResult> {
    try {
      this.logger.log(`Starting template scoring for canvas: ${canvasId}`);

      // 1. Build enhanced context from canvas (reuse VariableExtractionService logic)
      const context = await this.variableExtractionService.buildEnhancedContext(canvasId, user);

      // 2. Get canvas basic info
      const canvas = await this.prisma.canvas.findFirst({
        where: { canvasId, deletedAt: null },
        select: { title: true },
      });

      // 3. Get workflow app info if exists (for description)
      const workflowApp = await this.prisma.workflowApp.findFirst({
        where: { canvasId, deletedAt: null },
        select: { title: true, description: true, templateContent: true },
      });

      // 4. Build scoring input from context
      const scoringInput: TemplateScoringInput = {
        title: workflowApp?.title || canvas?.title || 'Untitled',
        description: workflowApp?.description || undefined,
        nodes:
          context.canvasData.nodes?.map((node) => ({
            id: node.id,
            type: node.type,
            title: (node.data as any)?.title || (node.data as any)?.metadata?.title,
            query:
              (node.data as any)?.metadata?.query ||
              (node.data as any)?.metadata?.structuredData?.query,
          })) || [],
        variables: context.variables.map((v) => ({
          name: v.name,
          variableType: v.variableType,
          description: v.description,
        })),
        templateContent: workflowApp?.templateContent || undefined,
      };

      // 5. Call LLM for scoring
      const result = await this.scoreTemplate(user, scoringInput);

      this.logger.log(`Template scoring completed for canvas ${canvasId}: ${result.score}/100`);

      return result;
    } catch (error) {
      this.logger.error(`Template scoring failed for canvas ${canvasId}: ${error.message}`);

      // Degradation: return default score
      return {
        score: DEFAULT_LLM_SCORE,
        feedback: 'Scoring service temporarily unavailable, using default score.',
      };
    }
  }

  /**
   * Score a template with provided input data
   * Called internally after fetching canvas data
   *
   * @param user - User info for LLM provider access
   * @param input - Template scoring input data
   * @returns Scoring result with score (0-100)
   */
  async scoreTemplate(user: User, input: TemplateScoringInput): Promise<TemplateScoringResult> {
    try {
      this.logger.log(`Starting template scoring for: ${input.title}`);

      // Build scoring prompt
      const prompt = buildTemplateScoringPrompt(input);

      // Call LLM with timeout
      const result = await this.callLLMWithTimeout(user, prompt);

      // Validate score range
      const validatedScore = Math.max(0, Math.min(100, result.score));

      // Validate breakdown sum equals total
      if (result.breakdown) {
        const breakdownSum =
          result.breakdown.structure +
          result.breakdown.inputDesign +
          result.breakdown.promptQuality +
          result.breakdown.reusability;

        if (Math.abs(breakdownSum - validatedScore) > 1) {
          this.logger.warn(
            `Score breakdown mismatch: sum=${breakdownSum}, total=${validatedScore}`,
          );
        }
      }

      this.logger.log(`Template scoring completed: ${validatedScore}/100`);

      return {
        score: validatedScore,
        breakdown: result.breakdown as TemplateScoringBreakdown,
        feedback: result.feedback,
      };
    } catch (error) {
      this.logger.error(`Template scoring failed: ${error.message}`);

      // Degradation: return default score
      return {
        score: DEFAULT_LLM_SCORE,
        feedback: 'Scoring service temporarily unavailable, using default score.',
      };
    }
  }

  /**
   * Call LLM with timeout protection
   */
  private async callLLMWithTimeout(
    user: User,
    prompt: string,
  ): Promise<z.infer<typeof TemplateScoringResultSchema>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCORING_TIMEOUT_MS);

    try {
      // Get default chat model (platform cost, not user credits)
      const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
      if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
        throw new Error('No valid LLM provider found for template scoring');
      }

      const model = await this.providerService.prepareChatModel(user, chatPi.itemId);

      // Use withStructuredOutput for reliable JSON parsing
      const response = await model
        .withStructuredOutput(TemplateScoringResultSchema)
        .invoke(prompt, { signal: controller.signal });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Convert LLM score (0-100) to discount percentage (10-90)
   * Higher score = higher discount (better templates get bigger discounts)
   *
   * Score to discount mapping:
   * - 0-20:   10% off (9折)
   * - 21-30:  20% off (8折)
   * - 31-40:  30% off (7折)
   * - 41-50:  40% off (6折)
   * - 51-60:  50% off (5折)
   * - 61-70:  60% off (4折)
   * - 71-80:  70% off (3折)
   * - 81-90:  80% off (2折)
   * - 91-100: 90% off (1折)
   *
   * @param score - LLM score (0-100)
   * @returns Discount percentage (10-90)
   */
  scoreToDiscountPercent(score: number): number {
    if (score >= 91) return 90; // 1折
    if (score >= 81) return 80; // 2折
    if (score >= 71) return 70; // 3折
    if (score >= 61) return 60; // 4折
    if (score >= 51) return 50; // 5折
    if (score >= 41) return 40; // 6折
    if (score >= 31) return 30; // 7折
    if (score >= 21) return 20; // 8折
    return 10; // 9折 (0-20分)
  }

  /**
   * Get default score for degradation scenarios
   */
  getDefaultScore(): number {
    return DEFAULT_LLM_SCORE;
  }
}
