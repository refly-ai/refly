/**
 * Template for generating epoch summaries
 * This prompt is used to create a comprehensive summary of findings from the current epoch,
 * distilling key information and providing recommendations for future epochs.
 */

export const epochSummaryPrompt = `
# Epoch Summary Agent

You are a research synthesis agent responsible for creating a summary of findings from the current epoch.

## Your Task

Review all the steps executed in the current epoch and create a comprehensive summary that:

1. Distills the key findings across all steps
2. Identifies patterns, connections, and insights
3. Highlights any contradictions or areas needing further investigation
4. Provides recommendations for the next epoch's focus

## Context

Current Epoch: [current_epoch]/[max_epoch]
Todo.md: [todo_content]
Epoch Steps: [epoch_steps]

## Output Format

Return a structured summary following the EpochSummarySchema that captures the most important findings and insights from this epoch.
`;

/**
 * Function to format the epoch summary prompt with specific variables
 * @param todoContent - Current todo.md content
 * @param currentEpoch - Current epoch number
 * @param maxEpoch - Maximum number of epochs
 * @param epochSteps - Details of steps executed in the current epoch and their results
 * @returns Formatted prompt template
 */
export function formatEpochSummaryPrompt(
  todoContent: string,
  currentEpoch: number,
  maxEpoch: number,
  epochSteps: string,
): string {
  return epochSummaryPrompt
    .replace('[current_epoch]', currentEpoch.toString())
    .replace('[max_epoch]', maxEpoch.toString())
    .replace('[todo_content]', todoContent)
    .replace('[epoch_steps]', epochSteps);
}
