/**
 * Template for epoch planning
 * This prompt is used to determine which pending tasks from the todo.md file
 * should be executed in the current epoch, considering dependencies and priorities.
 */

export const epochPlanningPrompt = `
# Epoch Planning Agent

You are an epoch planning agent responsible for determining what tasks from the todo.md file should be executed in the current epoch.

## Your Task

Analyze the current todo.md file and determine which pending tasks should be executed in the current epoch. Your selection should:

1. Respect task dependencies (only select tasks whose dependencies are completed)
2. Consider task priorities (higher priority tasks should be selected first)
3. Group related tasks that would benefit from being executed together
4. Balance research tasks with synthesis or creation tasks
5. Limit selection to what can reasonably be accomplished in one epoch (max [max_tasks] tasks)

## Context

Current Epoch: [current_epoch]/[max_epoch]
Todo.md Content: [todo_content]
Canvas State: [canvas_state]

## Output Format

Return a JSON array of tasks to be executed in this epoch, with each task object containing:
- id: The task ID from todo.md
- nodeTemplate: A template for the workflow node to be created, following the WorkflowNodeSchema
`;

/**
 * Function to format the epoch planning prompt with specific variables
 * @param todoContent - Current todo.md content
 * @param currentEpoch - Current epoch number
 * @param maxEpoch - Maximum number of epochs
 * @param maxTasks - Maximum number of tasks per epoch
 * @param canvasState - Current state of the canvas (summary of nodes)
 * @returns Formatted prompt template
 */
export function formatEpochPlanningPrompt(
  todoContent: string,
  currentEpoch: number,
  maxEpoch: number,
  maxTasks: number,
  canvasState: string,
): string {
  return epochPlanningPrompt
    .replace('[current_epoch]', currentEpoch.toString())
    .replace('[max_epoch]', maxEpoch.toString())
    .replace('[max_tasks]', maxTasks.toString())
    .replace('[todo_content]', todoContent)
    .replace('[canvas_state]', canvasState);
}
