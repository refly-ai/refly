import { z } from 'zod';
import { extractJsonFromMarkdown } from '@refly/utils';
import { pilotStepSchema } from './prompt/index';

/**
 * Schema for epoch stage planning information
 */
export const epochStageSchema = z.object({
  epoch: z.number().describe('Epoch number'),
  stage: z.string().describe('Stage name'),
  objective: z.string().describe('Main objective for this epoch'),
  successCriteria: z.string().describe('How to measure success'),
  recommendedTools: z.array(z.string()).describe('Recommended skills/tools for this epoch'),
});

/**
 * Schema for global planning information (used in Bootstrap)
 */
export const globalPlanningSchema = z.object({
  overallStrategy: z.string().describe('Overall approach strategy'),
  epochBreakdown: z.array(epochStageSchema).describe('Breakdown of each epoch'),
  riskAssessment: z.string().describe('Risk assessment and contingency plans'),
});

/**
 * Schema for next epoch plan with readiness decision
 */
export const nextEpochPlanSchema = z.object({
  readyForFinal: z.boolean().describe('Whether we are ready to produce final output'),
  reason: z.string().describe('Explanation for the readiness decision'),
  nextEpochPlan: z
    .array(pilotStepSchema)
    .describe('List of steps for the next epoch, empty if readyForFinal is true'),
  globalPlanning: globalPlanningSchema
    .optional()
    .describe('Global planning information (only for Bootstrap)'),
});

export type NextEpochPlan = z.infer<typeof nextEpochPlanSchema>;
export type EpochStage = z.infer<typeof epochStageSchema>;
export type GlobalPlanning = z.infer<typeof globalPlanningSchema>;

/**
 * Extract and validate next epoch plan from SummaryAndPlan markdown content
 * @param content - The markdown content from SummaryAndPlan output
 * @param maxStepsPerEpoch - Maximum number of steps to keep (Top-N filtering)
 * @returns Parsed and validated plan or error
 */
export function extractPlanFromMarkdown(
  content: string,
  maxStepsPerEpoch = 5,
): { success: true; plan: NextEpochPlan } | { success: false; error: string } {
  try {
    // Extract JSON from markdown fenced code block
    const extraction = extractJsonFromMarkdown(content);

    if (extraction.error) {
      return {
        success: false,
        error: `JSON extraction failed: ${extraction.error.message}`,
      };
    }

    // Validate the structure using zod
    const rawPlan = nextEpochPlanSchema.parse(extraction.result);

    // Apply Top-N filtering to nextEpochPlan if needed
    const filteredPlan: NextEpochPlan = {
      ...rawPlan,
      nextEpochPlan: rawPlan.nextEpochPlan
        .sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3)) // Sort by priority (lower = higher priority)
        .slice(0, maxStepsPerEpoch), // Keep only top N steps
    };

    // Apply field completion for missing optional fields
    filteredPlan.nextEpochPlan = filteredPlan.nextEpochPlan.map((step) => ({
      ...step,
      priority: step.priority ?? 3, // Default priority
      contextItemIds: step.contextItemIds ?? [], // Default empty array
      workflowStage: step.workflowStage ?? 'research', // Default to research stage
    }));

    return {
      success: true,
      plan: filteredPlan,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    };
  }
}

/**
 * Map a validated NextEpochPlan to PilotStepRawOutput array for direct consumption
 * @param plan - The validated next epoch plan
 * @returns Array of raw steps ready for creation
 */
export function mapPlanToRawSteps(plan: NextEpochPlan): Array<{
  name: string;
  skillName: string;
  priority: number;
  query: string;
  contextItemIds: string[];
  workflowStage: string;
}> {
  return plan.nextEpochPlan.map((step) => ({
    name: step.name,
    skillName: step.skillName,
    priority: step.priority ?? 3,
    query: step.query,
    contextItemIds: step.contextItemIds ?? [],
    workflowStage: step.workflowStage ?? 'research',
  }));
}
