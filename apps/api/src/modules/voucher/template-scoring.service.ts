import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { User, WorkflowVariable, CanvasNode } from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { ProviderService } from '../provider/provider.service';
import {
  buildLightweightScoringPrompt,
  LightweightScoringInput,
  TemplateScoringInput,
  MAX_INPUT_LENGTH,
  truncateText,
} from './template-scoring.prompt';
import { TemplateScoringResult } from './voucher.dto';
import { DEFAULT_LLM_SCORE } from './voucher.constants';

/**
 * Lightweight scoring timeout - shorter since prompt is simpler
 */
const QUICK_SCORING_TIMEOUT_MS = 5000;

/**
 * Zod Schema for lightweight LLM output
 */
const LightweightScoringResultSchema = z.object({
  generality: z.number().min(0).max(20).describe('Generality score 0-20'),
  easeOfUse: z.number().min(0).max(20).describe('Ease of use score 0-20'),
  feedback: z.string().describe('Brief improvement suggestion'),
});

/**
 * Rule-based scoring breakdown
 */
interface RuleBasedScoreBreakdown {
  structureScore: number; // 0-30
  inputScore: number; // 0-30
  details: {
    nodeCount: number;
    variableCount: number;
    hasTitle: boolean;
    hasDescription: boolean;
    variablesWithDescription: number;
  };
}

/**
 * Canvas data input for scoring (passed from workflow-app service)
 */
export interface CanvasDataForScoring {
  title?: string;
  nodes?: CanvasNode[];
}

@Injectable()
export class TemplateScoringService {
  private readonly logger = new Logger(TemplateScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerService: ProviderService,
  ) {}

  /**
   * Score a template using pre-fetched canvas data
   * This is the preferred method when canvas data is already available (e.g., during publish)
   *
   * @param user - User info for LLM provider access
   * @param canvasData - Pre-fetched canvas data with nodes
   * @param variables - Workflow variables
   * @param description - Template description
   * @returns Scoring result with score (0-100)
   */
  async scoreTemplateWithCanvasData(
    user: User,
    canvasData: CanvasDataForScoring,
    variables: WorkflowVariable[],
    description?: string,
  ): Promise<TemplateScoringResult> {
    try {
      const startTime = Date.now();
      const nodes = canvasData.nodes || [];

      // 1. Build scoring input
      const scoringInput: TemplateScoringInput = {
        title: canvasData.title || 'Untitled',
        description,
        nodes: nodes.map((node) => ({
          id: node.id || '',
          type: node.type,
          title: (node.data?.title || node.data?.metadata?.title) as string | undefined,
        })),
        variables: variables.map((v) => ({
          name: v.name,
          variableType: v.variableType || 'text',
          description: v.description,
        })),
        skillInputs: this.extractSkillInputs(nodes),
      };

      // 2. Calculate rule-based score (60 points max)
      const ruleScore = this.calculateRuleBasedScore(scoringInput);

      // 3. Get LLM semantic score (40 points max)
      const llmScore = await this.getLightweightLLMScore(user, scoringInput);

      // 4. Combine scores
      const totalScore = ruleScore.structureScore + ruleScore.inputScore + llmScore.score;

      const duration = Date.now() - startTime;
      this.logger.log(
        `Quick scoring completed: ${totalScore}/100 (rule: ${ruleScore.structureScore + ruleScore.inputScore}, llm: ${llmScore.score}) in ${duration}ms`,
      );

      return {
        score: totalScore,
        breakdown: {
          structure: ruleScore.structureScore,
          inputDesign: ruleScore.inputScore,
          promptQuality: llmScore.generality,
          reusability: llmScore.easeOfUse,
        },
        feedback: llmScore.feedback,
      };
    } catch (error) {
      this.logger.error(`Quick template scoring failed: ${error.message}`);

      // Degradation: return default score
      return {
        score: DEFAULT_LLM_SCORE,
        feedback: 'Scoring service temporarily unavailable, using default score.',
      };
    }
  }

  /**
   * Extract skill inputs from skillResponse nodes
   * Each input is truncated to MAX_INPUT_LENGTH characters
   */
  private extractSkillInputs(nodes: CanvasNode[]): Array<{ title?: string; input: string }> {
    const skillInputs: Array<{ title?: string; input: string }> = [];

    for (const node of nodes) {
      if (node.type !== 'skillResponse') continue;

      const nodeData = node.data as Record<string, any> | undefined;
      if (!nodeData) continue;

      // Get input from metadata.structuredData.query or metadata.query
      const metadata = nodeData.metadata as Record<string, any> | undefined;
      const structuredData = metadata?.structuredData as Record<string, any> | undefined;
      const query = structuredData?.query || metadata?.query || '';

      if (query) {
        skillInputs.push({
          title: (nodeData.title || metadata?.title) as string | undefined,
          input: truncateText(query, MAX_INPUT_LENGTH),
        });
      }
    }

    return skillInputs;
  }

  /**
   * Calculate rule-based score (60 points max)
   * - Structure score (30 points): based on node count
   * - Input score (30 points): based on variable count and descriptions
   */
  private calculateRuleBasedScore(input: TemplateScoringInput): RuleBasedScoreBreakdown {
    const nodeCount = input.nodes.length;
    const variableCount = input.variables.length;
    const hasTitle = !!input.title && input.title !== 'Untitled';
    const hasDescription = !!input.description && input.description.length > 10;
    const variablesWithDescription = input.variables.filter(
      (v) => v.description && v.description.length > 3,
    ).length;

    // Structure score (0-30)
    // Ideal: 3-10 nodes
    let structureScore = 0;
    if (nodeCount >= 1 && nodeCount <= 2) {
      structureScore = 15; // Too simple
    } else if (nodeCount >= 3 && nodeCount <= 10) {
      structureScore = 30; // Ideal range
    } else if (nodeCount > 10 && nodeCount <= 15) {
      structureScore = 20; // A bit complex
    } else if (nodeCount > 15) {
      structureScore = 10; // Too complex
    }

    // Input score (0-30)
    let inputScore = 0;

    // Variable count scoring (0-15)
    // Ideal: 2-5 variables
    if (variableCount >= 1 && variableCount <= 1) {
      inputScore += 8; // Too few
    } else if (variableCount >= 2 && variableCount <= 5) {
      inputScore += 15; // Ideal range
    } else if (variableCount > 5 && variableCount <= 8) {
      inputScore += 10; // A bit many
    } else if (variableCount > 8) {
      inputScore += 5; // Too many
    }

    // Title and description bonus (0-7)
    if (hasTitle) inputScore += 3;
    if (hasDescription) inputScore += 4;

    // Variable descriptions bonus (0-8)
    if (variableCount > 0) {
      const descriptionRatio = variablesWithDescription / variableCount;
      inputScore += Math.round(descriptionRatio * 8);
    }

    return {
      structureScore,
      inputScore,
      details: {
        nodeCount,
        variableCount,
        hasTitle,
        hasDescription,
        variablesWithDescription,
      },
    };
  }

  /**
   * Get lightweight LLM semantic score (40 points max)
   * Only evaluates generality and ease of use
   */
  private async getLightweightLLMScore(
    user: User,
    input: TemplateScoringInput,
  ): Promise<{ score: number; generality: number; easeOfUse: number; feedback: string }> {
    try {
      // Build lightweight input
      const lightweightInput: LightweightScoringInput = {
        title: input.title,
        description: input.description,
        nodeTypes: input.nodes.map((n) => n.type).filter(Boolean),
        variables: input.variables.map((v) => ({
          name: v.name,
          type: v.variableType,
        })),
        skillInputs: input.skillInputs,
      };

      const prompt = buildLightweightScoringPrompt(lightweightInput);

      // Call LLM with shorter timeout
      const result = await this.callLLMWithTimeout(user, prompt, QUICK_SCORING_TIMEOUT_MS);

      const generality = Math.max(0, Math.min(20, result.generality));
      const easeOfUse = Math.max(0, Math.min(20, result.easeOfUse));

      return {
        score: generality + easeOfUse,
        generality,
        easeOfUse,
        feedback: result.feedback,
      };
    } catch (error) {
      this.logger.warn(`Lightweight LLM scoring failed: ${error.message}, using default`);

      // Fallback: give moderate scores
      return {
        score: 20,
        generality: 10,
        easeOfUse: 10,
        feedback: 'Unable to evaluate semantic quality.',
      };
    }
  }

  /**
   * Call LLM with timeout protection
   */
  private async callLLMWithTimeout(
    user: User,
    prompt: string,
    timeoutMs: number = QUICK_SCORING_TIMEOUT_MS,
  ): Promise<z.infer<typeof LightweightScoringResultSchema>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Get default chat model (platform cost, not user credits)
      const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
      if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
        throw new Error('No valid LLM provider found for template scoring');
      }

      const model = await this.providerService.prepareChatModel(user, chatPi.itemId);

      // Use withStructuredOutput for reliable JSON parsing
      const response = await model
        .withStructuredOutput(LightweightScoringResultSchema)
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
